-- MariaDB / MySQL Schema for Production Tracker
-- Load this file into phpMyAdmin to set up your database

CREATE DATABASE IF NOT EXISTS production_db;
USE production_db;

-- 1. Assets / Meals Table (Mirrors your menu items)
CREATE TABLE IF NOT EXISTS `meals` (
  `id` INT PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `qr_code` VARCHAR(255) NOT NULL,
  `daily_goal` INT DEFAULT 0,
  `is_deleted` TINYINT(1) DEFAULT 0,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `unique_qr` (`qr_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. Live Production Logs (Every single scan recorded live)
CREATE TABLE IF NOT EXISTS `production_logs` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `menu_name` VARCHAR(255) NOT NULL,
  `qr_code` VARCHAR(255) NOT NULL,
  `daily_count` INT NOT NULL,
  `timestamp` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY `idx_timestamp` (`timestamp`),
  KEY `idx_qr` (`qr_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. Daily Totals (Summary for Reports)
CREATE TABLE IF NOT EXISTS `counts` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `meal_name` VARCHAR(255) NOT NULL,
  `count` INT DEFAULT 0,
  `date` DATE NOT NULL,
  UNIQUE KEY `unique_meal_date` (`meal_name`, `date`),
  KEY `idx_date` (`date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. Ticker / Marquee Messages (Mirrors your scheduled messages)
CREATE TABLE IF NOT EXISTS `marquee_messages` (
  `id` INT PRIMARY KEY,
  `text` TEXT NOT NULL,
  `start_time` VARCHAR(10) NOT NULL,
  `end_time` VARCHAR(10) NOT NULL,
  `repeat_type` VARCHAR(20) DEFAULT 'daily',
  `start_date` DATE DEFAULT NULL,
  `end_date` DATE DEFAULT NULL,
  `speed` VARCHAR(20) DEFAULT 'normal',
  `color` VARCHAR(20) DEFAULT '#000000'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 5. System Settings (Backup of all configuration including InfluxDB data)
CREATE TABLE IF NOT EXISTS `settings` (
  `setting_key` VARCHAR(100) PRIMARY KEY,
  `setting_value` TEXT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
