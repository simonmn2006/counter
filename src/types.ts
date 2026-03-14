export interface Meal {
  id: number;
  name: string;
  qr_code: string;
  count: number;
  daily_goal: number;
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
}
