import { mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type { ProjectScope } from "../projects/filter.ts";

export interface Prefs {
  pins: string[];
  /** Recently opened project paths (path/with/namespace), newest first. */
  recentProjects: string[];
  /** Default project list mode. */
  projectScope: ProjectScope;
  pollIntervalMs: number;
  live: boolean;
  sidebarVisible: boolean;
}

const DEFAULTS: Prefs = {
  pins: [],
  recentProjects: [],
  projectScope: "smart",
  pollIntervalMs: 3000,
  live: true,
  sidebarVisible: true,
};

function configDir(): string {
  const xdg = process.env.XDG_CONFIG_HOME;
  if (xdg) return join(xdg, "ciview");
  return join(homedir(), ".config", "ciview");
}

function configPath(): string {
  return join(configDir(), "config.json");
}

function parseScope(v: unknown): ProjectScope {
  if (v === "smart" || v === "pinned" || v === "all") return v;
  return DEFAULTS.projectScope;
}

export async function loadPrefs(): Promise<Prefs> {
  const file = Bun.file(configPath());
  if (!(await file.exists())) return { ...DEFAULTS, pins: [], recentProjects: [] };
  try {
    const data = (await file.json()) as Partial<Prefs>;
    return {
      pins: Array.isArray(data.pins) ? data.pins.map(String) : [],
      recentProjects: Array.isArray(data.recentProjects)
        ? data.recentProjects.map(String).slice(0, 12)
        : [],
      projectScope: parseScope(data.projectScope),
      pollIntervalMs:
        typeof data.pollIntervalMs === "number" && data.pollIntervalMs >= 1000
          ? data.pollIntervalMs
          : DEFAULTS.pollIntervalMs,
      live: data.live ?? DEFAULTS.live,
      sidebarVisible: data.sidebarVisible ?? DEFAULTS.sidebarVisible,
    };
  } catch {
    return { ...DEFAULTS, pins: [], recentProjects: [] };
  }
}

export async function savePrefs(prefs: Prefs): Promise<void> {
  await mkdir(configDir(), { recursive: true });
  await Bun.write(configPath(), JSON.stringify(prefs, null, 2) + "\n");
}
