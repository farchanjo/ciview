import { mkdir, readdir, rename, stat, unlink, appendFile } from "node:fs/promises";
import { join } from "node:path";
import { logFilePath, logsDir } from "../config/paths.ts";

export type LogLevel = "error" | "warn" | "info" | "debug";

export interface LoggingPrefs {
  enabled: boolean;
  level: LogLevel;
  /** Max age of log files; product hard-cap 1 hour. */
  maxAgeMs: number;
  maxBytes: number;
  maxFiles: number;
}

export const MAX_LOG_AGE_MS = 3_600_000; // 1 hour

export const DEFAULT_LOGGING: LoggingPrefs = {
  enabled: true,
  level: "info",
  maxAgeMs: MAX_LOG_AGE_MS,
  maxBytes: 1_048_576,
  maxFiles: 3,
};

const LEVEL_RANK: Record<LogLevel, number> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

let prefs: LoggingPrefs = { ...DEFAULT_LOGGING };
let writeCount = 0;
const CHECK_EVERY = 32;

export function clampLogAgeMs(ms: number): number {
  if (!Number.isFinite(ms) || ms < 1_000) return DEFAULT_LOGGING.maxAgeMs;
  return Math.min(ms, MAX_LOG_AGE_MS);
}

export function parseLogLevel(v: unknown): LogLevel {
  if (v === "error" || v === "warn" || v === "info" || v === "debug") return v;
  return DEFAULT_LOGGING.level;
}

export function parseLoggingPrefs(raw: unknown): LoggingPrefs {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_LOGGING };
  const o = raw as Record<string, unknown>;
  return {
    enabled: o.enabled !== false,
    level: parseLogLevel(o.level),
    maxAgeMs: clampLogAgeMs(
      typeof o.maxAgeMs === "number" ? o.maxAgeMs : DEFAULT_LOGGING.maxAgeMs,
    ),
    maxBytes:
      typeof o.maxBytes === "number" && o.maxBytes >= 4_096
        ? o.maxBytes
        : DEFAULT_LOGGING.maxBytes,
    maxFiles:
      typeof o.maxFiles === "number" && o.maxFiles >= 1 && o.maxFiles <= 10
        ? Math.floor(o.maxFiles)
        : DEFAULT_LOGGING.maxFiles,
  };
}

export function configureLogger(next: LoggingPrefs): void {
  prefs = {
    ...next,
    maxAgeMs: clampLogAgeMs(next.maxAgeMs),
  };
}

export function getLoggerPrefs(): LoggingPrefs {
  return { ...prefs };
}

function shouldLog(level: LogLevel): boolean {
  if (!prefs.enabled) return false;
  return LEVEL_RANK[level] <= LEVEL_RANK[prefs.level];
}

function formatLine(level: LogLevel, msg: string, fields?: Record<string, unknown>): string {
  const ts = new Date().toISOString();
  const base: Record<string, unknown> = { ts, level, msg };
  if (fields) {
    for (const [k, v] of Object.entries(fields)) {
      if (v === undefined) continue;
      // never allow secret-looking keys through
      if (/token|authorization|password|secret|private.token/i.test(k)) continue;
      base[k] = v;
    }
  }
  return JSON.stringify(base) + "\n";
}

export async function pruneLogs(now = Date.now()): Promise<void> {
  const dir = logsDir();
  let names: string[];
  try {
    names = await readdir(dir);
  } catch {
    return;
  }
  const maxAge = prefs.maxAgeMs;
  await Promise.all(
    names.map(async (name) => {
      if (!name.startsWith("ciview.log")) return;
      const full = join(dir, name);
      try {
        const st = await stat(full);
        if (now - st.mtimeMs > maxAge) await unlink(full);
      } catch {
        /* ignore */
      }
    }),
  );
}

async function rotateIfNeeded(): Promise<void> {
  const active = logFilePath();
  let size = 0;
  try {
    size = (await stat(active)).size;
  } catch {
    return;
  }
  if (size < prefs.maxBytes) return;

  const dir = logsDir();
  const max = prefs.maxFiles;
  // shift ciview.log.(n-1) → .n ; drop oldest
  for (let i = max - 1; i >= 1; i--) {
    const from = join(dir, i === 1 ? "ciview.log" : `ciview.log.${i - 1}`);
    const to = join(dir, `ciview.log.${i}`);
    try {
      if (i === max - 1 && max > 1) {
        try {
          await unlink(to);
        } catch {
          /* */
        }
      }
      await rename(from, to);
    } catch {
      /* missing is fine */
    }
  }
  // after shift, active should be gone; next append recreates
  try {
    await rename(active, join(dir, "ciview.log.1"));
  } catch {
    try {
      await unlink(active);
    } catch {
      /* */
    }
  }
}

async function ensureLogDir(): Promise<void> {
  await mkdir(logsDir(), { recursive: true });
}

export async function log(
  level: LogLevel,
  msg: string,
  fields?: Record<string, unknown>,
): Promise<void> {
  if (!shouldLog(level)) return;
  try {
    await ensureLogDir();
    writeCount += 1;
    if (writeCount === 1 || writeCount % CHECK_EVERY === 0) {
      await pruneLogs();
      await rotateIfNeeded();
    }
    await appendFile(logFilePath(), formatLine(level, msg, fields), "utf8");
  } catch {
    /* logging must never break the TUI */
  }
}

export const logger = {
  error: (msg: string, fields?: Record<string, unknown>) => void log("error", msg, fields),
  warn: (msg: string, fields?: Record<string, unknown>) => void log("warn", msg, fields),
  info: (msg: string, fields?: Record<string, unknown>) => void log("info", msg, fields),
  debug: (msg: string, fields?: Record<string, unknown>) => void log("debug", msg, fields),
};

/** Test helper: reset module prefs. */
export function _resetLoggerForTests(next: LoggingPrefs = DEFAULT_LOGGING): void {
  prefs = { ...next, maxAgeMs: clampLogAgeMs(next.maxAgeMs) };
  writeCount = 0;
}
