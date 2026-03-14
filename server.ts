import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { createServer as createViteServer } from "vite";
import path from "path";
import Database from "better-sqlite3";
import { format, startOfDay, addDays } from "date-fns";

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
    INSERT OR IGNORE INTO settings (key, value) VALUES ('maintenance_end', '0');

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
  let muteTimer: NodeJS.Timeout | null = null;
  
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
    const setting = db.prepare("SELECT value FROM settings WHERE key = 'maintenance_end'").get() as { value: string } | undefined;
    const maintenanceEnd = parseInt(setting?.value || "0");
    return Date.now() < maintenanceEnd;
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
    res.json({ id: info.lastInsertRowid });
  });

  app.delete("/api/marquee/:id", (req, res) => {
    db.prepare("DELETE FROM marquee_messages WHERE id = ?").run(req.params.id);
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
    res.json({ success: true });
  });

  // Hardware Simulation / Integration Endpoints
  app.post("/api/trigger/proximity", (req, res) => {
    isMuted = true;
    if (muteTimer) clearTimeout(muteTimer);
    
    const duration = getCalibrationMs();
    io.emit("status", { isMuted: true });
    
    muteTimer = setTimeout(() => {
      isMuted = false;
      io.emit("status", { isMuted: false });
    }, duration);

    res.json({ status: "muted", duration });
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
    
    db.transaction(() => {
      db.prepare(`
        INSERT INTO counts (meal_id, date, count) 
        VALUES (?, ?, 1)
        ON CONFLICT(meal_id, date) DO UPDATE SET count = count + 1
      `).run(meal.id, today);
      
      db.prepare("INSERT INTO logs (meal_id) VALUES (?)").run(meal.id);
    })();

    io.emit("update");
    io.emit("scan", { qrCode, timestamp: new Date() });
    res.json({ status: "counted", mealId: meal.id });
  });

  app.post("/api/maintenance", (req, res) => {
    const { durationMinutes } = req.body;
    const maintenanceEnd = Date.now() + (durationMinutes * 60 * 1000);
    db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('maintenance_end', ?)").run(maintenanceEnd.toString());
    io.emit("maintenance_status", { active: true, endTime: maintenanceEnd });
    
    // Auto-emit end status when time is up
    setTimeout(() => {
      io.emit("maintenance_status", { active: false, endTime: 0 });
    }, durationMinutes * 60 * 1000);

    res.json({ success: true, maintenanceEnd });
  });

  app.get("/api/efficiency", (req, res) => {
    const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const recentCount = db.prepare("SELECT COUNT(*) as count FROM logs WHERE timestamp >= ?").get(thirtyMinsAgo) as { count: number };
    const ppm = (recentCount.count / 30).toFixed(2); // Packages Per Minute
    res.json({ ppm, totalRecent: recentCount.count });
  });

  app.get("/api/reports", (req, res) => {
    const { startDate, endDate, startTime, endTime, search } = req.query;
    
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

    if (startDate) {
      const start = `${startDate} ${startTime || "00:00"}:00`;
      summaryQuery += " AND l.timestamp >= datetime(?, 'utc')";
      hourlyQuery += " AND l.timestamp >= datetime(?, 'utc')";
      params.push(start);
    }
    if (endDate) {
      const end = `${endDate} ${endTime || "23:59"}:59`;
      summaryQuery += " AND l.timestamp <= datetime(?, 'utc')";
      hourlyQuery += " AND l.timestamp <= datetime(?, 'utc')";
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
