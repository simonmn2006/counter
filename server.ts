import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { createServer as createViteServer } from "vite";
import path from "path";
import Database from "better-sqlite3";
import { format, startOfDay, addDays } from "date-fns";

import { InfluxDB, Point } from "@influxdata/influxdb-client";
import mysql from "mysql2/promise";

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

  const isWithinOperationHours = () => {
    const settings = db.prepare("SELECT key, value FROM settings WHERE key IN ('op_start', 'op_end')").all() as { key: string, value: string }[];
    const opStart = settings.find(s => s.key === 'op_start')?.value || "00:00";
    const opEnd = settings.find(s => s.key === 'op_end')?.value || "23:59";
    
    const now = new Date();
    const currentTime = format(now, "HH:mm");
    
    if (opStart <= opEnd) {
      return currentTime >= opStart && currentTime <= opEnd;
    } else {
      // Over midnight case
      return currentTime >= opStart || currentTime <= opEnd;
    }
  };

  const isMaintenanceActive = () => {
    const setting = db.prepare("SELECT value FROM settings WHERE key = 'maintenance_active'").get() as { value: string } | undefined;
    return setting?.value === "1";
  };

  const sendToInfluxDB = async (mealName: string, count: number) => {
    const settings = db.prepare("SELECT key, value FROM settings WHERE key LIKE 'influx_%'").all() as { key: string, value: string }[];
    const config = settings.reduce((acc: any, s: any) => {
      acc[s.key] = s.value;
      return acc;
    }, {});

    if (config.influx_enabled !== '1' || !config.influx_url || !config.influx_token) return;

    try {
      const client = new InfluxDB({ url: config.influx_url, token: config.influx_token });
      const writeApi = client.getWriteApi(config.influx_org, config.influx_bucket);
      
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
    db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)").run(key, value.toString());
    syncSettingsToMariaDB();
    res.json({ success: true });
  });

  app.post("/api/influxdb/test", async (req, res) => {
    const { url, token, org, bucket } = req.body;
    try {
      const client = new InfluxDB({ url, token });
      const queryApi = client.getQueryApi(org);
      // Simple query to test connection
      await queryApi.queryRaw('buckets()');
      res.json({ success: true });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.post("/api/mariadb/test", async (req, res) => {
    const { host, port, user, password, database } = req.body;
    let connection;
    try {
      connection = await mysql.createConnection({
        host,
        port: parseInt(port || "3306"),
        user,
        password,
        database,
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
      
      return res.json({ status: "pending", delay });
    } else {
      // status === "deactivated" or anything else
      proximityActive = false;
      if (activationTimer) clearTimeout(activationTimer);
      
      if (isMuted) {
        isMuted = false;
        io.emit("status", { isMuted: false });
      }
      
      return res.json({ status: "idle" });
    }
  });

  app.post("/api/trigger/scan", (req, res) => {
    const { qrCode } = req.body;
    
    if (!isWithinOperationHours()) {
      return res.json({ status: "ignored", reason: "outside_operation_hours" });
    }

    if (isMaintenanceActive()) {
      return res.json({ status: "ignored", reason: "maintenance_active" });
    }

    if (isMuted) {
      return res.json({ status: "ignored", reason: "proximity_active" });
    }

    const meal = db.prepare("SELECT id FROM meals WHERE qr_code = ?").get(qrCode) as { id: number } | undefined;
    
    if (!meal) {
      return res.status(404).json({ status: "error", message: "Meal not found" });
    }

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
    res.json({ status: "counted", mealId: meal.id });
  });

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
