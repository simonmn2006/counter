import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { createServer as createViteServer } from "vite";
import path from "path";
import Database from "better-sqlite3";
import { format, startOfDay, addDays } from "date-fns";

import { InfluxDB, Point } from "@influxdata/influxdb-client";
import mysql from "mysql2/promise";
import { SerialPort } from "serialport";
import { ReadlineParser } from "@serialport/parser-readline";

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer);
  const PORT = 3000;

  // Database Setup
  const db = new Database("tracker.db");
  db.pragma("journal_mode = WAL");

  db.exec(`
    CREATE TABLE IF NOT EXISTS meals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      qr_code TEXT UNIQUE NOT NULL,
      daily_goal INTEGER DEFAULT 0,
      is_deleted INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS marquee_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      text TEXT NOT NULL,
      start_time TEXT NOT NULL, -- HH:mm
      end_time TEXT NOT NULL,    -- HH:mm
      repeat TEXT DEFAULT 'daily', -- 'daily' or 'once'
      start_date TEXT,           -- YYYY-MM-DD
      end_date TEXT,             -- YYYY-MM-DD
      speed TEXT DEFAULT 'normal', -- 'slow', 'normal', 'fast'
      color TEXT DEFAULT '#000000'
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    -- Initialize default settings
    INSERT OR IGNORE INTO settings (key, value) VALUES ('scanner_id', 'Standard USB Scanner');
    INSERT OR IGNORE INTO settings (key, value) VALUES ('proximity_id', 'ESP32 Sensor');
    INSERT OR IGNORE INTO settings (key, value) VALUES ('calibration_ms', '3000');
    INSERT OR IGNORE INTO settings (key, value) VALUES ('op_start', '00:00');
    INSERT OR IGNORE INTO settings (key, value) VALUES ('op_end', '23:59');
    INSERT OR IGNORE INTO settings (key, value) VALUES ('maintenance_active', '0');
    INSERT OR IGNORE INTO settings (key, value) VALUES ('influx_url', '');
    INSERT OR IGNORE INTO settings (key, value) VALUES ('influx_token', '');
    INSERT OR IGNORE INTO settings (key, value) VALUES ('influx_org', '');
    INSERT OR IGNORE INTO settings (key, value) VALUES ('influx_bucket', '');
    INSERT OR IGNORE INTO settings (key, value) VALUES ('influx_enabled', '0');
    INSERT OR IGNORE INTO settings (key, value) VALUES ('mariadb_host', '');
    INSERT OR IGNORE INTO settings (key, value) VALUES ('mariadb_port', '3306');
    INSERT OR IGNORE INTO settings (key, value) VALUES ('mariadb_user', '');
    INSERT OR IGNORE INTO settings (key, value) VALUES ('mariadb_password', '');
    INSERT OR IGNORE INTO settings (key, value) VALUES ('mariadb_database', '');
    INSERT OR IGNORE INTO settings (key, value) VALUES ('mariadb_enabled', '0');

    CREATE TABLE IF NOT EXISTS counts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      meal_id INTEGER NOT NULL,
      count INTEGER DEFAULT 0,
      date TEXT NOT NULL,
      UNIQUE(meal_id, date),
      FOREIGN KEY(meal_id) REFERENCES meals(id)
    );

    CREATE TABLE IF NOT EXISTS logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      meal_id INTEGER NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(meal_id) REFERENCES meals(id)
    );
  `);

  // Migration: Ensure daily_goal column exists in meals table
  try {
    db.prepare("ALTER TABLE meals ADD COLUMN daily_goal INTEGER DEFAULT 0").run();
  } catch (e) {}

  // Migration: Ensure marquee_messages has new columns
  try {
    db.prepare("ALTER TABLE marquee_messages ADD COLUMN repeat TEXT DEFAULT 'daily'").run();
  } catch (e) {}
  try {
    db.prepare("ALTER TABLE marquee_messages ADD COLUMN start_date TEXT").run();
  } catch (e) {}
  try {
    db.prepare("ALTER TABLE marquee_messages ADD COLUMN end_date TEXT").run();
  } catch (e) {}
  try {
    db.prepare("ALTER TABLE marquee_messages ADD COLUMN speed TEXT DEFAULT 'normal'").run();
  } catch (e) {}
  try {
    db.prepare("ALTER TABLE marquee_messages ADD COLUMN color TEXT DEFAULT '#000000'").run();
  } catch (e) {}

  // Migration: Ensure is_deleted column exists in meals table
  try {
    db.prepare("ALTER TABLE meals ADD COLUMN is_deleted INTEGER DEFAULT 0").run();
  } catch (e) {}

  app.use(express.json());

  // Error handler for API routes
  app.use("/api", (err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error("API Error:", err);
    res.status(500).json({ error: err.message || "Internal Server Error" });
  });

  // Proximity Logic State
  let isMuted = false;
  let proximityActive = false;
  let activationTimer: NodeJS.Timeout | null = null;
  
  // Hardware Status State (Simulated)
  let hardwareStatus = {
    scannerConnected: true,
    proximityConnected: true
  };

  const getCalibrationMs = () => {
    const setting = db.prepare("SELECT value FROM settings WHERE key = 'calibration_ms'").get() as { value: string } | undefined;
    return parseInt(setting?.value || "3000");
  };

  const processProximity = (status: "activated" | "deactivated") => {
    if (status === "activated") {
      proximityActive = true;
      if (activationTimer) clearTimeout(activationTimer);
      
      const delay = getCalibrationMs();
      
      // Start timer to mute after delay
      activationTimer = setTimeout(() => {
        if (proximityActive) {
          isMuted = true;
          io.emit("status", { isMuted: true });
        }
      }, delay);
      
      return { status: "pending", delay };
    } else {
      proximityActive = false;
      if (activationTimer) clearTimeout(activationTimer);
      
      if (isMuted) {
        isMuted = false;
        io.emit("status", { isMuted: false });
      }
      
      return { status: "idle" };
    }
  };

  const processScan = (qrCode: string) => {
    if (!isWithinOperationHours()) {
      return { status: "ignored", reason: "outside_operation_hours" };
    }

    if (isMaintenanceActive()) {
      return { status: "ignored", reason: "maintenance_active" };
    }

    if (isMuted) {
      console.warn(`Scan ignored: Proximity sensor is active (Muted). QR Code: ${qrCode}`);
      return { status: "ignored", reason: "proximity_active" };
    }

    const meal = db.prepare("SELECT id, name FROM meals WHERE qr_code = ?").get(qrCode) as { id: number, name: string } | undefined;
    
    if (!meal) {
      console.error(`Scan error: Meal not found for QR Code: ${qrCode}`);
      return { status: "error", message: "Meal not found" };
    }

    console.log(`Processing scan for meal: ${meal.name} (ID: ${meal.id})`);

    const today = format(new Date(), "yyyy-MM-dd");
    
    let currentCount = 0;
    db.transaction(() => {
      db.prepare(`
        INSERT INTO counts (meal_id, date, count) 
        VALUES (?, ?, 1)
        ON CONFLICT(meal_id, date) DO UPDATE SET count = count + 1
      `).run(meal.id, today);
      
      db.prepare("INSERT INTO logs (meal_id) VALUES (?)").run(meal.id);
      
      const row = db.prepare("SELECT count FROM counts WHERE meal_id = ? AND date = ?").get(meal.id, today) as { count: number };
      currentCount = row.count;
    })();

    const mealInfo = db.prepare("SELECT name, qr_code FROM meals WHERE id = ?").get(meal.id) as { name: string, qr_code: string };
    sendToInfluxDB(mealInfo.name, currentCount);
    sendToMariaDB(mealInfo.name, currentCount, mealInfo.qr_code);

    io.emit("update");
    io.emit("scan", { qrCode, timestamp: new Date() });
    return { status: "counted", mealId: meal.id };
  };

  const isWithinOperationHours = () => {
    const settings = db.prepare("SELECT key, value FROM settings WHERE key IN ('op_start', 'op_end')").all() as { key: string, value: string }[];
    const opStart = settings.find(s => s.key === 'op_start')?.value || "00:00";
    const opEnd = settings.find(s => s.key === 'op_end')?.value || "23:59";
    
    const now = new Date();
    const currentTime = format(now, "HH:mm");
    
    const result = opStart <= opEnd 
      ? (currentTime >= opStart && currentTime <= opEnd)
      : (currentTime >= opStart || currentTime <= opEnd);

    if (!result) {
      console.warn(`Operation hours check failed: Current time ${currentTime} is outside ${opStart}-${opEnd}`);
    }
    
    return result;
  };

  const isMaintenanceActive = () => {
    const setting = db.prepare("SELECT value FROM settings WHERE key = 'maintenance_active'").get() as { value: string } | undefined;
    const active = setting?.value === "1";
    if (active) {
      console.warn("Maintenance mode is active. Scans will be ignored.");
    }
    return active;
  };

  const sendToInfluxDB = async (mealName: string, count: number) => {
    const settingsList = db.prepare("SELECT key, value FROM settings WHERE key LIKE 'influx_%'").all() as { key: string, value: string }[];
    const config = settingsList.reduce((acc: any, s: any) => {
      acc[s.key] = s.value;
      return acc;
    }, {});

    // Prioritize environment variables
    const url = process.env.INFLUX_URL || config.influx_url;
    const token = process.env.INFLUX_TOKEN || config.influx_token;
    const org = process.env.INFLUX_ORG || config.influx_org;
    const bucket = process.env.INFLUX_BUCKET || config.influx_bucket;
    const enabled = config.influx_enabled === '1' || (!!process.env.INFLUX_TOKEN && config.influx_enabled !== '0');

    if (!enabled || !url || !token) return;

    try {
      const client = new InfluxDB({ url, token });
      const writeApi = client.getWriteApi(org, bucket);
      
      const point = new Point('production')
        .tag('menu', mealName)
        .intField('count', count);
      
      writeApi.writePoint(point);
      await writeApi.close();
      console.log(`Data sent to InfluxDB: ${mealName} = ${count}`);
    } catch (e) {
      console.error("InfluxDB Write Error:", e);
    }
  };

  const sendToMariaDB = async (mealName: string, count: number, qrCode: string) => {
    const settingsList = db.prepare("SELECT key, value FROM settings WHERE key LIKE 'mariadb_%'").all() as { key: string, value: string }[];
    const config = settingsList.reduce((acc: any, s: any) => {
      acc[s.key] = s.value;
      return acc;
    }, {});

    // Prioritize environment variables
    const host = process.env.MARIADB_HOST || config.mariadb_host;
    const port = parseInt(process.env.MARIADB_PORT || config.mariadb_port || "3306");
    const user = process.env.MARIADB_USER || config.mariadb_user;
    const password = process.env.MARIADB_PASSWORD || config.mariadb_password;
    const database = process.env.MARIADB_DATABASE || config.mariadb_database;
    const enabled = config.mariadb_enabled === '1' || (!!process.env.MARIADB_HOST && config.mariadb_enabled !== '0');

    if (!enabled || !host || !user) return;

    let connection;
    try {
      connection = await mysql.createConnection({
        host,
        port,
        user,
        password,
        database,
      });

      // Ensure table exists
      await connection.execute(`
        CREATE TABLE IF NOT EXISTS production_logs (
          id INT AUTO_INCREMENT PRIMARY KEY,
          menu_name VARCHAR(255),
          qr_code VARCHAR(255),
          daily_count INT,
          timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await connection.execute(
        'INSERT INTO production_logs (menu_name, qr_code, daily_count) VALUES (?, ?, ?)',
        [mealName, qrCode, count]
      );
      
      console.log(`Data sent to MariaDB: ${mealName} = ${count}`);

      // Also sync to counts table for summary reports
      await connection.execute(`
        CREATE TABLE IF NOT EXISTS counts (
          id INT AUTO_INCREMENT PRIMARY KEY,
          meal_name VARCHAR(255),
          count INT,
          date DATE,
          UNIQUE KEY unique_meal_date (meal_name, date)
        )
      `);

      const today = format(new Date(), "yyyy-MM-dd");
      await connection.execute(
        'INSERT INTO counts (meal_name, count, date) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE count = ?',
        [mealName, count, today, count]
      );

    } catch (e) {
      console.error("MariaDB Write Error:", e);
    } finally {
      if (connection) await connection.end();
    }
  };

  const syncMarqueeToMariaDB = async () => {
    const settingsList = db.prepare("SELECT key, value FROM settings WHERE key LIKE 'mariadb_%'").all() as { key: string, value: string }[];
    const config = settingsList.reduce((acc: any, s: any) => {
      acc[s.key] = s.value;
      return acc;
    }, {});

    // Prioritize environment variables
    const host = process.env.MARIADB_HOST || config.mariadb_host;
    const port = parseInt(process.env.MARIADB_PORT || config.mariadb_port || "3306");
    const user = process.env.MARIADB_USER || config.mariadb_user;
    const password = process.env.MARIADB_PASSWORD || config.mariadb_password;
    const database = process.env.MARIADB_DATABASE || config.mariadb_database;
    const enabled = config.mariadb_enabled === '1' || (!!process.env.MARIADB_HOST && config.mariadb_enabled !== '0');

    if (!enabled || !host || !user) return;

    let connection;
    try {
      connection = await mysql.createConnection({
        host,
        port,
        user,
        password,
        database,
      });

      // Ensure table exists
      await connection.execute(`
        CREATE TABLE IF NOT EXISTS marquee_messages (
          id INT PRIMARY KEY,
          text TEXT,
          start_time VARCHAR(10),
          end_time VARCHAR(10),
          repeat_type VARCHAR(20),
          start_date DATE,
          end_date DATE,
          speed VARCHAR(20),
          color VARCHAR(20)
        )
      `);

      // Get all current messages from SQLite
      const messages = db.prepare("SELECT * FROM marquee_messages").all() as any[];

      // Clear MariaDB table and re-sync (simplest way for small config tables)
      await connection.execute('TRUNCATE TABLE marquee_messages');
      
      for (const msg of messages) {
        await connection.execute(
          'INSERT INTO marquee_messages (id, text, start_time, end_time, repeat_type, start_date, end_date, speed, color) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [msg.id, msg.text, msg.start_time, msg.end_time, msg.repeat, msg.start_date, msg.end_date, msg.speed, msg.color]
        );
      }
      
      console.log(`Marquee messages synced to MariaDB (${messages.length} items)`);
    } catch (e) {
      console.error("MariaDB Marquee Sync Error:", e);
    } finally {
      if (connection) await connection.end();
    }
  };

  const syncMealsToMariaDB = async () => {
    const settings = db.prepare("SELECT key, value FROM settings WHERE key LIKE 'mariadb_%'").all() as { key: string, value: string }[];
    const config = settings.reduce((acc: any, s: any) => {
      acc[s.key] = s.value;
      return acc;
    }, {});

    if (config.mariadb_enabled !== '1' || !config.mariadb_host || !config.mariadb_user) return;

    let connection;
    try {
      connection = await mysql.createConnection({
        host: config.mariadb_host,
        port: parseInt(config.mariadb_port || "3306"),
        user: config.mariadb_user,
        password: config.mariadb_password,
        database: config.mariadb_database,
      });

      await connection.execute(`
        CREATE TABLE IF NOT EXISTS meals (
          id INT PRIMARY KEY,
          name VARCHAR(255),
          qr_code VARCHAR(255),
          daily_goal INT DEFAULT 0,
          is_deleted TINYINT(1) DEFAULT 0,
          created_at DATETIME
        )
      `);

      const meals = db.prepare("SELECT * FROM meals").all() as any[];
      await connection.execute('TRUNCATE TABLE meals');
      for (const meal of meals) {
        await connection.execute(
          'INSERT INTO meals (id, name, qr_code, daily_goal, is_deleted, created_at) VALUES (?, ?, ?, ?, ?, ?)',
          [meal.id, meal.name, meal.qr_code, meal.daily_goal, meal.is_deleted, meal.created_at]
        );
      }
      console.log(`Meals synced to MariaDB (${meals.length} items)`);
    } catch (e) {
      console.error("MariaDB Meals Sync Error:", e);
    } finally {
      if (connection) await connection.end();
    }
  };

  const syncSettingsToMariaDB = async () => {
    const settings = db.prepare("SELECT key, value FROM settings WHERE key LIKE 'mariadb_%'").all() as { key: string, value: string }[];
    const config = settings.reduce((acc: any, s: any) => {
      acc[s.key] = s.value;
      return acc;
    }, {});

    if (config.mariadb_enabled !== '1' || !config.mariadb_host || !config.mariadb_user) return;

    let connection;
    try {
      connection = await mysql.createConnection({
        host: config.mariadb_host,
        port: parseInt(config.mariadb_port || "3306"),
        user: config.mariadb_user,
        password: config.mariadb_password,
        database: config.mariadb_database,
      });

      await connection.execute(`
        CREATE TABLE IF NOT EXISTS settings (
          setting_key VARCHAR(100) PRIMARY KEY,
          setting_value TEXT
        )
      `);

      const allSettings = db.prepare("SELECT * FROM settings").all() as any[];
      await connection.execute('TRUNCATE TABLE settings');
      for (const s of allSettings) {
        await connection.execute(
          'INSERT INTO settings (setting_key, setting_value) VALUES (?, ?)',
          [s.key, s.value]
        );
      }
      console.log(`Settings synced to MariaDB (${allSettings.length} items)`);
    } catch (e) {
      console.error("MariaDB Settings Sync Error:", e);
    } finally {
      if (connection) await connection.end();
    }
  };

  // API Routes
  app.get("/api/hardware/status", (req, res) => {
    res.json(hardwareStatus);
  });

  app.post("/api/hardware/status", (req, res) => {
    const { scannerConnected, proximityConnected } = req.body;
    if (scannerConnected !== undefined) hardwareStatus.scannerConnected = scannerConnected;
    if (proximityConnected !== undefined) hardwareStatus.proximityConnected = proximityConnected;
    io.emit("hardware_status", hardwareStatus);
    res.json(hardwareStatus);
  });

  app.get("/api/meals", (req, res) => {
    const meals = db.prepare("SELECT * FROM meals WHERE is_deleted = 0").all();
    res.json(meals);
  });

  app.post("/api/meals", (req, res) => {
    const { name, qrCode, dailyGoal } = req.body;
    try {
      // Check if a deleted meal with same name or QR exists
      const existing = db.prepare("SELECT id FROM meals WHERE (name = ? OR qr_code = ?) AND is_deleted = 1").get(name, qrCode) as { id: number } | undefined;
      
      if (existing) {
        db.prepare("UPDATE meals SET name = ?, qr_code = ?, daily_goal = ?, is_deleted = 0 WHERE id = ?")
          .run(name, qrCode, dailyGoal || 0, existing.id);
        return res.json({ id: existing.id, reactivated: true });
      }

      const info = db.prepare("INSERT INTO meals (name, qr_code, daily_goal) VALUES (?, ?, ?)").run(name, qrCode, dailyGoal || 0);
      syncMealsToMariaDB();
      res.json({ id: info.lastInsertRowid });
    } catch (e: any) {
      if (e.message.includes("UNIQUE constraint failed: meals.name")) {
        res.status(400).json({ error: "Menu name already exists" });
      } else if (e.message.includes("UNIQUE constraint failed: meals.qr_code")) {
        res.status(400).json({ error: "QR Code already exists" });
      } else {
        res.status(400).json({ error: "Failed to create meal" });
      }
    }
  });

  app.put("/api/meals/:id", (req, res) => {
    const { name, qrCode, dailyGoal } = req.body;
    try {
      db.prepare("UPDATE meals SET name = ?, qr_code = ?, daily_goal = ? WHERE id = ?")
        .run(name, qrCode, dailyGoal || 0, req.params.id);
      syncMealsToMariaDB();
      res.json({ success: true });
    } catch (e: any) {
      if (e.message.includes("UNIQUE constraint failed: meals.name")) {
        res.status(400).json({ error: "Menu name already exists" });
      } else if (e.message.includes("UNIQUE constraint failed: meals.qr_code")) {
        res.status(400).json({ error: "QR Code already exists" });
      } else {
        res.status(400).json({ error: "Failed to update meal" });
      }
    }
  });

  app.delete("/api/meals/:id", (req, res) => {
    db.prepare("UPDATE meals SET is_deleted = 1 WHERE id = ?").run(req.params.id);
    syncMealsToMariaDB();
    res.json({ success: true });
  });

  app.get("/api/counts/today", (req, res) => {
    const today = format(new Date(), "yyyy-MM-dd");
    const counts = db.prepare(`
      SELECT 
        m.id, 
        m.name, 
        m.qr_code, 
        m.daily_goal,
        COALESCE(c.count, 0) as count,
        (SELECT MAX(timestamp) FROM logs WHERE meal_id = m.id AND date(timestamp) = date('now', 'localtime')) as last_scan_time
      FROM meals m
      LEFT JOIN counts c ON m.id = c.meal_id AND c.date = ?
      WHERE m.is_deleted = 0
    `).all(today);
    res.json(counts);
  });

  app.post("/api/reset", (req, res) => {
    const today = format(new Date(), "yyyy-MM-dd");
    db.prepare("UPDATE counts SET count = 0 WHERE date = ?").run(today);
    io.emit("update");
    res.json({ success: true });
  });

  // Marquee Routes
  app.get("/api/marquee", (req, res) => {
    const messages = db.prepare("SELECT * FROM marquee_messages").all();
    res.json(messages);
  });

  app.post("/api/marquee", (req, res) => {
    const { text, startTime, endTime, repeat, startDate, endDate, speed, color } = req.body;
    const info = db.prepare("INSERT INTO marquee_messages (text, start_time, end_time, repeat, start_date, end_date, speed, color) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run(text, startTime, endTime, repeat || 'daily', startDate || null, endDate || null, speed || 'normal', color || '#000000');
    syncMarqueeToMariaDB();
    res.json({ id: info.lastInsertRowid });
  });

  app.delete("/api/marquee/:id", (req, res) => {
    db.prepare("DELETE FROM marquee_messages WHERE id = ?").run(req.params.id);
    syncMarqueeToMariaDB();
    res.json({ success: true });
  });

  // Settings Routes
  app.get("/api/settings", (req, res) => {
    const settings = db.prepare("SELECT * FROM settings").all();
    const settingsMap = settings.reduce((acc: any, s: any) => {
      acc[s.key] = s.value;
      return acc;
    }, {});
    res.json(settingsMap);
  });

  app.post("/api/settings", (req, res) => {
    const { key, value } = req.body;
    
    // Validation for calibration_ms
    if (key === 'calibration_ms') {
      const val = parseInt(value.toString());
      if (isNaN(val) || val < 0) {
        return res.status(400).json({ error: "Invalid calibration value. Must be a positive number." });
      }
    }

    db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)").run(key, value.toString());
    syncSettingsToMariaDB();
    res.json({ success: true });
  });

  app.post("/api/influxdb/test", async (req, res) => {
    const { url, token, org, bucket } = req.body;
    // Use provided values or fallback to env
    const testUrl = url || process.env.INFLUX_URL;
    const testToken = token || process.env.INFLUX_TOKEN;
    const testOrg = org || process.env.INFLUX_ORG;
    const testBucket = bucket || process.env.INFLUX_BUCKET;

    try {
      const client = new InfluxDB({ url: testUrl, token: testToken });
      const queryApi = client.getQueryApi(testOrg);
      // Simple query to test connection
      await queryApi.queryRaw('buckets()');
      res.json({ success: true });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.post("/api/mariadb/test", async (req, res) => {
    const { host, port, user, password, database } = req.body;
    // Use provided values or fallback to env
    const testHost = host || process.env.MARIADB_HOST;
    const testPort = parseInt(port || process.env.MARIADB_PORT || "3306");
    const testUser = user || process.env.MARIADB_USER;
    const testPassword = password || process.env.MARIADB_PASSWORD;
    const testDatabase = database || process.env.MARIADB_DATABASE;

    let connection;
    try {
      connection = await mysql.createConnection({
        host: testHost,
        port: testPort,
        user: testUser,
        password: testPassword,
        database: testDatabase,
      });
      await connection.ping();
      res.json({ success: true });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    } finally {
      if (connection) await connection.end();
    }
  });

  // Hardware Simulation / Integration Endpoints
  app.post("/api/trigger/proximity", (req, res) => {
    const { status } = req.body; // "activated" or "deactivated"
    const result = processProximity(status as "activated" | "deactivated");
    res.json(result);
  });

  app.post("/api/trigger/scan", (req, res) => {
    const { qrCode } = req.body;
    const result = processScan(qrCode);
    if (result.status === "error") {
      return res.status(404).json(result);
    }
    res.json(result);
  });

  // Serial Port Hardware Integration
  let scannerPort: SerialPort | null = null;
  let espPort: SerialPort | null = null;

  const checkHardwareStatus = async () => {
    try {
      let ports: any[] = [];
      try {
        ports = await SerialPort.list();
        if (ports.length > 0) {
          console.log("Detected Serial Ports:", ports.map(p => `${p.path} (VID:${p.vendorId} PID:${p.productId})`).join(", "));
        }
      } catch (listErr: any) {
        if (listErr.message?.includes('udevadm') || listErr.code === 'ENOENT') {
          console.warn("Hardware Check Warning: 'udevadm' not found. This is expected in some containerized environments.");
          ports = [];
        } else {
          throw listErr;
        }
      }
      
      const scannerPortInfo = ports.find(p => p.vendorId?.toLowerCase() === "05f9" && p.productId?.toLowerCase() === "4204");
      const espPortInfo = ports.find(p => p.vendorId?.toLowerCase() === "10c4" && p.productId?.toLowerCase() === "ea60");

      const mealCount = db.prepare("SELECT COUNT(*) as count FROM meals WHERE is_deleted = 0").get() as { count: number };
      if (mealCount.count === 0) {
        console.warn("DIAGNOSTIC: No active meals found in database. Scans will not be matched.");
      }

      const prevScannerStatus = hardwareStatus.scannerConnected;
      const prevProximityStatus = hardwareStatus.proximityConnected;

      hardwareStatus.scannerConnected = !!scannerPortInfo && (scannerPort?.isOpen || false);
      hardwareStatus.proximityConnected = !!espPortInfo && (espPort?.isOpen || false);

      if (!hardwareStatus.scannerConnected && scannerPortInfo) {
        console.warn(`Scanner port ${scannerPortInfo.path} found but not open. Attempting to open...`);
      }

      // If proximity sensor is disconnected, ensure isMuted is reset
      if (!hardwareStatus.proximityConnected && isMuted) {
        isMuted = false;
        io.emit("status", { isMuted: false });
        console.log("Proximity sensor disconnected: Resetting mute status.");
      }

      // If status changed, emit to clients
      if (prevScannerStatus !== hardwareStatus.scannerConnected || prevProximityStatus !== hardwareStatus.proximityConnected) {
        io.emit("hardware_status", hardwareStatus);
      }

      // Attempt reconnection if disconnected but port is found
      if (scannerPortInfo && (!scannerPort || !scannerPort.isOpen)) {
        initScanner(scannerPortInfo.path);
      }
      if (espPortInfo && (!espPort || !espPort.isOpen)) {
        initESP32(espPortInfo.path);
      }
    } catch (err) {
      console.error("Hardware Check Error:", err);
    }
  };

  const initScanner = (path: string) => {
    if (scannerPort && scannerPort.isOpen) return;
    
    console.log(`Initializing Gryphon Scanner on ${path}...`);
    scannerPort = new SerialPort({ path, baudRate: 9600 });
    
    // Using a more flexible approach to data: listen for any data and buffer it
    let buffer = "";
    scannerPort.on('data', (data: Buffer) => {
      const str = data.toString();
      console.log(`Raw Scanner Data Received: "${str.replace(/\r/g, "\\r").replace(/\n/g, "\\n")}"`);
      buffer += str;
      
      // Process if we see any line ending (\r, \n, or \r\n)
      if (buffer.includes("\r") || buffer.includes("\n")) {
        const codes = buffer.split(/[\r\n]+/);
        // The last element might be an incomplete code if the buffer doesn't end with a delimiter
        buffer = buffer.endsWith("\r") || buffer.endsWith("\n") ? "" : codes.pop() || "";
        
        for (const code of codes) {
          const trimmed = code.trim();
          if (trimmed) {
            console.log(`Scanner Hardware Input (Parsed): ${trimmed}`);
            processScan(trimmed);
          }
        }
      }
    });

    scannerPort.on('open', () => {
      console.log(`Scanner port ${path} is now OPEN.`);
      hardwareStatus.scannerConnected = true;
      io.emit("hardware_status", hardwareStatus);
    });

    scannerPort.on('close', () => {
      console.warn(`Scanner port ${path} CLOSED.`);
      hardwareStatus.scannerConnected = false;
      io.emit("hardware_status", hardwareStatus);
      scannerPort = null;
    });

    scannerPort.on('error', (err) => {
      console.error(`Scanner Port Error on ${path}:`, err);
      hardwareStatus.scannerConnected = false;
      io.emit("hardware_status", hardwareStatus);
    });
  };

  const initESP32 = (path: string) => {
    if (espPort && espPort.isOpen) return;

    console.log(`Initializing ESP32 Sensor on ${path}...`);
    espPort = new SerialPort({ path, baudRate: 115200 });
    const parser = espPort.pipe(new ReadlineParser({ delimiter: '\n' }));
    
    parser.on('data', (data: string) => {
      const signal = data.trim().toLowerCase();
      if (signal === "activated" || signal === "1" || signal === "on") {
        console.log("ESP32 Signal: Activated");
        processProximity("activated");
      } else if (signal === "deactivated" || signal === "0" || signal === "off") {
        console.log("ESP32 Signal: Deactivated");
        processProximity("deactivated");
      }
    });

    espPort.on('open', () => {
      hardwareStatus.proximityConnected = true;
      io.emit("hardware_status", hardwareStatus);
    });

    espPort.on('close', () => {
      hardwareStatus.proximityConnected = false;
      io.emit("hardware_status", hardwareStatus);
      espPort = null;
    });

    espPort.on('error', (err) => {
      console.error("ESP32 Port Error:", err);
      hardwareStatus.proximityConnected = false;
      io.emit("hardware_status", hardwareStatus);
    });
  };

  // Run hardware check periodically
  setInterval(checkHardwareStatus, 5000);
  
  // Initial check
  setTimeout(checkHardwareStatus, 2000);

  app.post("/api/maintenance", (req, res) => {
    const { active } = req.body;
    db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('maintenance_active', ?)").run(active ? "1" : "0");
    io.emit("maintenance_status", { active });
    res.json({ success: true, active });
  });

  app.get("/api/efficiency", (req, res) => {
    const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const recentCount = db.prepare("SELECT COUNT(*) as count FROM logs WHERE timestamp >= ?").get(thirtyMinsAgo) as { count: number };
    const ppm = (recentCount.count / 30).toFixed(2); // Packages Per Minute
    res.json({ ppm, totalRecent: recentCount.count });
  });

  app.get("/api/reports", (req, res) => {
    const { startDate, endDate, startTime, endTime, search } = req.query;
    
    // Default to last 7 days if no dates provided
    let effectiveStartDate = startDate as string;
    let effectiveEndDate = endDate as string;
    
    if (!effectiveStartDate && !effectiveEndDate) {
      const now = new Date();
      effectiveEndDate = format(now, "yyyy-MM-dd");
      effectiveStartDate = format(addDays(now, -7), "yyyy-MM-dd");
    }

    // Base query for summary list
    let summaryQuery = `
      SELECT date(timestamp, 'localtime') as date, m.name as meal_name, COUNT(*) as count
      FROM logs l
      JOIN meals m ON l.meal_id = m.id
      WHERE 1=1
    `;
    
    // Query for hourly throughput (Production Line)
    let hourlyQuery = `
      SELECT strftime('%H:00', timestamp, 'localtime') as hour, COUNT(*) as count
      FROM logs l
      WHERE 1=1
    `;

    const params: any[] = [];

    if (effectiveStartDate) {
      const start = `${effectiveStartDate} ${startTime || "00:00"}:00`;
      summaryQuery += " AND datetime(l.timestamp, 'localtime') >= ?";
      hourlyQuery += " AND datetime(l.timestamp, 'localtime') >= ?";
      params.push(start);
    }
    if (effectiveEndDate) {
      const end = `${effectiveEndDate} ${endTime || "23:59"}:59`;
      summaryQuery += " AND datetime(l.timestamp, 'localtime') <= ?";
      hourlyQuery += " AND datetime(l.timestamp, 'localtime') <= ?";
      params.push(end);
    }

    let summaryParams = [...params];
    if (search) {
      summaryQuery += " AND m.name LIKE ?";
      summaryParams.push(`%${search}%`);
    }

    summaryQuery += " GROUP BY date, meal_name ORDER BY date DESC, meal_name ASC";
    hourlyQuery += " GROUP BY hour ORDER BY hour ASC";

    try {
      const reports = db.prepare(summaryQuery).all(...summaryParams);
      const hourlyData = db.prepare(hourlyQuery).all(...params);
      res.json({ reports, hourlyData });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Daily Reset Logic
  const scheduleReset = () => {
    const now = new Date();
    const tomorrow = startOfDay(addDays(now, 1));
    const msUntilMidnight = tomorrow.getTime() - now.getTime();

    setTimeout(() => {
      console.log("Auto-resetting counters for new day...");
      io.emit("update");
      scheduleReset();
    }, msUntilMidnight);
  };
  scheduleReset();

  // Vite Integration
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Industrial Tracker running at http://localhost:${PORT}`);
  });
}

startServer();
