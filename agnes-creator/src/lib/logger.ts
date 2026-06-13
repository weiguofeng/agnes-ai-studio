/**
 * Logger — 统一日志系统
 * V2.4: 支持分级日志 + localStorage 持久化
 */

export type LogLevel = "info" | "warn" | "error" | "debug";

export interface LogEntry {
  id: string;
  timestamp: number;
  level: LogLevel;
  module: string;
  message: string;
  data?: Record<string, unknown>;
}

const MAX_LOG_ENTRIES = 500;
const STORAGE_KEY = "agnes-logs";

class Logger {
  private entries: LogEntry[] = [];
  private listeners: Array<(entry: LogEntry) => void> = [];

  constructor() {
    this.load();
  }

  private load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) this.entries = JSON.parse(raw).slice(0, MAX_LOG_ENTRIES);
    } catch { /* ignore */ }
  }

  private save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.entries.slice(-MAX_LOG_ENTRIES)));
    } catch { /* ignore */ }
  }

  private log(level: LogLevel, module: string, message: string, data?: Record<string, unknown>) {
    const entry: LogEntry = {
      id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Date.now(),
      level,
      module,
      message,
      data,
    };
    this.entries.push(entry);
    this.save();
    this.listeners.forEach((fn) => fn(entry));
    if (level === "error") console.error(`[${module}] ${message}`, data);
    else if (level === "warn") console.warn(`[${module}] ${message}`, data);
    else console.log(`[${module}] ${message}`, data);
  }

  info(module: string, message: string, data?: Record<string, unknown>) {
    this.log("info", module, message, data);
  }

  warn(module: string, message: string, data?: Record<string, unknown>) {
    this.log("warn", module, message, data);
  }

  error(module: string, message: string, data?: Record<string, unknown>) {
    this.log("error", module, message, data);
  }

  debug(module: string, message: string, data?: Record<string, unknown>) {
    this.log("debug", module, message, data);
  }

  getEntries(module?: string, level?: LogLevel, limit = 100): LogEntry[] {
    let filtered = this.entries;
    if (module) filtered = filtered.filter((e) => e.module === module);
    if (level) filtered = filtered.filter((e) => e.level === level);
    return filtered.slice(-limit);
  }

  subscribe(fn: (entry: LogEntry) => void) {
    this.listeners.push(fn);
    return () => { this.listeners = this.listeners.filter((l) => l !== fn); };
  }

  clear() {
    this.entries = [];
    this.save();
  }
}

export const logger = new Logger();
