import React, { useState, useEffect, useRef } from "react";
import { io } from "socket.io-client";
import { motion, AnimatePresence } from "motion/react";
import { 
  LayoutDashboard, 
  Tv, 
  FileBarChart, 
  Plus, 
  Trash2, 
  RefreshCcw, 
  AlertCircle,
  Package,
  Clock,
  Scan,
  Activity,
  History,
  Settings2,
  ChefHat,
  Utensils,
  Edit3,
  Cpu,
  Printer,
  Search,
  Type as TypeIcon,
  MessageSquare,
  Volume2,
  VolumeX,
  CheckCircle2,
  Target,
  Zap,
  Tally5,
  Database,
  ExternalLink
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import { DayPicker } from "react-day-picker";
import "react-day-picker/dist/style.css";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from "recharts";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { Meal, Report, HourlyData, MarqueeMessage, Settings } from "./types";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const socket = io();

const MEAL_COLORS = [
  "bg-emerald-500",
  "bg-indigo-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-violet-500",
  "bg-cyan-500",
  "bg-orange-500",
  "bg-fuchsia-500",
  "bg-blue-500",
  "bg-lime-500",
];

const THEMES = {
  modern: {
    name: "Modernes Hell",
    bg: "bg-[#F8FAFC]",
    card: "bg-white border-slate-200 shadow-sm hover:shadow-xl",
    text: "text-slate-900",
    muted: "text-slate-500",
    accent: "indigo",
    nav: "bg-slate-100",
    header: "bg-white/80 border-slate-200",
    rounded: "rounded-3xl",
    input: "bg-white text-slate-900 border-slate-200 focus:border-indigo-500",
  },
  cyber: {
    name: "Cyber Dunkel",
    bg: "bg-[#050505]",
    card: "bg-[#0F0F12] border-[#1F1F23] shadow-[0_0_20px_rgba(0,0,0,0.5)] hover:border-cyan-500/50",
    text: "text-white",
    muted: "text-zinc-500",
    accent: "cyan",
    nav: "bg-zinc-900",
    header: "bg-black/80 border-zinc-800",
    rounded: "rounded-2xl",
    input: "bg-[#1A1A1F] text-white border-zinc-800 focus:border-cyan-500",
  },
  brutal: {
    name: "Brutalistisch",
    bg: "bg-white",
    card: "bg-white border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[12px_12px_0px_0px_rgba(0,0,0,1)]",
    text: "text-black",
    muted: "text-black/60",
    accent: "yellow",
    nav: "bg-black/5",
    header: "bg-white border-b-4 border-black",
    rounded: "rounded-none",
    input: "bg-white text-black border-4 border-black focus:bg-yellow-100",
  },
  swiss: {
    name: "Schweizer Minimal",
    bg: "bg-[#F0F0F0]",
    card: "bg-white border-none shadow-none ring-1 ring-black/5 hover:ring-black/20",
    text: "text-black",
    muted: "text-black/40",
    accent: "red",
    nav: "bg-black/5",
    header: "bg-white border-b border-black/10",
    rounded: "rounded-none",
    input: "bg-white text-black border border-black/10 focus:ring-1 focus:ring-black",
  }
};

const CustomDatePicker = ({ 
  value, 
  onChange, 
  label,
  theme 
}: { 
  value: string, 
  onChange: (val: string) => void, 
  label: string,
  theme: any 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const date = value ? parseISO(value) : new Date();

  return (
    <div className="relative space-y-2" onClick={(e) => e.stopPropagation()}>
      <label className="text-[9px] font-bold uppercase tracking-widest opacity-40 ml-1">{label}</label>
      <div className="relative">
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsOpen(!isOpen);
          }}
          className={cn(
            "w-full p-3 border text-xs outline-none transition-all flex items-center justify-between gap-4 min-w-[160px]",
            theme.rounded,
            theme.input
          )}
        >
          <span>{format(date, "dd.MM.yyyy", { locale: de })}</span>
          <Clock size={14} className="opacity-40" />
        </button>
        
        <AnimatePresence>
          {isOpen && (
            <>
              <div 
                className="fixed inset-0 z-[60] bg-transparent cursor-default" 
                onClick={(e) => {
                  e.stopPropagation();
                  setIsOpen(false);
                }} 
              />
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                onClick={(e) => e.stopPropagation()}
                className={cn(
                  "absolute top-full left-0 mt-2 z-[70] p-4 border shadow-2xl min-w-[300px]",
                  theme.rounded,
                  theme.card
                )}
              >
                <DayPicker
                  mode="single"
                  selected={date}
                  onSelect={(d) => {
                    if (d) {
                      onChange(format(d, "yyyy-MM-dd"));
                      setIsOpen(false);
                    }
                  }}
                  locale={de}
                  className="m-0"
                />
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

const CustomTimePicker = ({
  value,
  onChange,
  label,
  theme
}: {
  value: string,
  onChange: (val: string) => void,
  label: string,
  theme: any
}) => {
  const [hours, minutes] = value.split(':');

  const handleHourChange = (h: string) => {
    onChange(`${h.padStart(2, '0')}:${minutes}`);
  };

  const handleMinuteChange = (m: string) => {
    onChange(`${hours}:${m.padStart(2, '0')}`);
  };

  return (
    <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
      <label className="text-[9px] font-bold uppercase tracking-widest opacity-40 ml-1">{label}</label>
      <div className="flex items-center gap-1">
        <select
          value={hours}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => handleHourChange(e.target.value)}
          className={cn("p-3 border text-xs outline-none transition-all appearance-none text-center min-w-[50px] cursor-pointer", theme.rounded, theme.input)}
        >
          {Array.from({ length: 24 }).map((_, i) => (
            <option key={i} value={i.toString().padStart(2, '0')}>
              {i.toString().padStart(2, '0')}
            </option>
          ))}
        </select>
        <span className="font-bold opacity-40">:</span>
        <select
          value={minutes}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => handleMinuteChange(e.target.value)}
          className={cn("p-3 border text-xs outline-none transition-all appearance-none text-center min-w-[50px] cursor-pointer", theme.rounded, theme.input)}
        >
          {Array.from({ length: 60 }).map((_, i) => (
            <option key={i} value={i.toString().padStart(2, '0')}>
              {i.toString().padStart(2, '0')}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};

export default function App() {
  const [view, setView] = useState<"admin" | "counting" | "reports">("counting");
  const [themeKey, setThemeKey] = useState<keyof typeof THEMES>("swiss");
  const [meals, setMeals] = useState<Meal[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [hourlyData, setHourlyData] = useState<HourlyData[]>([]);
  const [marqueeMessages, setMarqueeMessages] = useState<MarqueeMessage[]>([]);
  const [settings, setSettings] = useState<Settings>({
    scanner_id: "USB Scanner 1",
    proximity_id: "ESP32 Sensor A",
    calibration_ms: "3000"
  });
  const [isMuted, setIsMuted] = useState(false);
  const [newMeal, setNewMeal] = useState({ name: "", qrCode: "", dailyGoal: 0 });
  const [editingMeal, setEditingMeal] = useState<Meal | null>(null);
  const [newMarquee, setNewMarquee] = useState<{
    text: string;
    startTime: string;
    endTime: string;
    repeat: 'daily' | 'once';
    startDate: string;
    endDate: string;
    speed: 'slow' | 'normal' | 'fast';
  }>({ 
    text: "", 
    startTime: "00:00", 
    endTime: "23:59",
    repeat: 'daily',
    startDate: format(new Date(), "yyyy-MM-dd"),
    endDate: format(new Date(), "yyyy-MM-dd"),
    speed: 'normal',
    color: '#000000'
  });
  const [adminTab, setAdminTab] = useState<"assets" | "hardware" | "marquee" | "hours" | "influx" | "mariadb">("assets");
  const [influxTestStatus, setInfluxTestStatus] = useState<{ loading: boolean; success?: boolean; error?: string }>({ loading: false });
  const [mariadbTestStatus, setMariadbTestStatus] = useState<{ loading: boolean; success?: boolean; error?: string }>({ loading: false });
  const [error, setError] = useState<string | null>(null);
  const [isHeaderHidden, setIsHeaderHidden] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isIdle, setIsIdle] = useState(true);
  const [isPrinting, setIsPrinting] = useState(false);
  const [isFlashing, setIsFlashing] = useState(false);
  const [efficiency, setEfficiency] = useState({ ppm: "0.00", totalRecent: 0 });
  const [maintenanceStatus, setMaintenanceStatus] = useState<{ active: boolean }>({
    active: false
  });
  const [hardwareStatus, setHardwareStatus] = useState<{
    scannerConnected: boolean;
    proximityConnected: boolean;
  }>({
    scannerConnected: true,
    proximityConnected: true
  });
  const [hardwareAlert, setHardwareAlert] = useState<{
    show: boolean;
    message: string;
  }>({
    show: false,
    message: ""
  });

  // Confirmation Modal State
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    type: 'danger' | 'warning';
  }>({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {},
    type: 'warning'
  });

  // Report Filter State
  const [reportFilters, setReportFilters] = useState({
    startDate: format(new Date(new Date().setDate(new Date().getDate() - 7)), "yyyy-MM-dd"),
    endDate: format(new Date(), "yyyy-MM-dd"),
    startTime: "00:00",
    endTime: "23:59",
    searchQuery: ""
  });

  const currentTheme = THEMES[themeKey];

  // Aggregate reports for the chart (total per date)
  const chartData = Object.values(reports.reduce((acc: any, curr) => {
    if (!acc[curr.date]) {
      acc[curr.date] = { date: curr.date, total_meals: 0 };
    }
    acc[curr.date].total_meals += curr.count;
    return acc;
  }, {})).sort((a: any, b: any) => a.date.localeCompare(b.date));

  const filteredTotal = reports.reduce((acc, curr) => acc + curr.count, 0);
  
  const todayDate = format(new Date(), "yyyy-MM-dd");
  const todayTotal = reports.filter(r => r.date === todayDate).reduce((acc, curr) => acc + curr.count, 0);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let idleTimer: NodeJS.Timeout;

    const resetIdleTimer = () => {
      setIsIdle(false);
      clearTimeout(idleTimer);
      if (view === "counting") {
        idleTimer = setTimeout(() => setIsIdle(true), 30000); // 30 seconds
      }
    };

    if (view === "counting") {
      window.addEventListener("mousemove", resetIdleTimer);
      window.addEventListener("mousedown", resetIdleTimer);
      window.addEventListener("keydown", resetIdleTimer);
      window.addEventListener("touchstart", resetIdleTimer);
      // Start hidden by default as requested
      idleTimer = setTimeout(() => setIsIdle(true), 10000); // 10 seconds default
    } else {
      setIsIdle(false);
    }

    return () => {
      window.removeEventListener("mousemove", resetIdleTimer);
      window.removeEventListener("mousedown", resetIdleTimer);
      window.removeEventListener("keydown", resetIdleTimer);
      window.removeEventListener("touchstart", resetIdleTimer);
      clearTimeout(idleTimer);
    };
  }, [view]);

  const formatDate = (date: Date) => {
    return format(date, "EEEE, dd. MMMM yyyy", { locale: de });
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  const fetchData = async () => {
    try {
      const res = await fetch("/api/counts/today");
      const data = await res.json();
      setMeals(data);
    } catch (err) {
      console.error("Failed to fetch counts", err);
    }
  };

  const fetchReports = async () => {
    try {
      const params = new URLSearchParams({
        startDate: reportFilters.startDate,
        endDate: reportFilters.endDate,
        startTime: reportFilters.startTime,
        endTime: reportFilters.endTime,
        search: reportFilters.searchQuery
      });
      const res = await fetch(`/api/reports?${params.toString()}`);
      const data = await res.json();
      setReports(data.reports);
      setHourlyData(data.hourlyData);
    } catch (err) {
      console.error("Failed to fetch reports", err);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [reportFilters]);

  const fetchMarquee = async () => {
    try {
      const res = await fetch("/api/marquee");
      const data = await res.json();
      setMarqueeMessages(data);
    } catch (err) {
      console.error("Failed to fetch marquee", err);
    }
  };

  const fetchSettings = async () => {
    try {
      const res = await fetch("/api/settings");
      const data = await res.json();
      setSettings(data);
      if (data.maintenance_active !== undefined) {
        setMaintenanceStatus({ active: data.maintenance_active === "1" });
      }
    } catch (err) {
      console.error("Failed to fetch settings", err);
    }
  };

  const fetchHardwareStatus = async () => {
    try {
      const res = await fetch("/api/hardware/status");
      const data = await res.json();
      setHardwareStatus(data);
    } catch (err) {
      console.error("Failed to fetch hardware status", err);
    }
  };

  const fetchEfficiency = async () => {
    try {
      const res = await fetch("/api/efficiency");
      const data = await res.json();
      setEfficiency(data);
    } catch (err) {
      console.error("Failed to fetch efficiency", err);
    }
  };

  // Global Keyboard Scanner Logic (Keyboard Wedge Fallback)
  useEffect(() => {
    let scanBuffer = "";
    let lastKeyTime = Date.now();

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input field
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      const currentTime = Date.now();
      
      // Scanners are much faster than humans
      // If the delay between keys is > 50ms, it's likely a human typing
      if (currentTime - lastKeyTime > 50) {
        scanBuffer = "";
      }
      
      lastKeyTime = currentTime;

      if (e.key === "Enter") {
        if (scanBuffer.length >= 3) {
          console.log("Global Scan Detected:", scanBuffer);
          // Trigger the scan via API to ensure server-side logic runs
          fetch("/api/scan", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ qrCode: scanBuffer })
          }).catch(err => console.error("Global scan failed", err));
        }
        scanBuffer = "";
      } else if (e.key.length === 1) {
        scanBuffer += e.key;
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, []);

  useEffect(() => {
    fetchData();
    fetchReports();
    fetchMarquee();
    fetchSettings();
    fetchHardwareStatus();
    fetchEfficiency();

    const efficiencyInterval = setInterval(fetchEfficiency, 30000); // Every 30s

    socket.on("update", fetchData);
    socket.on("status", (status) => setIsMuted(status.isMuted));
    socket.on("hardware_status", (data) => setHardwareStatus(data));
    socket.on("maintenance_status", (data) => setMaintenanceStatus(data));
    socket.on("scan", (data) => {
      const indicator = document.getElementById('scan-indicator');
      if (indicator) {
        indicator.style.backgroundColor = '#10b981'; // Green
        setTimeout(() => {
          indicator.style.backgroundColor = '#ef4444'; // Red
        }, 500);
      }
    });

    return () => {
      clearInterval(efficiencyInterval);
      socket.off("update");
      socket.off("status");
      socket.off("scan");
      socket.off("hardware_status");
      socket.off("maintenance_status");
    };
  }, []);

  // Hardware Connection Alert Logic
  useEffect(() => {
    const checkHardware = () => {
      if (!hardwareStatus.scannerConnected || !hardwareStatus.proximityConnected) {
        let msg = "Hardware-Warnung: ";
        if (!hardwareStatus.scannerConnected && !hardwareStatus.proximityConnected) {
          msg += "Scanner und Näherungssensor nicht gefunden!";
        } else if (!hardwareStatus.scannerConnected) {
          msg += "QR-Scanner nicht gefunden!";
        } else {
          msg += "Näherungssensor nicht gefunden!";
        }
        
        setHardwareAlert({ show: true, message: msg });
        
        // Hide after 5 seconds
        setTimeout(() => {
          setHardwareAlert(prev => ({ ...prev, show: false }));
        }, 5000);
      }
    };

    // Initial check
    checkHardware();

    // Repeat every 10 seconds if still disconnected
    const interval = setInterval(checkHardware, 10000);
    return () => clearInterval(interval);
  }, [hardwareStatus]);

  const handleAddMeal = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const res = await fetch("/api/meals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newMeal),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create meal");
      setNewMeal({ name: "", qrCode: "", dailyGoal: 0 });
      fetchData();
    } catch (err: any) {
      setError(err.message);
      alert(err.message);
    }
  };

  const handleUpdateMeal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMeal) return;
    setError(null);
    try {
      const res = await fetch(`/api/meals/${editingMeal.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editingMeal.name,
          qrCode: editingMeal.qr_code,
          dailyGoal: editingMeal.daily_goal
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update meal");
      setEditingMeal(null);
      fetchData();
    } catch (err: any) {
      setError(err.message);
      alert(err.message);
    }
  };

  const handleDeleteMeal = async (id: number) => {
    setConfirmModal({
      isOpen: true,
      title: "Asset löschen",
      message: "Sind Sie sicher, dass Sie dieses Menü löschen möchten? Diese Aktion kann nicht rückgängig gemacht werden.",
      type: 'danger',
      onConfirm: async () => {
        await fetch(`/api/meals/${id}`, { method: "DELETE" });
        fetchData();
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleSearchScanner = async () => {
    try {
      if (!('hid' in navigator)) {
        const isIframe = window.self !== window.top;
        if (isIframe) {
          alert("Hardware search is restricted in the preview window. Please open the app in a new tab (icon in top right) to connect via WebHID, or use 'Keyboard Wedge Mode' which works everywhere.");
        } else {
          alert("Your browser does not support the WebHID API. Please use Chrome or Edge, or use 'Keyboard Wedge Mode'.");
        }
        return;
      }
      // @ts-ignore
      const devices = await navigator.hid.requestDevice({ filters: [] });
      if (devices && devices.length > 0) {
        const device = devices[0];
        const name = device.productName || `HID Device (${device.vendorId}:${device.productId})`;
        updateSetting('scanner_id', name);
      }
    } catch (err) {
      console.error("Scanner discovery failed", err);
    }
  };

  const handleSearchProximity = async () => {
    try {
      if (!('serial' in navigator)) {
        const isIframe = window.self !== window.top;
        if (isIframe) {
          alert("Hardware search is restricted in the preview window. Please open the app in a new tab (icon in top right) to connect via Web Serial, or use the Network API (POST to /api/trigger/proximity).");
        } else {
          alert("Your browser does not support the Web Serial API. Please use Chrome or Edge.");
        }
        return;
      }
      // @ts-ignore
      const port = await navigator.serial.requestPort();
      const info = await port.getInfo();
      const name = `Serial Port (VID:${info.usbVendorId}, PID:${info.usbProductId})`;
      updateSetting('proximity_id', name);
      
      // Store for auto-reconnect
      localStorage.setItem('last_serial_vid', info.usbVendorId?.toString() || '');
      localStorage.setItem('last_serial_pid', info.usbProductId?.toString() || '');
    } catch (err) {
      console.error("Serial discovery failed", err);
    }
  };

  // Auto-reconnect Serial if previously paired
  useEffect(() => {
    const autoConnectSerial = async () => {
      if (!('serial' in navigator)) return;
      
      try {
        // @ts-ignore
        const ports = await navigator.serial.getPorts();
        if (ports.length > 0) {
          const lastVid = localStorage.getItem('last_serial_vid');
          const lastPid = localStorage.getItem('last_serial_pid');
          
          const port = ports.find((p: any) => {
            const info = p.getInfo();
            return info.usbVendorId?.toString() === lastVid && info.usbProductId?.toString() === lastPid;
          }) || ports[0];

          const info = await port.getInfo();
          const name = `Serial Port (VID:${info.usbVendorId}, PID:${info.usbProductId})`;
          console.log("Auto-connected to Serial:", name);
          // We don't update setting here to avoid unnecessary DB writes, 
          // but we know it's available.
        }
      } catch (err) {
        console.warn("Serial auto-connect failed", err);
      }
    };

    autoConnectSerial();
  }, []);

  const handleAddMarquee = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newMarquee.text.trim()) {
      setConfirmModal({
        isOpen: true,
        title: "Eingabe erforderlich",
        message: "Bitte geben Sie einen Text für die Ticker-Nachricht ein.",
        type: 'warning',
        onConfirm: () => setConfirmModal(prev => ({ ...prev, isOpen: false }))
      });
      return;
    }

    await fetch("/api/marquee", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newMarquee),
    });
    setNewMarquee({ 
      text: "", 
      startTime: "00:00", 
      endTime: "23:59", 
      repeat: "daily",
      speed: "normal",
      color: "#000000",
      startDate: format(new Date(), "yyyy-MM-dd"),
      endDate: format(new Date(), "yyyy-MM-dd")
    });
    fetchMarquee();
  };

  const handleDeleteMarquee = async (id: number) => {
    setConfirmModal({
      isOpen: true,
      title: "Nachricht löschen",
      message: "Sind Sie sicher, dass Sie diese Ticker-Nachricht löschen möchten?",
      type: 'danger',
      onConfirm: async () => {
        await fetch(`/api/marquee/${id}`, { method: "DELETE" });
        fetchMarquee();
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const [calibrationInput, setCalibrationInput] = useState<string>(settings.calibration_ms);
  const calibrationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setCalibrationInput(settings.calibration_ms);
  }, [settings.calibration_ms]);

  const handleCalibrationChange = (value: string) => {
    setCalibrationInput(value);
    
    if (calibrationTimeoutRef.current) {
      clearTimeout(calibrationTimeoutRef.current);
    }

    calibrationTimeoutRef.current = setTimeout(() => {
      if (value && !isNaN(parseInt(value))) {
        updateSetting('calibration_ms', value);
      }
    }, 500);
  };

  const updateSetting = async (key: keyof Settings, value: string) => {
    await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, value }),
    });
    fetchSettings();
  };

  const handleReset = async () => {
    setConfirmModal({
      isOpen: true,
      title: "Zähler zurücksetzen",
      message: "Alle Zähler für heute zurücksetzen? Dies löscht alle aktuellen Sitzungsdaten.",
      type: 'warning',
      onConfirm: async () => {
        await fetch("/api/reset", { method: "POST" });
        fetchData();
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handlePrint = () => {
    setIsPrinting(true);
    setTimeout(() => {
      window.print();
      setIsPrinting(false);
    }, 100);
  };

  const handleSetMaintenance = async (active: boolean) => {
    try {
      await fetch("/api/maintenance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active }),
      });
    } catch (err) {
      console.error("Failed to set maintenance", err);
    }
  };

  const handleTestInflux = async () => {
    setInfluxTestStatus({ loading: true });
    try {
      const res = await fetch("/api/influxdb/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: settings.influx_url,
          token: settings.influx_token,
          org: settings.influx_org,
          bucket: settings.influx_bucket
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setInfluxTestStatus({ loading: false, success: true });
      } else {
        setInfluxTestStatus({ loading: false, error: data.error });
      }
    } catch (err: any) {
      setInfluxTestStatus({ loading: false, error: err.message });
    }
  };

  const handleTestMariaDB = async () => {
    setMariadbTestStatus({ loading: true });
    try {
      const res = await fetch("/api/mariadb/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          host: settings.mariadb_host,
          port: settings.mariadb_port,
          user: settings.mariadb_user,
          password: settings.mariadb_password,
          database: settings.mariadb_database
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setMariadbTestStatus({ loading: false, success: true });
      } else {
        setMariadbTestStatus({ loading: false, error: data.error });
      }
    } catch (err: any) {
      setMariadbTestStatus({ loading: false, error: err.message });
    }
  };

  return (
    <div className={cn(
      "h-screen flex flex-col transition-colors duration-700 relative overflow-hidden", 
      currentTheme.bg, 
      currentTheme.text, 
      currentTheme.font,
      isIdle && view === "counting" && "cursor-none",
      isPrinting && "bg-white text-black"
    )}>
      {/* Hardware Alert Overlay */}
      <AnimatePresence>
        {hardwareAlert.show && (
          <motion.div 
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className="fixed top-8 left-1/2 -translate-x-1/2 z-[300] w-full max-w-xl px-6"
          >
            <div className="bg-rose-600 text-white p-6 rounded-2xl shadow-2xl flex items-center gap-6 border border-rose-500/20 backdrop-blur-md">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center animate-pulse">
                <Cpu size={24} className="text-white" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-bold uppercase tracking-widest mb-1">Hardware-Verbindungsfehler</h3>
                <p className="text-xs opacity-90 font-medium">{hardwareAlert.message}</p>
              </div>
              <div className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {confirmModal.isOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className={cn(
                "max-w-md w-full p-10 border shadow-2xl overflow-hidden relative",
                currentTheme.rounded,
                currentTheme.card
              )}
            >
              <div className={cn(
                "absolute top-0 left-0 w-full h-1",
                confirmModal.type === 'danger' ? "bg-rose-500" : "bg-amber-500"
              )} />
              
              <div className="flex items-center gap-4 mb-6">
                <div className={cn(
                  "w-12 h-12 flex items-center justify-center rounded-2xl",
                  confirmModal.type === 'danger' ? "bg-rose-500/10 text-rose-500" : "bg-amber-500/10 text-amber-500"
                )}>
                  <AlertCircle size={24} />
                </div>
                <h3 className="text-xl font-bold tracking-tight">{confirmModal.title}</h3>
              </div>
              
              <p className="text-sm opacity-60 leading-relaxed mb-10">
                {confirmModal.message}
              </p>
              
              <div className="flex gap-4">
                <button 
                  onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                  className={cn(
                    "flex-1 py-4 font-bold text-[10px] uppercase tracking-widest border border-current/10 hover:bg-current/5 transition-all",
                    currentTheme.rounded
                  )}
                >
                  Abbrechen
                </button>
                <button 
                  onClick={confirmModal.onConfirm}
                  className={cn(
                    "flex-1 py-4 font-bold text-[10px] uppercase tracking-widest text-white transition-all shadow-lg",
                    confirmModal.type === 'danger' ? "bg-rose-600 hover:bg-rose-700 shadow-rose-500/20" : "bg-amber-600 hover:bg-amber-700 shadow-amber-500/20",
                    currentTheme.rounded
                  )}
                >
                  Bestätigen
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {themeKey === 'cyber' && (
        <div className="fixed inset-0 pointer-events-none z-[100] opacity-[0.03]" 
             style={{ background: 'linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06))', backgroundSize: '100% 2px, 3px 100%' }} />
      )}
      {/* Premium Header */}
      <AnimatePresence>
        {(!isHeaderHidden || view !== "counting") && (
          <motion.header 
            initial={{ y: -120, opacity: 0 }}
            animate={{ 
              y: isIdle && view === "counting" ? -120 : 0, 
              opacity: isIdle && view === "counting" ? 0 : 1 
            }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className={cn("fixed top-0 left-0 right-0 z-50 border-b px-8 py-6 backdrop-blur-md", currentTheme.header)}
          >
            <div className="max-w-[1600px] mx-auto flex items-center justify-between">
              <div className={cn("flex items-center gap-6 transition-all duration-700", view === "counting" && "opacity-0 pointer-events-none")}>
                <div className={cn(
                  "w-12 h-12 flex items-center justify-center transition-all duration-700",
                  themeKey === 'cyber' ? "bg-cyan-500 text-black shadow-lg shadow-cyan-500/20 rounded-xl" : 
                  themeKey === 'brutal' ? "bg-black text-white border-2 border-black rounded-none" : 
                  themeKey === 'swiss' ? "bg-red-600 text-white rounded-none" :
                  "bg-indigo-600 text-white rounded-2xl shadow-xl shadow-indigo-200"
                )}>
                  <Tally5 size={26} />
                </div>
                <div>
                  <h1 className={cn(
                    "text-2xl font-bold tracking-tight transition-all duration-700",
                    currentTheme.text
                  )}>
                    gourmetta Zähler
                  </h1>
                  <div className="flex items-center gap-2 mt-0.5">
                    <div className={cn(
                      "w-1.5 h-1.5 rounded-full", 
                      isMuted ? "bg-rose-500 animate-pulse" : "bg-emerald-500"
                    )} />
                    <span className={cn(
                      "text-[9px] font-bold uppercase tracking-[0.2em] opacity-40",
                      currentTheme.muted
                    )}>
                      {isMuted ? "Sensor Stummgeschaltet" : "System Aktiv"}
                    </span>
                  </div>
                </div>
              </div>

              <nav className={cn(
                "hidden lg:flex p-1 transition-all duration-700", 
                currentTheme.nav,
                currentTheme.rounded
              )}>
                <NavButton theme={currentTheme} themeKey={themeKey} active={view === "counting"} onClick={() => setView("counting")} icon={<Tv size={18} />} label="Live-Ansicht" />
                <NavButton theme={currentTheme} themeKey={themeKey} active={view === "admin"} onClick={() => setView("admin")} icon={<Settings2 size={18} />} label="Konfig" />
                <NavButton theme={currentTheme} themeKey={themeKey} active={view === "reports"} onClick={() => setView("reports")} icon={<FileBarChart size={18} />} label="Berichte" />
              </nav>

              <div className={cn("flex items-center gap-6 transition-all duration-700", view === "counting" && "opacity-0 pointer-events-none")}>
                <div className={cn(
                  "flex p-1 gap-1 transition-all duration-700",
                  "bg-black/5",
                  currentTheme.rounded
                )}>
                  {Object.keys(THEMES).map((k) => (
                    <button
                      key={k}
                      onClick={() => setThemeKey(k as keyof typeof THEMES)}
                      className={cn(
                        "px-3 py-1 text-[9px] font-bold uppercase transition-all whitespace-nowrap",
                        themeKey === k 
                          ? "bg-white text-black shadow-sm" 
                          : "opacity-30 hover:opacity-100",
                        currentTheme.rounded
                      )}
                    >
                      {k}
                    </button>
                  ))}
                </div>
                <button 
                  onClick={toggleFullscreen}
                  className={cn(
                    "flex items-center gap-2 px-5 py-2.5 text-[10px] font-bold uppercase tracking-widest transition-all duration-500",
                    "bg-black/5 hover:bg-cyan-50 hover:text-cyan-600",
                    currentTheme.rounded
                  )}
                  title="Vollbild umschalten"
                >
                  <Target size={14} />
                  Vollbild
                </button>
                <button 
                  onClick={handleReset}
                  className={cn(
                    "flex items-center gap-2 px-5 py-2.5 text-[10px] font-bold uppercase tracking-widest transition-all duration-500",
                    "hover:text-rose-600 bg-black/5 hover:bg-rose-50",
                    currentTheme.rounded
                  )}
                >
                  <RefreshCcw size={14} />
                  Zurücksetzen
                </button>
              </div>
            </div>
          </motion.header>
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      <main className={cn(
        "flex-1 max-w-[1600px] w-full mx-auto p-8 overflow-hidden flex flex-col transition-all duration-700",
        !isIdle || view !== "counting" ? "pt-32" : "pt-8"
      )}>
        <AnimatePresence mode="wait">
          {view === "counting" && (
            <motion.div 
              key="counting"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex-1 flex flex-col min-h-0 space-y-6"
            >
              {/* Central Date & Time Display */}
              <div className="flex flex-col items-center justify-center py-4 text-center shrink-0">
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="space-y-2"
                >
                  <p className={cn(
                    "text-xl font-bold uppercase tracking-[0.6em] opacity-40",
                    "font-mono"
                  )}>
                    {formatDate(currentTime)}
                  </p>
                  <h2 className={cn(
                    "text-7xl lg:text-8xl xl:text-9xl font-black tracking-tighter transition-all duration-700 leading-none",
                    "text-slate-900"
                  )}>
                    {formatTime(currentTime)}
                  </h2>

                  {/* Efficiency Badge */}
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn(
                      "mt-4 px-4 py-1.5 border inline-flex items-center gap-3 mx-auto",
                      currentTheme.rounded,
                      "bg-white/50 backdrop-blur-sm border-black/5"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <Activity size={14} className="text-emerald-500" />
                      <span className="text-[10px] font-bold uppercase tracking-widest opacity-60">Durchsatz:</span>
                      <span className="text-xs font-mono font-bold">{efficiency.ppm} PPM</span>
                    </div>
                    <div className="w-px h-3 bg-black/10" />
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-widest opacity-60">Letzte 30m:</span>
                      <span className="text-xs font-mono font-bold">{efficiency.totalRecent}</span>
                    </div>
                  </motion.div>

                  <div className={cn(
                    "flex items-center justify-center gap-4 pt-4 transition-all duration-700",
                    isIdle ? "opacity-0 pointer-events-none translate-y-4" : "opacity-100 translate-y-0"
                  )}>
                    <button
                      onClick={() => setIsHeaderHidden(!isHeaderHidden)}
                      className={cn(
                        "px-6 py-2 text-[10px] font-bold uppercase tracking-[0.3em] transition-all duration-500 flex items-center gap-3",
                        "bg-black/5 hover:bg-black/10 shadow-sm",
                        currentTheme.rounded
                      )}
                    >
                      {isHeaderHidden ? <Tv size={14} /> : <Settings2 size={14} />}
                      {isHeaderHidden ? "Steuerung anzeigen" : "Steuerung ausblenden"}
                    </button>
                    <button
                      onClick={toggleFullscreen}
                      className={cn(
                        "px-6 py-2 text-[10px] font-bold uppercase tracking-[0.3em] transition-all duration-500 flex items-center gap-3",
                        "bg-black/5 hover:bg-black/10 shadow-sm",
                        currentTheme.rounded
                      )}
                    >
                      <Scan size={14} />
                      Vollbild
                    </button>
                  </div>
                </motion.div>
              </div>

              <div className="flex-1 min-h-0">
                <div className={cn(
                  "grid gap-4 h-full",
                  meals.length <= 4 ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-4 grid-rows-1" : 
                  meals.length <= 8 ? "grid-cols-2 lg:grid-cols-4 grid-rows-2" :
                  "grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 grid-rows-auto"
                )}>
                {meals.map((meal, idx) => {
                  const goalMet = meal.daily_goal > 0 && meal.count >= meal.daily_goal;
                  return (
                    <motion.div 
                      layout
                      key={meal.id} 
                      className={cn(
                        "group relative p-6 border transition-all duration-700 overflow-hidden flex flex-col justify-between h-full", 
                        currentTheme.rounded, 
                        currentTheme.card
                      )}
                    >
                      <div className={cn("absolute top-0 right-0 w-32 h-32 -mr-8 -mt-8 rounded-full opacity-5 blur-2xl transition-opacity group-hover:opacity-10", MEAL_COLORS[idx % MEAL_COLORS.length])} />
                      
                      <div className="flex justify-center items-start relative z-10">
                        <h3 className={cn(
                          "text-xl lg:text-2xl font-bold tracking-tight transition-all duration-700 group-hover:translate-x-1 line-clamp-1 text-center",
                          currentTheme.text
                        )}>{meal.name}</h3>
                      </div>

                        <div className="flex-1 flex flex-col justify-center items-center py-2 relative z-10">
                          <div className="flex items-end gap-3">
                            <span className={cn(
                              "text-6xl lg:text-7xl font-black tracking-tighter leading-none transition-all duration-700",
                              goalMet ? "text-emerald-500" : "text-slate-900"
                            )}>{meal.count}</span>
                            <div className="flex flex-col mb-1">
                              <span className="text-[8px] font-bold opacity-30 uppercase tracking-[0.2em]">Einheiten</span>
                            </div>
                          </div>
                          
                          {meal.daily_goal > 0 && (
                            <div className="mt-6 flex flex-col items-center gap-2 w-full">
                              <div className="flex items-center gap-2 opacity-60">
                                <Target size={16} className="text-cyan-500" />
                                <span className="text-base font-black uppercase tracking-widest">Ziel: {meal.daily_goal}</span>
                                {goalMet && <CheckCircle2 size={16} className="text-emerald-500" />}
                              </div>
                              
                              {!goalMet && (
                                <div className="mt-4 p-4 bg-amber-500/10 rounded-2xl border border-amber-500/20 w-full flex flex-col items-center">
                                  <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-amber-600 mb-1">Noch offen</span>
                                  <span className="text-5xl font-black text-amber-600 tracking-tighter">
                                    {meal.daily_goal - meal.count}
                                  </span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                      <div className="pt-4 border-t border-current/5 flex items-center justify-between relative z-10">
                        <div className="flex -space-x-2">
                          {[...Array(Math.min(3, meal.count))].map((_, i) => (
                            <div key={i} className={cn(
                              "w-6 h-6 rounded-full border-2 border-white transition-transform hover:scale-110", 
                              MEAL_COLORS[idx % MEAL_COLORS.length]
                            )} />
                          ))}
                          {meal.count > 3 && (
                            <div className={cn(
                              "w-6 h-6 rounded-full border-2 border-white flex items-center justify-center text-[8px] font-bold",
                              "bg-black/5 text-black/40"
                            )}>
                              +{meal.count - 3}
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col items-end">
                          <span className={cn(
                            "text-[8px] font-bold uppercase tracking-[0.2em]",
                            "text-cyan-600"
                          )}>
                            {meal.last_scan_time ? new Date(meal.last_scan_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Kein Scan"}
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
                </div>
              </div>

              {/* Marquee Footer */}
              <div className="shrink-0 space-y-4">
                <div className={cn(
                  "h-12 overflow-hidden flex items-center relative border-y border-current/5",
                  "bg-black/5"
                )}>
                  <div className={cn(
                    "whitespace-nowrap flex py-2 w-full",
                    marqueeMessages.length > 0 ? (
                      marqueeMessages[0].speed === 'slow' ? "animate-marquee-slow" : 
                      marqueeMessages[0].speed === 'fast' ? "animate-marquee-fast" : "animate-marquee-normal"
                    ) : "animate-marquee-normal"
                  )}>
                    {marqueeMessages
                      .filter(msg => {
                        const now = new Date();
                        const timeStr = now.getHours().toString().padStart(2, '0') + ":" + now.getMinutes().toString().padStart(2, '0');
                        const dateStr = format(now, "yyyy-MM-dd");
                        
                        const isTimeActive = timeStr >= msg.start_time && timeStr <= msg.end_time;
                        const isDateActive = msg.repeat === 'daily' || (msg.start_date && msg.end_date && dateStr >= msg.start_date && dateStr <= msg.end_date);
                        
                        return isTimeActive && isDateActive;
                      })
                      .map((msg, i) => (
                        <span 
                          key={i} 
                          className="mx-12 text-sm font-bold uppercase tracking-[0.2em]"
                          style={{ color: msg.color || 'inherit' }}
                        >
                          {msg.text}
                        </span>
                      ))}
                    {marqueeMessages.length === 0 && (
                      <span className="mx-12 text-sm font-bold uppercase tracking-[0.2em] opacity-30">
                        System Betriebsbereit • Qualitätskontrolle Aktiv • Sicherheit Zuerst
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {view === "admin" && (
            <motion.div 
              key="admin"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="max-w-6xl mx-auto w-full overflow-y-auto pr-2 custom-scrollbar pb-20"
            >
              <div className="flex items-center justify-between mb-12">
                <div>
                  <h2 className={cn(
                    "text-5xl font-black tracking-tighter transition-all duration-700",
                    "text-slate-900"
                  )}>Systemkonfiguration</h2>
                  <p className={cn(
                    "text-[10px] uppercase tracking-[0.3em] font-bold mt-3 opacity-40",
                    currentTheme.muted
                  )}>Hardware- & Bestandsverwaltungs-Kontrollzentrum</p>
                </div>
                <div className="flex gap-2">
                  {(['assets', 'hardware', 'marquee', 'hours', 'influx', 'mariadb'] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setAdminTab(tab)}
                      className={cn(
                        "px-6 py-3 text-[10px] font-bold uppercase tracking-widest transition-all duration-300",
                        adminTab === tab 
                          ? ("bg-cyan-500 text-white shadow-lg shadow-cyan-500/20") 
                          : "bg-black/5 hover:bg-black/10 opacity-50 hover:opacity-100",
                        currentTheme.rounded
                      )}
                    >
                      {tab === 'assets' ? 'Bestände' : tab === 'hardware' ? 'Hardware' : tab === 'marquee' ? 'Ticker' : tab === 'hours' ? 'Betriebszeiten' : tab === 'influx' ? 'InfluxDB' : 'MariaDB'}
                    </button>
                  ))}
                </div>
              </div>

              {adminTab === 'hours' && (
                <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
                  <div className={cn(
                    "p-12 border transition-all duration-700",
                    currentTheme.rounded,
                    currentTheme.card
                  )}>
                    <div className="flex items-center gap-4 mb-12">
                      <div className="w-12 h-12 flex items-center justify-center bg-cyan-500 text-white rounded-2xl shadow-lg">
                        <Clock size={24} />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold">Täglich Betriebszeiten</h3>
                        <p className="text-[10px] opacity-40 uppercase tracking-widest mt-1">Zeitraum in dem der Zähler aktiv ist</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                      <div className="space-y-8">
                        <CustomTimePicker
                          label="Start der Zählung"
                          value={settings.op_start || "06:00"}
                          onChange={(val) => updateSetting('op_start', val)}
                          theme={currentTheme}
                        />
                        <p className="text-xs opacity-50 leading-relaxed">
                          Geben Sie die Uhrzeit ein, zu der das System jeden Tag mit der Zählung beginnen soll. 
                          Scans vor dieser Zeit werden ignoriert.
                        </p>
                      </div>

                      <div className="space-y-8">
                        <CustomTimePicker
                          label="Ende der Zählung"
                          value={settings.op_end || "20:00"}
                          onChange={(val) => updateSetting('op_end', val)}
                          theme={currentTheme}
                        />
                        <p className="text-xs opacity-50 leading-relaxed">
                          Geben Sie die Uhrzeit ein, zu der das System die Zählung beenden soll. 
                          Scans nach dieser Zeit werden ignoriert.
                        </p>
                      </div>
                    </div>

                    <div className="mt-12 pt-12 border-t border-black/5">
                      <div className="flex items-start gap-4 p-6 bg-cyan-50 rounded-2xl border border-cyan-100">
                        <Activity className="text-cyan-600 mt-1" size={20} />
                        <div>
                          <h4 className="text-sm font-bold text-cyan-900">Automatischer Tagesabschluss</h4>
                          <p className="text-xs text-cyan-700 mt-1 leading-relaxed">
                            Das System setzt die Zählerstände jeden Tag um Mitternacht automatisch zurück. 
                            Die Betriebszeiten steuern lediglich die Aktivität der Sensoren während des Tages.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {adminTab === 'assets' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
                  <div className="lg:col-span-4">
                    <form onSubmit={editingMeal ? handleUpdateMeal : handleAddMeal} className={cn("p-10 border shadow-sm sticky top-32 transition-all duration-700", currentTheme.rounded, currentTheme.card)}>
                      <h3 className="text-xl font-bold mb-8 flex items-center gap-3">
                        {editingMeal ? <Edit3 size={24} /> : <Plus size={24} />} {editingMeal ? "Asset aktualisieren" : "Asset registrieren"}
                      </h3>
                      <div className="space-y-6">
                        <div className="space-y-2">
                          <label className="text-[9px] font-bold uppercase tracking-[0.2em] opacity-40 ml-1">Asset-Name</label>
                          <input 
                            required
                            value={editingMeal ? editingMeal.name : newMeal.name}
                            onChange={e => editingMeal ? setEditingMeal({...editingMeal, name: e.target.value}) : setNewMeal({...newMeal, name: e.target.value})}
                            className={cn(
                              "w-full bg-current/5 border border-current/10 p-4 outline-none transition-all",
                              "rounded-xl focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
                            )}
                            placeholder="z.B. Signatur Trüffel Pasta"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[9px] font-bold uppercase tracking-[0.2em] opacity-40 ml-1">Kennung (QR)</label>
                          <input 
                            required
                            value={editingMeal ? editingMeal.qr_code : newMeal.qrCode}
                            onChange={e => editingMeal ? setEditingMeal({...editingMeal, qr_code: e.target.value}) : setNewMeal({...newMeal, qrCode: e.target.value})}
                            className={cn(
                              "w-full bg-current/5 border border-current/10 p-4 outline-none transition-all font-mono",
                              "rounded-xl focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
                            )}
                            placeholder="ASSET_001"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[9px] font-bold uppercase tracking-[0.2em] opacity-40 ml-1">Tagesziel</label>
                          <input 
                            type="number"
                            value={editingMeal ? editingMeal.daily_goal : newMeal.dailyGoal}
                            onChange={e => editingMeal ? setEditingMeal({...editingMeal, daily_goal: parseInt(e.target.value) || 0}) : setNewMeal({...newMeal, dailyGoal: parseInt(e.target.value) || 0})}
                            className={cn(
                              "w-full bg-current/5 border border-current/10 p-4 outline-none transition-all",
                              "rounded-xl focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
                            )}
                            placeholder="0 (Unbegrenzt)"
                          />
                        </div>
                        <div className="flex gap-2">
                          <button type="submit" className={cn(
                            "flex-1 font-bold py-5 transition-all duration-500 mt-4 flex items-center justify-center gap-2",
                            "bg-cyan-600 text-white rounded-xl shadow-lg shadow-cyan-500/20 hover:bg-cyan-700"
                          )}>
                            {editingMeal ? "Registrierung aktualisieren" : "In Registrierung speichern"}
                          </button>
                          {editingMeal && (
                            <button 
                              type="button"
                              onClick={() => setEditingMeal(null)}
                              className={cn("px-6 py-5 mt-4 border font-bold", currentTheme.rounded)}
                            >
                              Abbrechen
                            </button>
                          )}
                        </div>
                        {error && <p className="text-rose-600 text-[10px] font-bold uppercase text-center mt-2">{error}</p>}
                      </div>
                    </form>
                  </div>

                  <div className="lg:col-span-8 space-y-6">
                    {meals.map((meal, idx) => (
                      <div key={meal.id} className={cn(
                        "p-8 border flex items-center justify-between group transition-all duration-700", 
                        currentTheme.rounded, 
                        currentTheme.card,
                        themeKey === 'prestige' && "border-b border-stone-50"
                      )}>
                        <div className="flex items-center gap-8">
                          <div className={cn(
                            "w-16 h-16 flex items-center justify-center transition-all duration-700",
                            themeKey === 'prestige' ? "bg-stone-50 text-stone-900" : 
                            themeKey === 'terminal' ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20" :
                            `${MEAL_COLORS[idx % MEAL_COLORS.length]} text-white rounded-2xl shadow-lg`
                          )}>
                            <Package size={28} strokeWidth={themeKey === 'prestige' ? 1 : 2} />
                          </div>
                          <div>
                            <h4 className={cn(
                              "text-xl font-bold transition-all duration-700",
                              currentTheme.text
                            )}>{meal.name}</h4>
                            <div className="flex items-center gap-4 mt-1">
                              <p className={cn(
                                "text-[10px] opacity-40 uppercase tracking-[0.2em]",
                                "font-mono"
                              )}>{meal.qr_code}</p>
                              {meal.daily_goal > 0 && (
                                <span className="text-[9px] font-bold text-emerald-500 uppercase tracking-widest">Ziel: {meal.daily_goal}</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => setEditingMeal(meal)}
                            className={cn(
                              "p-4 transition-all duration-500",
                              "opacity-30 hover:opacity-100 hover:text-cyan-600 hover:bg-cyan-50 rounded-2xl"
                            )}
                          >
                            <Edit3 size={24} strokeWidth={2} />
                          </button>
                          <button 
                            onClick={() => handleDeleteMeal(meal.id)}
                            className={cn(
                              "p-4 transition-all duration-500",
                              "opacity-30 hover:opacity-100 hover:text-rose-600 hover:bg-rose-50 rounded-2xl"
                            )}
                          >
                            <Trash2 size={24} strokeWidth={2} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {adminTab === 'hardware' && (
                <div className="space-y-12">
                  {/* Raspberry Pi Native Hardware Status */}
                  <div className={cn(
                    "p-12 border transition-all duration-700",
                    currentTheme.rounded,
                    currentTheme.card
                  )}>
                    <div className="flex items-center gap-4 mb-12">
                      <div className="w-12 h-12 flex items-center justify-center bg-indigo-600 text-white rounded-2xl shadow-lg">
                        <Cpu size={24} />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold">Raspberry Pi Native Hardware</h3>
                        <p className="text-[10px] opacity-40 uppercase tracking-widest mt-1">Direct Server-Side Integration</p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      {/* Scanner Status */}
                      <div className={cn(
                        "p-8 border flex items-center justify-between transition-all duration-500",
                        currentTheme.rounded,
                        hardwareStatus.scannerConnected ? "bg-emerald-50 border-emerald-100" : "bg-rose-50 border-rose-100"
                      )}>
                        <div className="flex items-center gap-6">
                          <div className={cn(
                            "w-12 h-12 flex items-center justify-center rounded-xl shadow-sm",
                            hardwareStatus.scannerConnected ? "bg-emerald-500 text-white" : "bg-rose-500 text-white"
                          )}>
                            <Scan size={24} />
                          </div>
                          <div>
                            <h4 className={cn("font-bold", hardwareStatus.scannerConnected ? "text-emerald-900" : "text-rose-900")}>
                              Gryphon Scanner
                            </h4>
                            <p className={cn("text-[10px] uppercase tracking-widest opacity-60", hardwareStatus.scannerConnected ? "text-emerald-700" : "text-rose-700")}>
                              {hardwareStatus.scannerConnected ? "Connected (05f9:4204)" : "Not Detected"}
                            </p>
                          </div>
                        </div>
                        {hardwareStatus.scannerConnected ? (
                          <div className="flex items-center gap-2 text-emerald-600 font-bold text-[10px] uppercase tracking-widest">
                            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            Live
                          </div>
                        ) : (
                          <div className="text-rose-600 font-bold text-[10px] uppercase tracking-widest">Offline</div>
                        )}
                      </div>

                      {/* ESP32 Status */}
                      <div className={cn(
                        "p-8 border flex flex-col gap-6 transition-all duration-500",
                        currentTheme.rounded,
                        hardwareStatus.proximityConnected ? "bg-emerald-50 border-emerald-100" : "bg-rose-50 border-rose-100"
                      )}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-6">
                            <div className={cn(
                              "w-12 h-12 flex items-center justify-center rounded-xl shadow-sm",
                              hardwareStatus.proximityConnected ? "bg-emerald-500 text-white" : "bg-rose-500 text-white"
                            )}>
                              <Activity size={24} />
                            </div>
                            <div>
                              <h4 className={cn("font-bold", hardwareStatus.proximityConnected ? "text-emerald-900" : "text-rose-900")}>
                                ESP32 Sensor
                              </h4>
                              <p className={cn("text-[10px] uppercase tracking-widest opacity-60", hardwareStatus.proximityConnected ? "text-emerald-700" : "text-rose-700")}>
                                {hardwareStatus.proximityConnected ? "Connected (10c4:ea60)" : "Not Detected"}
                              </p>
                            </div>
                          </div>
                          {hardwareStatus.proximityConnected ? (
                            <div className="flex items-center gap-2 text-emerald-600 font-bold text-[10px] uppercase tracking-widest">
                              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                              Live
                            </div>
                          ) : (
                            <div className="text-rose-600 font-bold text-[10px] uppercase tracking-widest">Offline</div>
                          )}
                        </div>

                        <div className="pt-6 border-t border-black/5 space-y-3">
                          <label className={cn(
                            "text-[9px] font-bold uppercase tracking-widest opacity-60",
                            hardwareStatus.proximityConnected ? "text-emerald-900" : "text-rose-900"
                          )}>
                            Zeit-Kalibrierung (ms)
                          </label>
                          <div className="flex gap-4 items-center">
                            <input
                              type="number"
                              className={cn(
                                "flex-1 p-3 text-xs border outline-none transition-all text-slate-900", 
                                currentTheme.rounded,
                                hardwareStatus.proximityConnected ? "bg-white border-emerald-200 focus:border-emerald-500" : "bg-white border-rose-200 focus:border-rose-500"
                              )}
                              value={calibrationInput}
                              onChange={(e) => handleCalibrationChange(e.target.value)}
                              onBlur={() => {
                                if (calibrationInput !== settings.calibration_ms) {
                                  updateSetting('calibration_ms', calibrationInput);
                                }
                              }}
                            />
                            <div className="flex items-center gap-2 px-3 py-2 bg-black/5 rounded-lg">
                              <div className={cn(
                                "w-1.5 h-1.5 rounded-full animate-pulse",
                                calibrationInput === settings.calibration_ms ? "bg-emerald-500" : "bg-amber-500"
                              )} />
                              <span className="text-[8px] font-bold uppercase tracking-widest">
                                {calibrationInput === settings.calibration_ms ? "Sync" : "Saving..."}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-8 p-6 bg-slate-50 border border-slate-200 rounded-2xl">
                      <p className="text-xs text-slate-600 leading-relaxed">
                        <strong className="text-slate-900">Note:</strong> These devices are managed directly by the Raspberry Pi server. 
                        If they are connected but show as "Not Detected", please ensure they are plugged in and restart the application service via PM2.
                      </p>
                    </div>
                  </div>

                  {/* Maintenance Mode Section */}
                  <div className={cn(
                    "p-12 border transition-all duration-700",
                    currentTheme.rounded,
                    currentTheme.card
                  )}>
                    <div className="flex items-center gap-4 mb-12">
                      <div className="w-12 h-12 flex items-center justify-center bg-amber-500 text-white rounded-2xl shadow-lg">
                        <Zap size={24} />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold">Wartungsmodus</h3>
                        <p className="text-[10px] opacity-40 uppercase tracking-widest mt-1">Sensoren vorübergehend deaktivieren</p>
                      </div>
                    </div>

                    {maintenanceStatus.active ? (
                      <div className="bg-amber-50 border border-amber-200 p-8 rounded-3xl flex items-center justify-between">
                        <div className="flex items-center gap-6">
                          <div className="w-4 h-4 rounded-full bg-amber-500 animate-pulse" />
                          <div>
                            <span className="text-xl font-bold text-amber-900 block">
                              Wartung aktiv
                            </span>
                            <span className="text-sm text-amber-700 opacity-70">
                              Sensoren sind vorübergehend deaktiviert
                            </span>
                          </div>
                        </div>
                        <button 
                          onClick={() => handleSetMaintenance(false)}
                          className={cn(
                            "px-8 py-4 bg-amber-600 text-white font-bold uppercase tracking-widest transition-all hover:bg-amber-700",
                            currentTheme.rounded
                          )}
                        >
                          Wartung Beenden
                        </button>
                      </div>
                    ) : (
                      <div className="flex justify-center">
                        <button
                          onClick={() => handleSetMaintenance(true)}
                          className={cn(
                            "w-full max-w-md p-8 border-2 border-dashed border-amber-500/30 text-amber-600 font-bold uppercase tracking-[0.2em] transition-all",
                            "hover:bg-amber-500 hover:text-white hover:border-amber-500 hover:border-solid",
                            currentTheme.rounded
                          )}
                        >
                          Wartungsmodus Aktivieren
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {adminTab === 'influx' && (
                <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
                  <div className={cn(
                    "p-12 border transition-all duration-700",
                    currentTheme.rounded,
                    currentTheme.card
                  )}>
                    <div className="flex items-center justify-between mb-12">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 flex items-center justify-center bg-indigo-500 text-white rounded-2xl shadow-lg">
                          <Database size={24} />
                        </div>
                        <div>
                          <h3 className="text-xl font-bold">InfluxDB 2.0 Integration</h3>
                          <p className="text-[10px] opacity-40 uppercase tracking-widest mt-1">Live-Datenübertragung an Zeitreihendatenbank</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] font-bold uppercase tracking-widest opacity-40">Status:</span>
                        <button
                          onClick={() => updateSetting('influx_enabled', settings.influx_enabled === '1' ? '0' : '1')}
                          className={cn(
                            "px-6 py-2 text-[10px] font-bold uppercase tracking-widest transition-all",
                            settings.influx_enabled === '1' ? "bg-emerald-500 text-white" : "bg-black/10 opacity-50",
                            currentTheme.rounded
                          )}
                        >
                          {settings.influx_enabled === '1' ? 'Aktiviert' : 'Deaktiviert'}
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                      <div className="space-y-6">
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold uppercase tracking-widest opacity-40">Server URL {process.env.INFLUX_URL ? "(Set via Env)" : ""}</label>
                          <input
                            type="text"
                            className={cn("w-full p-4 border outline-none transition-all", currentTheme.rounded, currentTheme.input)}
                            value={settings.influx_url || ""}
                            onChange={(e) => updateSetting('influx_url', e.target.value)}
                            placeholder={process.env.INFLUX_URL ? "Using Environment Variable" : "http://localhost:8086"}
                            disabled={!!process.env.INFLUX_URL}
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold uppercase tracking-widest opacity-40">Organisation {process.env.INFLUX_ORG ? "(Set via Env)" : ""}</label>
                          <input
                            type="text"
                            className={cn("w-full p-4 border outline-none transition-all", currentTheme.rounded, currentTheme.input)}
                            value={settings.influx_org || ""}
                            onChange={(e) => updateSetting('influx_org', e.target.value)}
                            placeholder={process.env.INFLUX_ORG ? "Using Environment Variable" : "meine-org"}
                            disabled={!!process.env.INFLUX_ORG}
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold uppercase tracking-widest opacity-40">Bucket Name {process.env.INFLUX_BUCKET ? "(Set via Env)" : ""}</label>
                          <input
                            type="text"
                            className={cn("w-full p-4 border outline-none transition-all", currentTheme.rounded, currentTheme.input)}
                            value={settings.influx_bucket || ""}
                            onChange={(e) => updateSetting('influx_bucket', e.target.value)}
                            placeholder={process.env.INFLUX_BUCKET ? "Using Environment Variable" : "produktion"}
                            disabled={!!process.env.INFLUX_BUCKET}
                          />
                        </div>
                      </div>

                      <div className="space-y-6">
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold uppercase tracking-widest opacity-40">API Token {process.env.INFLUX_TOKEN ? "(Set via Env)" : ""}</label>
                          <input
                            type="password"
                            className={cn("w-full p-4 border outline-none transition-all font-mono", currentTheme.rounded, currentTheme.input)}
                            value={settings.influx_token || ""}
                            onChange={(e) => updateSetting('influx_token', e.target.value)}
                            placeholder={process.env.INFLUX_TOKEN ? "•••••••• (Env)" : "Dein InfluxDB API Token"}
                            disabled={!!process.env.INFLUX_TOKEN}
                          />
                        </div>
                        
                        <div className="pt-8 space-y-4">
                          <button
                            onClick={handleTestInflux}
                            disabled={influxTestStatus.loading}
                            className={cn(
                              "w-full py-5 font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-3",
                              influxTestStatus.loading ? "opacity-50 cursor-wait" : "bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-500/20",
                              currentTheme.rounded
                            )}
                          >
                            {influxTestStatus.loading ? (
                              <RefreshCcw size={18} className="animate-spin" />
                            ) : (
                              <Zap size={18} />
                            )}
                            Verbindung Testen
                          </button>

                          {influxTestStatus.success && (
                            <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl flex items-center gap-3 text-emerald-700">
                              <CheckCircle2 size={18} />
                              <span className="text-xs font-bold uppercase tracking-widest">Verbindung erfolgreich!</span>
                            </div>
                          )}

                          {influxTestStatus.error && (
                            <div className="p-4 bg-rose-50 border border-rose-100 rounded-xl flex items-center gap-3 text-rose-700">
                              <AlertCircle size={18} />
                              <span className="text-xs font-bold uppercase tracking-widest">Fehler: {influxTestStatus.error}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="mt-12 pt-12 border-t border-black/5">
                      <p className="text-xs opacity-50 leading-relaxed">
                        Wenn aktiviert, sendet das System bei jedem Scan den Menünamen und den aktuellen Tageszähler an InfluxDB. 
                        Stellen Sie sicher, dass der Bucket und die Organisation in Ihrer InfluxDB-Instanz existieren.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {adminTab === 'mariadb' && (
                <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
                  <div className={cn(
                    "p-12 border transition-all duration-700",
                    currentTheme.rounded,
                    currentTheme.card
                  )}>
                    <div className="flex items-center justify-between mb-12">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 flex items-center justify-center bg-blue-600 text-white rounded-2xl shadow-lg">
                          <Database size={24} />
                        </div>
                        <div>
                          <h3 className="text-xl font-bold">MariaDB / MySQL Integration</h3>
                          <p className="text-[10px] opacity-40 uppercase tracking-widest mt-1">Mirror production logs to a relational database</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] font-bold uppercase tracking-widest opacity-40">Status:</span>
                        <button
                          onClick={() => updateSetting('mariadb_enabled', settings.mariadb_enabled === '1' ? '0' : '1')}
                          className={cn(
                            "px-6 py-2 text-[10px] font-bold uppercase tracking-widest transition-all",
                            settings.mariadb_enabled === '1' ? "bg-emerald-500 text-white" : "bg-black/10 opacity-50",
                            currentTheme.rounded
                          )}
                        >
                          {settings.mariadb_enabled === '1' ? 'Enabled' : 'Disabled'}
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                      <div className="space-y-6">
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold uppercase tracking-widest opacity-40">Host {process.env.MARIADB_HOST ? "(Set via Env)" : ""}</label>
                          <input
                            type="text"
                            className={cn("w-full p-4 border outline-none transition-all", currentTheme.rounded, currentTheme.input)}
                            value={settings.mariadb_host || ""}
                            onChange={(e) => updateSetting('mariadb_host', e.target.value)}
                            placeholder={process.env.MARIADB_HOST ? "Using Environment Variable" : "localhost or IP"}
                            disabled={!!process.env.MARIADB_HOST}
                          />
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                          <div className="col-span-1 space-y-2">
                            <label className="text-[10px] font-bold uppercase tracking-widest opacity-40">Port</label>
                            <input
                              type="text"
                              className={cn("w-full p-4 border outline-none transition-all", currentTheme.rounded, currentTheme.input)}
                              value={settings.mariadb_port || "3306"}
                              onChange={(e) => updateSetting('mariadb_port', e.target.value)}
                              placeholder="3306"
                              disabled={!!process.env.MARIADB_PORT}
                            />
                          </div>
                          <div className="col-span-2 space-y-2">
                            <label className="text-[10px] font-bold uppercase tracking-widest opacity-40">Database Name</label>
                            <input
                              type="text"
                              className={cn("w-full p-4 border outline-none transition-all", currentTheme.rounded, currentTheme.input)}
                              value={settings.mariadb_database || ""}
                              onChange={(e) => updateSetting('mariadb_database', e.target.value)}
                              placeholder="production_db"
                              disabled={!!process.env.MARIADB_DATABASE}
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold uppercase tracking-widest opacity-40">Username</label>
                          <input
                            type="text"
                            className={cn("w-full p-4 border outline-none transition-all", currentTheme.rounded, currentTheme.input)}
                            value={settings.mariadb_user || ""}
                            onChange={(e) => updateSetting('mariadb_user', e.target.value)}
                            placeholder="db_user"
                            disabled={!!process.env.MARIADB_USER}
                          />
                        </div>
                      </div>

                      <div className="space-y-6">
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold uppercase tracking-widest opacity-40">Password {process.env.MARIADB_PASSWORD ? "(Set via Env)" : ""}</label>
                          <input
                            type="password"
                            className={cn("w-full p-4 border outline-none transition-all font-mono", currentTheme.rounded, currentTheme.input)}
                            value={settings.mariadb_password || ""}
                            onChange={(e) => updateSetting('mariadb_password', e.target.value)}
                            placeholder={process.env.MARIADB_PASSWORD ? "•••••••• (Env)" : "••••••••"}
                            disabled={!!process.env.MARIADB_PASSWORD}
                          />
                        </div>
                        
                        <div className="pt-8 space-y-4">
                          <button
                            onClick={handleTestMariaDB}
                            disabled={mariadbTestStatus.loading}
                            className={cn(
                              "w-full py-5 font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-3",
                              mariadbTestStatus.loading ? "opacity-50 cursor-wait" : "bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-500/20",
                              currentTheme.rounded
                            )}
                          >
                            {mariadbTestStatus.loading ? (
                              <RefreshCcw size={18} className="animate-spin" />
                            ) : (
                              <Zap size={18} />
                            )}
                            Test Connection
                          </button>

                          {mariadbTestStatus.success && (
                            <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl flex items-center gap-3 text-emerald-700">
                              <CheckCircle2 size={18} />
                              <span className="text-xs font-bold uppercase tracking-widest">Connection Successful!</span>
                            </div>
                          )}

                          {mariadbTestStatus.error && (
                            <div className="p-4 bg-rose-50 border border-rose-100 rounded-xl flex items-center gap-3 text-rose-700">
                              <AlertCircle size={18} />
                              <span className="text-xs font-bold uppercase tracking-widest">Error: {mariadbTestStatus.error}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="mt-12 pt-12 border-t border-black/5">
                      <p className="text-xs opacity-50 leading-relaxed">
                        When enabled, the system will mirror every scan to the <code>production_logs</code> table in your MariaDB instance. 
                        The table will be created automatically if it doesn't exist.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {adminTab === 'marquee' && (
                <div className="space-y-12">
                  <div className={cn(
                    "p-12 border transition-all duration-700",
                    currentTheme.rounded,
                    currentTheme.card
                  )}>
                    <div className="flex items-center gap-4 mb-12">
                      <div className="w-12 h-12 flex items-center justify-center bg-cyan-500 text-white rounded-2xl shadow-lg">
                        <MessageSquare size={24} />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold">Ticker-Verwaltung</h3>
                        <p className="text-[10px] opacity-40 uppercase tracking-widest mt-1">Laufschrift-Ankündigungen & Alarme</p>
                      </div>
                    </div>

                    <div className="space-y-8">
                      <div className="space-y-4">
                        <label className="text-[10px] font-bold uppercase tracking-widest opacity-40">Vorlagen</label>
                        <div className="flex flex-wrap gap-3">
                          {[
                            "Wartungsarbeiten am Förderband von 14:00 bis 15:00 Uhr.",
                            "Schichtwechsel in 15 Minuten. Bitte Arbeitsplatz sauber hinterlassen.",
                            "Sicherheitsunterweisung für alle Mitarbeiter um 10:00 Uhr im Pausenraum.",
                            "Tagesziel fast erreicht! Noch 500 Einheiten bis zum Bonus."
                          ].map((template) => (
                            <button
                              key={template}
                              onClick={() => setNewMarquee({...newMarquee, text: template})}
                              className={cn(
                                "px-4 py-2 text-[10px] font-bold border transition-all hover:bg-black/5",
                                currentTheme.rounded,
                                currentTheme.input
                              )}
                            >
                              {template.length > 40 ? template.substring(0, 40) + '...' : template}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest opacity-40">Nachrichteninhalt</label>
                        <textarea 
                          className={cn("w-full p-6 border outline-none transition-all min-h-[120px]", currentTheme.rounded, currentTheme.input)}
                          placeholder="Nachricht für den Ticker eingeben..."
                          value={newMarquee.text}
                          onChange={(e) => setNewMarquee({...newMarquee, text: e.target.value})}
                        />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold uppercase tracking-widest opacity-40">Wiederholungsoption</label>
                          <select 
                            className={cn("w-full p-4 border outline-none transition-all", currentTheme.rounded, currentTheme.input)}
                            value={newMarquee.repeat}
                            onChange={(e) => setNewMarquee({...newMarquee, repeat: e.target.value as 'daily' | 'once'})}
                          >
                            <option value="daily">Täglich</option>
                            <option value="once">Bestimmter Zeitraum</option>
                          </select>
                        </div>
                        {newMarquee.repeat === 'once' && (
                          <>
                            <CustomDatePicker 
                              label="Startdatum"
                              value={newMarquee.startDate}
                              onChange={val => setNewMarquee({...newMarquee, startDate: val})}
                              theme={currentTheme}
                            />
                            <CustomDatePicker 
                              label="Enddatum"
                              value={newMarquee.endDate}
                              onChange={val => setNewMarquee({...newMarquee, endDate: val})}
                              theme={currentTheme}
                            />
                          </>
                        )}
                        <CustomTimePicker
                          label="Startzeit"
                          value={newMarquee.startTime}
                          onChange={val => setNewMarquee({...newMarquee, startTime: val})}
                          theme={currentTheme}
                        />
                        <CustomTimePicker
                          label="Endzeit"
                          value={newMarquee.endTime}
                          onChange={val => setNewMarquee({...newMarquee, endTime: val})}
                          theme={currentTheme}
                        />
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold uppercase tracking-widest opacity-40">Geschwindigkeit</label>
                          <select 
                            className={cn("w-full p-4 border outline-none transition-all", currentTheme.rounded, currentTheme.input)}
                            value={newMarquee.speed}
                            onChange={(e) => setNewMarquee({...newMarquee, speed: e.target.value as 'slow' | 'normal' | 'fast'})}
                          >
                            <option value="slow">Langsam</option>
                            <option value="normal">Normal</option>
                            <option value="fast">Schnell</option>
                          </select>
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold uppercase tracking-widest opacity-40">Textfarbe</label>
                          <div className="flex gap-2">
                            <input 
                              type="color"
                              className={cn("w-full h-12 p-1 border outline-none transition-all cursor-pointer", currentTheme.rounded, currentTheme.input)}
                              value={newMarquee.color}
                              onChange={(e) => setNewMarquee({...newMarquee, color: e.target.value})}
                            />
                            <div className="flex flex-wrap gap-1 max-w-[120px]">
                              {['#000000', '#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ffffff'].map(c => (
                                <button
                                  key={c}
                                  type="button"
                                  className="w-5 h-5 rounded-full border border-black/10"
                                  style={{ backgroundColor: c }}
                                  onClick={() => setNewMarquee({...newMarquee, color: c})}
                                />
                              ))}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-end lg:col-span-1">
                          <button 
                            onClick={handleAddMarquee}
                            className={cn(
                              "w-full py-4 font-bold uppercase tracking-widest transition-all duration-500 bg-cyan-600 text-white shadow-lg",
                              currentTheme.rounded
                            )}
                          >
                            Hinzufügen
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <h3 className="text-xs font-bold uppercase tracking-[0.3em] opacity-40 ml-4">Geplante Ticker-Nachrichten</h3>
                    <div className="grid grid-cols-1 gap-4">
                      {marqueeMessages.map((msg) => (
                        <div key={msg.id} className={cn(
                          "p-8 border flex items-center justify-between group transition-all duration-700", 
                          currentTheme.rounded, 
                          currentTheme.card
                        )}>
                          <div className="flex-1">
                            <p className="text-lg font-medium" style={{ color: msg.color || 'inherit' }}>{msg.text}</p>
                            <div className="flex flex-wrap gap-6 mt-2">
                              <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">Aktiv: {msg.start_time} - {msg.end_time}</span>
                              <span className="text-[10px] font-bold text-blue-500 uppercase tracking-widest">Wiederholung: {msg.repeat === 'daily' ? 'Täglich' : 'Einmalig'} {msg.start_date ? `(${msg.start_date} bis ${msg.end_date})` : ''}</span>
                              <span className="text-[10px] font-bold text-amber-500 uppercase tracking-widest">Geschwindigkeit: {msg.speed === 'slow' ? 'Langsam' : msg.speed === 'normal' ? 'Normal' : 'Schnell'}</span>
                              {msg.color && (
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-bold uppercase tracking-widest opacity-40">Farbe:</span>
                                  <div className="w-3 h-3 rounded-full border border-black/10" style={{ backgroundColor: msg.color }} />
                                </div>
                              )}
                            </div>
                          </div>
                          <button 
                            onClick={() => handleDeleteMarquee(msg.id)}
                            className={cn(
                              "p-4 transition-all duration-500",
                              "opacity-30 hover:opacity-100 hover:text-rose-600 hover:bg-rose-50 rounded-2xl"
                            )}
                          >
                            <Trash2 size={24} strokeWidth={2} />
                          </button>
                        </div>
                      ))}
                      {marqueeMessages.length === 0 && (
                        <div className="p-20 border border-dashed border-current/10 rounded-3xl flex flex-col items-center justify-center opacity-20">
                          <MessageSquare size={48} className="mb-4" />
                          <p className="text-xs font-bold uppercase tracking-[0.3em]">Keine aktiven Nachrichten geplant</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {view === "reports" && (
            <motion.div 
              key="reports"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="max-w-7xl mx-auto w-full overflow-y-auto pr-2 custom-scrollbar pb-20"
            >
              <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-16 gap-8">
                <div>
                  <h2 className={cn(
                    "text-5xl font-black tracking-tighter transition-all duration-700",
                    "text-slate-900"
                  )}>Leistungsanalyse</h2>
                  <p className={cn(
                    "text-[10px] uppercase tracking-[0.3em] font-bold mt-3 opacity-40",
                    currentTheme.muted
                  )}>Standardmäßig werden die letzten 7 Tage angezeigt. Wählen Sie Daten für einen größeren Zeitraum.</p>
                </div>
                
                <div className="flex flex-wrap items-end gap-4 print:hidden">
                  <div className="flex gap-4">
                    <CustomDatePicker 
                      label="Startdatum"
                      value={reportFilters.startDate}
                      onChange={val => setReportFilters(prev => ({ ...prev, startDate: val }))}
                      theme={currentTheme}
                    />
                    <CustomTimePicker
                      label="Startzeit"
                      value={reportFilters.startTime}
                      onChange={val => setReportFilters(prev => ({ ...prev, startTime: val }))}
                      theme={currentTheme}
                    />
                  </div>
                  <div className="flex gap-4">
                    <CustomDatePicker 
                      label="Enddatum"
                      value={reportFilters.endDate}
                      onChange={val => setReportFilters(prev => ({ ...prev, endDate: val }))}
                      theme={currentTheme}
                    />
                    <CustomTimePicker
                      label="Endzeit"
                      value={reportFilters.endTime}
                      onChange={val => setReportFilters(prev => ({ ...prev, endTime: val }))}
                      theme={currentTheme}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[9px] font-bold uppercase tracking-widest opacity-40 ml-1">Asset suchen</label>
                    <input 
                      type="text"
                      placeholder="Nach Name suchen..."
                      value={reportFilters.searchQuery}
                      onChange={e => setReportFilters(prev => ({ ...prev, searchQuery: e.target.value }))}
                      className={cn("p-3 border text-xs outline-none transition-all w-48", currentTheme.rounded, currentTheme.input)}
                    />
                  </div>
                  <button 
                    onClick={handlePrint}
                    className={cn(
                      "p-3 border transition-all hover:bg-black/5 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest",
                      currentTheme.rounded,
                      currentTheme.input
                    )}
                  >
                    <Printer size={16} />
                    Drucken
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
                <div className={cn("lg:col-span-12 p-12 border shadow-sm transition-all duration-700", currentTheme.rounded, currentTheme.card)}>
                  <div className="flex items-center justify-between mb-12">
                    <h3 className={cn(
                      "text-xs font-bold uppercase tracking-[0.3em] opacity-40"
                    )}>Produktionslinie (Stündlicher Durchsatz)</h3>
                    <div className="flex gap-3 items-center">
                      <div className={cn("w-2 h-2 rounded-full", "bg-emerald-500")} />
                      <span className="text-[9px] font-bold uppercase tracking-widest opacity-40">Einheiten pro Stunde</span>
                    </div>
                  </div>
                  <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={hourlyData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis 
                          dataKey="hour" 
                          fontSize={9} 
                          stroke={'#94a3b8'}
                          axisLine={false}
                          tickLine={false}
                          dy={10}
                        />
                        <YAxis fontSize={9} stroke={'#94a3b8'} axisLine={false} tickLine={false} />
                        <Tooltip 
                          cursor={{ fill: "#f8fafc" }}
                          contentStyle={{ 
                            backgroundColor: '#000', 
                            border: 'none', 
                            borderRadius: '16px', 
                            padding: '16px' 
                          }}
                          itemStyle={{ color: '#fff', fontWeight: 'bold', fontSize: '12px' }}
                          labelStyle={{ color: '#94a3b8', fontSize: '9px', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '1px' }}
                        />
                        <Bar dataKey="count" name="Einheiten" radius={[6, 6, 0, 0]} fill="#10b981" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className={cn("lg:col-span-8 p-12 border shadow-sm transition-all duration-700", currentTheme.rounded, currentTheme.card)}>
                  <div className="flex items-center justify-between mb-12">
                    <h3 className={cn(
                      "text-xs font-bold uppercase tracking-[0.3em] opacity-40"
                    )}>Täglicher Durchsatz</h3>
                    <div className="flex gap-3 items-center">
                      <div className={cn("w-2 h-2 rounded-full", "bg-cyan-500")} />
                      <span className="text-[9px] font-bold uppercase tracking-widest opacity-40">Verarbeitete Einheiten</span>
                    </div>
                  </div>
                  <div className="h-[450px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis 
                          dataKey="date" 
                          fontSize={9} 
                          tickFormatter={(val) => {
                            const d = parseISO(val);
                            return format(d, "dd.MM.", { locale: de });
                          }}
                          stroke={'#94a3b8'}
                          axisLine={false}
                          tickLine={false}
                          dy={10}
                        />
                        <YAxis fontSize={9} stroke={'#94a3b8'} axisLine={false} tickLine={false} />
                        <Tooltip 
                          cursor={{ fill: "#f8fafc" }}
                          contentStyle={{ 
                            backgroundColor: '#000', 
                            border: 'none', 
                            borderRadius: '16px', 
                            padding: '16px' 
                          }}
                          itemStyle={{ color: '#fff', fontWeight: 'bold', fontSize: '12px' }}
                          labelStyle={{ color: '#94a3b8', fontSize: '9px', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '1px' }}
                        />
                        <Bar dataKey="total_meals" name="Einheiten" radius={[6, 6, 0, 0]}>
                          {chartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={index === chartData.length - 1 ? '#06b6d4' : '#e2e8f0'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="lg:col-span-4 space-y-8">
                  <div className={cn(
                    "p-10 text-white shadow-2xl transition-all duration-700",
                    currentTheme.rounded,
                    themeKey === 'swiss' ? "bg-black shadow-none" :
                    themeKey === 'brutal' ? "bg-black shadow-none" :
                    "bg-cyan-600 shadow-cyan-500/20"
                  )}>
                    <p className="text-[9px] font-bold uppercase tracking-[0.3em] opacity-60 mb-3">Produktionszeitraum</p>
                    <p className={cn(
                      "text-7xl font-black tracking-tighter transition-all duration-700"
                    )}>
                      {filteredTotal.toLocaleString()}
                    </p>
                    <div className="mt-8 flex items-center gap-3 text-white/40 text-[10px] font-bold uppercase tracking-widest">
                      <Package size={16} strokeWidth={1.5} />
                      <span>Gesamteinheiten im gewählten Zeitraum</span>
                    </div>
                  </div>

                  <div className={cn("p-10 border shadow-sm transition-all duration-700", currentTheme.rounded, currentTheme.card)}>
                    <div className="flex justify-between items-center mb-8">
                      <h4 className={cn(
                        "text-[10px] font-bold uppercase tracking-[0.3em] opacity-40"
                      )}>Heutige Leistung</h4>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-xl font-black tracking-tighter">{todayTotal}</span>
                      </div>
                    </div>
                    
                    <div className="space-y-6 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                      <h5 className="text-[8px] font-bold uppercase tracking-[0.2em] opacity-30 mb-2">Detailliertes Protokoll</h5>
                      {reports.slice(0, 20).map((r, i) => (
                        <div key={`${r.date}-${r.meal_name}-${i}`} className="flex justify-between items-center group">
                          <div className="flex flex-col">
                            <span className="text-[10px] font-bold uppercase tracking-widest opacity-40">{r.date}</span>
                            <span className="text-xs font-bold">{r.meal_name}</span>
                          </div>
                          <span className={cn(
                            "text-sm font-black tracking-tight transition-all duration-500",
                            "group-hover:text-cyan-600"
                          )}>{r.count} <span className="text-[9px] font-bold opacity-30 uppercase tracking-widest not-italic">Einheiten</span></span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Modern Status Bar */}
      {view !== "counting" && (
        <footer className={cn(
          "fixed bottom-0 left-0 right-0 border-t px-8 py-4 transition-all duration-700", 
          currentTheme.header,
          "backdrop-blur-md"
        )}>
          <div className="max-w-[1600px] mx-auto flex justify-end items-center text-[9px] font-bold uppercase tracking-[0.2em] opacity-40">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span>System Aktiv</span>
              </div>
              <div className="h-3 w-px bg-current opacity-20" />
              <span className="opacity-60">Sitzung: {Math.floor(performance.now() / 1000)}s</span>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}

function NavButton({ theme, themeKey, active, onClick, icon, label }: { theme: any; themeKey: string; active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 px-8 py-3 transition-all duration-500 text-[10px] font-bold uppercase tracking-[0.2em]",
        active 
          ? (themeKey === 'brutal' || themeKey === 'swiss' ? "bg-black text-white" : "bg-white text-black shadow-md")
          : "opacity-40 hover:opacity-100 hover:bg-current/5",
        "rounded-xl"
      )}
    >
      <span className={cn("transition-transform duration-500", active && "scale-110")}>{icon}</span>
      {label}
    </button>
  );
}
