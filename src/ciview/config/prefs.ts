import { mkdir } from "node:fs/promises";
import type { ProjectScope } from "../projects/filter.ts";
import {
  DEFAULT_LOGGING,
  parseLoggingPrefs,
  type LoggingPrefs,
} from "../util/logger.ts";
import { configDir, configPath } from "./paths.ts";

export type RecentMode = "activity" | "opened";

export interface Prefs {
  pins: string[];
  /** Recently opened project paths (path/with/namespace), newest first. */
  recentProjects: string[];
  /** Default project list mode. */
  projectScope: ProjectScope;
  /** RECENT ranking: API activity/pipeline vs local open MRU. */
  recentMode: RecentMode;
  pollIntervalMs: number;
  live: boolean;
  sidebarVisible: boolean;
  /**
   * Last chosen glab GitLab hostname (e.g. git.eonf.ltd).
   * When set and still valid, startup skips the host picker.
   */
  gitlabHost: string | null;
  /** File logging under ~/.config/ciview/logs (≤1h retention). */
  logging: LoggingPrefs;
}

const DEFAULTS: Prefs = {
  pins: [],
  recentProjects: [],
  projectScope: "smart",
  recentMode: "activity",
  pollIntervalMs: 3000,
  live: true,
  sidebarVisible: true,
  gitlabHost: null,
  logging: { ...DEFAULT_LOGGING },
};

function parseScope(v: unknown): ProjectScope {
  if (v === "smart" || v === "pinned" || v === "all") return v;
  return DEFAULTS.projectScope;
}

function parseRecentMode(v: unknown): RecentMode {
  if (v === "activity" || v === "opened") return v;
  return DEFAULTS.recentMode;
}

function emptyPrefs(): Prefs {
  return {
    ...DEFAULTS,
    pins: [],
    recentProjects: [],
    logging: { ...DEFAULT_LOGGING },
  };
}

export async function loadPrefs(): Promise<Prefs> {
  const file = Bun.file(configPath());
  if (!(await file.exists())) return emptyPrefs();
  try {
    const data = (await file.json()) as Partial<Prefs> & Record<string, unknown>;
    return {
      pins: Array.isArray(data.pins) ? data.pins.map(String) : [],
      recentProjects: Array.isArray(data.recentProjects)
        ? data.recentProjects.map(String).slice(0, 20)
        : [],
      projectScope: parseScope(data.projectScope),
      recentMode: parseRecentMode(data.recentMode),
      pollIntervalMs:
        typeof data.pollIntervalMs === "number" && data.pollIntervalMs >= 1000
          ? data.pollIntervalMs
          : DEFAULTS.pollIntervalMs,
      live: data.live ?? DEFAULTS.live,
      sidebarVisible: data.sidebarVisible ?? DEFAULTS.sidebarVisible,
      gitlabHost:
        typeof data.gitlabHost === "string" && data.gitlabHost.trim()
          ? data.gitlabHost.trim().replace(/^https?:\/\//, "").replace(/\/$/, "")
          : null,
      logging: parseLoggingPrefs(data.logging),
    };
  } catch {
    return emptyPrefs();
  }
}

export async function savePrefs(prefs: Prefs): Promise<void> {
  await mkdir(configDir(), { recursive: true });
  await Bun.write(configPath(), JSON.stringify(prefs, null, 2) + "\n");
}

export { DEFAULTS as DEFAULT_PREFS };
