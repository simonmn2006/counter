export interface Meal {
  id: number;
  name: string;
  qr_code: string;
  count: number;
  daily_goal: number;
  sort_order: number;
  last_scan_time: string | null;
}

export interface Report {
  date: string;
  meal_name: string;
  count: number;
}

export interface HourlyData {
  hour: string;
  count: number;
}

export interface MarqueeMessage {
  id: number;
  text: string;
  start_time: string;
  end_time: string;
  repeat: 'daily' | 'once';
  start_date?: string;
  end_date?: string;
  speed: 'slow' | 'normal' | 'fast';
  color?: string;
}

export interface Settings {
  scanner_id: string;
  proximity_id: string;
  calibration_ms: string;
  op_start?: string;
  op_end?: string;
  influx_url?: string;
  influx_token?: string;
  influx_org?: string;
  influx_bucket?: string;
  influx_enabled?: string;
  mariadb_host?: string;
  mariadb_port?: string;
  mariadb_user?: string;
  mariadb_password?: string;
  mariadb_database?: string;
  mariadb_enabled?: string;
  maintenance_active?: string;
}
