import React, { useState, useEffect } from "react";
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
  Type as TypeIcon,
  MessageSquare,
  Volume2,
  VolumeX,
  CheckCircle2,
  Target,
  Zap
} from "lucide-react";
import { format } from "date-fns";
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
import { Meal, Report, MarqueeMessage, Settings } from "./types";

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
    name: "Modern Hell",
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

export default function App() {
  const [view, setView] = useState<"admin" | "counting" | "reports">("counting");
  const [themeKey, setThemeKey] = useState<keyof typeof THEMES>("cyber");
  const [meals, setMeals] = useState<Meal[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
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
    speed: 'normal'
  });
  const [adminTab, setAdminTab] = useState<"assets" | "hardware" | "marquee">("assets");
  const [error, setError] = useState<string | null>(null);
  const [isHeaderHidden, setIsHeaderHidden] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isIdle, setIsIdle] = useState(false);
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
    startDate: format(new Date(new Date().setDate(new Date().getDate() - 30)), "yyyy-MM-dd"),
    endDate: format(new Date(), "yyyy-MM-dd"),
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
      resetIdleTimer();
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
    const d = date.getDate().toString().padStart(2, '0');
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const y = date.getFullYear();
    return `${d}/${m}/${y}`;
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
        search: reportFilters.searchQuery
      });
      const res = await fetch(`/api/reports?${params.toString()}`);
      const data = await res.json();
      setReports(data);
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

  useEffect(() => {
    fetchData();
    fetchReports();
    fetchMarquee();
    fetchSettings();
    fetchHardwareStatus();

    socket.on("update", fetchData);
    socket.on("status", (status) => setIsMuted(status.isMuted));
    socket.on("hardware_status", (data) => setHardwareStatus(data));
    socket.on("scan", (data) => {
      // Visual feedback for scan
      const indicator = document.getElementById('scan-indicator');
      if (indicator) {
        indicator.style.backgroundColor = '#10b981'; // Green
        setTimeout(() => {
          indicator.style.backgroundColor = '#ef4444'; // Red
        }, 500);
      }
    });

    return () => {
      socket.off("update");
      socket.off("status");
      socket.off("scan");
      socket.off("hardware_status");
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

  return (
    <div className={cn(
      "h-screen flex flex-col transition-colors duration-700 relative overflow-hidden", 
      currentTheme.bg, 
      currentTheme.text, 
      currentTheme.font,
      isIdle && view === "counting" && "cursor-none"
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
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -100, opacity: 0 }}
            transition={{ duration: 0.5, ease: "easeInOut" }}
            className={cn("sticky top-0 z-50 border-b px-8 py-6", currentTheme.header)}
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
                  <ChefHat size={26} />
                </div>
                <div>
                  <h1 className={cn(
                    "text-2xl font-bold tracking-tight transition-all duration-700",
                    currentTheme.text
                  )}>
                    GourmettaCounter
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
      <main className="flex-1 max-w-[1600px] w-full mx-auto p-8 overflow-hidden flex flex-col">
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
                          <div className="mt-2 flex items-center gap-2">
                            <Target size={12} className="opacity-30" />
                            <span className="text-[10px] font-bold opacity-40 uppercase tracking-widest">Ziel: {meal.daily_goal}</span>
                            {goalMet && <CheckCircle2 size={12} className="text-emerald-500" />}
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
                  <div className="whitespace-nowrap flex py-2">
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
                        <div key={i} className={cn(
                          "flex whitespace-nowrap",
                          msg.speed === 'slow' ? "animate-marquee-slow" : 
                          msg.speed === 'fast' ? "animate-marquee-fast" : "animate-marquee-normal"
                        )}>
                          <span className="mx-12 text-sm font-bold uppercase tracking-[0.2em]">
                            {msg.text}
                          </span>
                          {/* Duplicate for seamless loop */}
                          <span className="mx-12 text-sm font-bold uppercase tracking-[0.2em]">
                            {msg.text}
                          </span>
                        </div>
                      ))}
                    {marqueeMessages.length === 0 && (
                      <div className="animate-marquee-normal flex whitespace-nowrap">
                        <span className="mx-12 text-sm font-bold uppercase tracking-[0.2em] opacity-30">
                          System Betriebsbereit • Qualitätskontrolle Aktiv • Sicherheit Zuerst
                        </span>
                        <span className="mx-12 text-sm font-bold uppercase tracking-[0.2em] opacity-30">
                          System Betriebsbereit • Qualitätskontrolle Aktiv • Sicherheit Zuerst
                        </span>
                      </div>
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
                  {(['assets', 'hardware', 'marquee'] as const).map((tab) => (
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
                      {tab === 'assets' ? 'Bestände' : tab === 'hardware' ? 'Hardware' : 'Ticker'}
                    </button>
                  ))}
                </div>
              </div>

              {adminTab === 'assets' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
                  <div className="lg:col-span-4">
                    <form onSubmit={editingMeal ? handleUpdateMeal : handleAddMeal} className={cn("p-10 border shadow-sm sticky top-32 transition-all duration-700", currentTheme.rounded, currentTheme.card)}>
                      <h3 className="text-xl font-bold mb-8 flex items-center gap-3">
                        {editingMeal ? <Edit3 size={24} /> : <Plus size={24} />} {editingMeal ? "Asset aktualisieren" : "Asset registrieren"}
                      </h3>
                      <div className="space-y-6">
                        <div className="space-y-2">
                          <label className="text-[9px] font-bold uppercase tracking-[0.2em] opacity-40 ml-1">Asset Name</label>
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
                  <div className={cn(
                    "p-12 border transition-all duration-700",
                    currentTheme.rounded,
                    currentTheme.card
                  )}>
                    <div className="flex items-center gap-4 mb-12">
                      <div className="w-12 h-12 flex items-center justify-center bg-cyan-500 text-white rounded-2xl shadow-lg">
                        <Cpu size={24} />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold">Hardware-Konfiguration</h3>
                        <p className="text-[10px] opacity-40 uppercase tracking-widest mt-1">Scanner- & Sensor-Integration</p>
                      </div>
                    </div>
 
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
                      <div className="space-y-4">
                        <label className="text-[10px] font-bold uppercase tracking-widest opacity-40">USB-Scanner-Schnittstelle</label>
                        <select 
                          className={cn("w-full p-4 border outline-none transition-all", currentTheme.rounded, currentTheme.input)}
                          value={settings.scanner_id}
                          onChange={(e) => updateSetting('scanner_id', e.target.value)}
                        >
                          <option value="USB-SCAN-01">Honeywell Xenon 1900</option>
                          <option value="USB-SCAN-02">Zebra DS2208</option>
                          <option value="EMULATOR">System-Emulator</option>
                        </select>
                      </div>
                      <div className="space-y-4">
                        <label className="text-[10px] font-bold uppercase tracking-widest opacity-40">Näherungssensor (ESP32)</label>
                        <select 
                          className={cn("w-full p-4 border outline-none transition-all", currentTheme.rounded, currentTheme.input)}
                          value={settings.proximity_id}
                          onChange={(e) => updateSetting('proximity_id', e.target.value)}
                        >
                          <option value="ESP32-PROX-01">ESP32 Haupttor</option>
                          <option value="ESP32-PROX-02">ESP32 Linie B</option>
                          <option value="DISABLED">Deaktiviert</option>
                        </select>
                      </div>
                      <div className="space-y-4">
                        <label className="text-[10px] font-bold uppercase tracking-widest opacity-40">Scan-Stumm-Kalibrierung (ms)</label>
                        <div className="flex gap-4 items-center">
                          <input
                            type="number"
                            className={cn("flex-1 p-4 border outline-none transition-all", currentTheme.rounded, currentTheme.input)}
                            value={settings.calibration_ms}
                            onChange={(e) => updateSetting('calibration_ms', e.target.value)}
                          />
                          <div className="flex items-center gap-2 px-4 py-2 bg-black/5 rounded-lg">
                            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            <span className="text-[9px] font-bold uppercase tracking-widest">Live-Sync</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Hardware Connection Simulation */}
                  <div className={cn(
                    "p-12 border transition-all duration-700",
                    currentTheme.rounded,
                    currentTheme.card
                  )}>
                    <div className="flex items-center gap-4 mb-12">
                      <div className="w-12 h-12 flex items-center justify-center bg-rose-500 text-white rounded-2xl shadow-lg">
                        <Zap size={24} />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold">Verbindungs-Simulation</h3>
                        <p className="text-[10px] opacity-40 uppercase tracking-widest mt-1">Status der Hardware-Verbindung testen</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                      <div className="flex items-center justify-between p-6 bg-black/5 rounded-2xl">
                        <div className="flex items-center gap-4">
                          <div className={cn("w-3 h-3 rounded-full", hardwareStatus.scannerConnected ? "bg-emerald-500" : "bg-rose-500")} />
                          <div>
                            <p className="text-xs font-bold uppercase tracking-widest">QR-Scanner</p>
                            <p className="text-[10px] opacity-40 uppercase">{hardwareStatus.scannerConnected ? "Verbunden" : "Getrennt"}</p>
                          </div>
                        </div>
                        <button 
                          onClick={() => fetch("/api/hardware/status", { 
                            method: "POST", 
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ scannerConnected: !hardwareStatus.scannerConnected })
                          })}
                          className={cn(
                            "px-6 py-2 text-[10px] font-bold uppercase tracking-widest transition-all",
                            hardwareStatus.scannerConnected ? "bg-rose-500/10 text-rose-500" : "bg-emerald-500/10 text-emerald-500",
                            "rounded-xl"
                          )}
                        >
                          {hardwareStatus.scannerConnected ? "Trennen" : "Verbinden"}
                        </button>
                      </div>

                      <div className="flex items-center justify-between p-6 bg-black/5 rounded-2xl">
                        <div className="flex items-center gap-4">
                          <div className={cn("w-3 h-3 rounded-full", hardwareStatus.proximityConnected ? "bg-emerald-500" : "bg-rose-500")} />
                          <div>
                            <p className="text-xs font-bold uppercase tracking-widest">Näherungssensor</p>
                            <p className="text-[10px] opacity-40 uppercase">{hardwareStatus.proximityConnected ? "Verbunden" : "Getrennt"}</p>
                          </div>
                        </div>
                        <button 
                          onClick={() => fetch("/api/hardware/status", { 
                            method: "POST", 
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ proximityConnected: !hardwareStatus.proximityConnected })
                          })}
                          className={cn(
                            "px-6 py-2 text-[10px] font-bold uppercase tracking-widest transition-all",
                            hardwareStatus.proximityConnected ? "bg-rose-500/10 text-rose-500" : "bg-emerald-500/10 text-emerald-500",
                            "rounded-xl"
                          )}
                        >
                          {hardwareStatus.proximityConnected ? "Trennen" : "Verbinden"}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className={cn(
                    "p-12 shadow-2xl overflow-hidden relative transition-all duration-700",
                    currentTheme.rounded,
                    themeKey === 'cyber' ? "bg-[#0F0F12] border border-zinc-800" : 
                    themeKey === 'brutal' ? "bg-black text-white border-4 border-black" : 
                    themeKey === 'swiss' ? "bg-white text-black border border-black/10" :
                    "bg-slate-900 text-white"
                  )}>
                    <div className="absolute top-0 right-0 p-16 opacity-5">
                      <Activity size={200} />
                    </div>
                    <div className="relative z-10">
                      <div className="flex items-center gap-4 mb-12">
                        <div className={cn(
                          "w-10 h-10 flex items-center justify-center transition-all duration-700",
                          "bg-cyan-500 text-black rounded-xl"
                        )}>
                          <Scan size={20} />
                        </div>
                        <div>
                          <h3 className={cn(
                            "text-xs font-bold uppercase tracking-[0.3em]",
                            "text-cyan-300"
                          )}>Hardware-Diagnose & Simulation</h3>
                          <p className="text-[9px] opacity-40 uppercase tracking-widest mt-1">Manuelle Übersteuerung und Sensortests</p>
                        </div>
                      </div>
                      
                      <div className="flex flex-wrap gap-6">
                        <button 
                          onClick={() => fetch("/api/trigger/proximity", { method: "POST" })}
                          className={cn(
                            "px-8 py-4 font-bold text-[10px] uppercase tracking-[0.2em] transition-all duration-500 flex items-center gap-4",
                            isMuted 
                              ? "bg-rose-500 text-white shadow-lg shadow-rose-500/20" 
                              : "bg-white/10 hover:bg-white/20 text-white",
                            currentTheme.rounded
                          )}
                        >
                          <div className={cn("w-2 h-2 rounded-full", isMuted ? "bg-white animate-ping" : "bg-emerald-400")} />
                          {isMuted ? "Näherung Aktiv" : "Näherung Auslösen"}
                        </button>
                        
                        <div className="h-14 w-px bg-current opacity-10 mx-2" />
                        
                        {meals.map((m, idx) => (
                          <button 
                            key={m.id}
                            onClick={() => fetch("/api/trigger/scan", { 
                              method: "POST", 
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ qrCode: m.qr_code })
                            })}
                            className={cn(
                              "px-6 py-4 text-[9px] font-bold uppercase tracking-[0.2em] transition-all duration-500 border",
                              "bg-white/5 hover:bg-white/10 border-white/5 hover:border-white/20 text-white",
                              currentTheme.rounded
                            )}
                          >
                            Scannen {m.name}
                          </button>
                        ))}
                      </div>
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
                            <div className="space-y-2">
                              <label className="text-[10px] font-bold uppercase tracking-widest opacity-40">Startdatum</label>
                              <input 
                                type="date"
                                className={cn("w-full p-4 border outline-none transition-all", currentTheme.rounded, currentTheme.input)}
                                value={newMarquee.startDate}
                                onChange={(e) => setNewMarquee({...newMarquee, startDate: e.target.value})}
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="text-[10px] font-bold uppercase tracking-widest opacity-40">Enddatum</label>
                              <input 
                                type="date"
                                className={cn("w-full p-4 border outline-none transition-all", currentTheme.rounded, currentTheme.input)}
                                value={newMarquee.endDate}
                                onChange={(e) => setNewMarquee({...newMarquee, endDate: e.target.value})}
                              />
                            </div>
                          </>
                        )}
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold uppercase tracking-widest opacity-40">Startzeit</label>
                          <input 
                            type="time"
                            className={cn("w-full p-4 border outline-none transition-all", currentTheme.rounded, currentTheme.input)}
                            value={newMarquee.startTime}
                            onChange={(e) => setNewMarquee({...newMarquee, startTime: e.target.value})}
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold uppercase tracking-widest opacity-40">Endzeit</label>
                          <input 
                            type="time"
                            className={cn("w-full p-4 border outline-none transition-all", currentTheme.rounded, currentTheme.input)}
                            value={newMarquee.endTime}
                            onChange={(e) => setNewMarquee({...newMarquee, endTime: e.target.value})}
                          />
                        </div>
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
                            <p className="text-lg font-medium">{msg.text}</p>
                            <div className="flex flex-wrap gap-6 mt-2">
                              <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">Aktiv: {msg.start_time} - {msg.end_time}</span>
                              <span className="text-[10px] font-bold text-blue-500 uppercase tracking-widest">Wiederholung: {msg.repeat === 'daily' ? 'Täglich' : 'Einmalig'} {msg.start_date ? `(${msg.start_date} bis ${msg.end_date})` : ''}</span>
                              <span className="text-[10px] font-bold text-amber-500 uppercase tracking-widest">Geschwindigkeit: {msg.speed === 'slow' ? 'Langsam' : msg.speed === 'normal' ? 'Normal' : 'Schnell'}</span>
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
                  )}>Langfristige Durchsatz- & Effizienzdaten</p>
                </div>
                
                <div className="flex flex-wrap items-end gap-4">
                  <div className="space-y-2">
                    <label className="text-[9px] font-bold uppercase tracking-widest opacity-40 ml-1">Startdatum</label>
                    <input 
                      type="date"
                      value={reportFilters.startDate}
                      onChange={e => setReportFilters(prev => ({ ...prev, startDate: e.target.value }))}
                      className={cn("p-3 border text-xs outline-none transition-all", currentTheme.rounded, currentTheme.input)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[9px] font-bold uppercase tracking-widest opacity-40 ml-1">Enddatum</label>
                    <input 
                      type="date"
                      value={reportFilters.endDate}
                      onChange={e => setReportFilters(prev => ({ ...prev, endDate: e.target.value }))}
                      className={cn("p-3 border text-xs outline-none transition-all", currentTheme.rounded, currentTheme.input)}
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
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
                <div className={cn("lg:col-span-8 p-12 border shadow-sm transition-all duration-700", currentTheme.rounded, currentTheme.card)}>
                  <div className="flex items-center justify-between mb-12">
                    <h3 className={cn(
                      "text-xs font-bold uppercase tracking-[0.3em] opacity-40"
                    )}>Produktionsdurchsatz</h3>
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
                          tickFormatter={(val) => val.split('-').slice(1).join('/')}
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
                        <Bar dataKey="total_meals" radius={[6, 6, 0, 0]}>
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
                    <p className="text-[9px] font-bold uppercase tracking-[0.3em] opacity-60 mb-3">Zeitraum Produktion</p>
                    <p className={cn(
                      "text-7xl font-black tracking-tighter transition-all duration-700"
                    )}>
                      {filteredTotal.toLocaleString()}
                    </p>
                    <div className="mt-8 flex items-center gap-3 text-white/40 text-[10px] font-bold uppercase tracking-widest">
                      <Package size={16} strokeWidth={1.5} />
                      <span>Gesamteinheiten im gewählten Bereich</span>
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
