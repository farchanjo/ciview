import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";
import type { AuthResolved } from "../gitlab/types.ts";

export type AuthErrorCode = "glab_not_installed" | "glab_not_authenticated" | "glab_no_token";

export class AuthError extends Error {
  readonly code: AuthErrorCode;
  /** Multi-line operator-facing steps (install / authenticate). */
  readonly steps: string[];

  constructor(code: AuthErrorCode, message: string, steps: string[]) {
    super(message);
    this.name = "AuthError";
    this.code = code;
    this.steps = steps;
  }

  /** Full stderr-friendly text with numbered fix steps. */
  format(): string {
    const lines = [`ciview: ${this.message}`, "", "Fix:"];
    this.steps.forEach((s, i) => {
      lines.push(`  ${i + 1}) ${s}`);
    });
    return lines.join("\n");
  }
}

const INSTALL_STEP =
  "Install glab (GitLab CLI):  brew install glab\n" +
  "     See also: https://gitlab.com/gitlab-org/cli#installation";

const AUTH_STEP =
  "Authenticate with glab:  glab auth login\n" +
  "     Self-hosted example:  glab auth login --hostname git.example.com\n" +
  "     Then verify:  glab auth status";

export interface GlabHostEntry {
  /** Hostname key as stored by glab (e.g. git.eonf.ltd). */
  hostname: string;
  /** API base host (may differ from hostname). */
  apiHost: string;
  token: string;
  user?: string;
}

export interface GlabConfig {
  hosts: Record<string, { token?: string; api_host?: string; user?: string }>;
  host?: string;
  /** Path the config was loaded from (for diagnostics). */
  path: string;
}

function normalizeHost(raw: string): string {
  let h = raw.trim().replace(/\/$/, "");
  if (!h.startsWith("http://") && !h.startsWith("https://")) {
    h = `https://${h}`;
  }
  return h;
}

/** Strip scheme/trailing slash for host key comparison. */
export function hostKey(raw: string): string {
  return raw
    .trim()
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "");
}

/** True if `glab` is on PATH (PATH-only scan — no absolute fallbacks). */
export function isGlabInstalled(): boolean {
  const pathEnv = process.env.PATH ?? "";
  const exts = process.platform === "win32" ? [".exe", ".cmd", ""] : [""];
  for (const dir of pathEnv.split(process.platform === "win32" ? ";" : ":")) {
    if (!dir) continue;
    for (const ext of exts) {
      const candidate = join(dir, `glab${ext}`);
      if (existsSync(candidate)) return true;
    }
  }
  return false;
}

/**
 * Candidate glab config.yml paths, in priority order.
 * Matches glab: GLAB_CONFIG_DIR → XDG → ~/.config → macOS Application Support.
 */
export function glabConfigCandidates(): string[] {
  const home = homedir();
  const out: string[] = [];
  const seen = new Set<string>();
  const add = (p: string) => {
    if (!seen.has(p)) {
      seen.add(p);
      out.push(p);
    }
  };

  const envDir = process.env.GLAB_CONFIG_DIR;
  if (envDir) add(join(envDir, "config.yml"));

  const xdg = process.env.XDG_CONFIG_HOME;
  if (xdg) add(join(xdg, "glab-cli", "config.yml"));

  add(join(home, ".config", "glab-cli", "config.yml"));

  // Homebrew / macOS glab often uses Application Support
  if (process.platform === "darwin") {
    add(join(home, "Library", "Application Support", "glab-cli", "config.yml"));
  }

  return out;
}

export async function readGlabConfig(): Promise<GlabConfig | null> {
  for (const path of glabConfigCandidates()) {
    const file = Bun.file(path);
    if (!(await file.exists())) continue;
    try {
      const text = await file.text();
      const doc = parseYaml(text) as Record<string, unknown>;
      const hosts = (doc.hosts ?? {}) as Record<
        string,
        { token?: string; api_host?: string; user?: string }
      >;
      const host = typeof doc.host === "string" ? doc.host : undefined;
      return { hosts, host, path };
    } catch {
      continue;
    }
  }
  return null;
}

/** Hosts that have a non-empty token in glab config (usable by ciview). */
export async function listAuthenticatedHosts(): Promise<GlabHostEntry[]> {
  const glab = await readGlabConfig();
  if (!glab) return [];
  const out: GlabHostEntry[] = [];
  for (const [hostname, entry] of Object.entries(glab.hosts)) {
    const token = typeof entry?.token === "string" ? entry.token.trim() : "";
    if (!token) continue;
    const apiHost =
      typeof entry.api_host === "string" && entry.api_host.trim()
        ? entry.api_host.trim()
        : hostname;
    const user = typeof entry.user === "string" ? entry.user : undefined;
    out.push({ hostname, apiHost, token, user });
  }
  // Stable order: glab default host first, then alpha
  const def = glab.host ? hostKey(glab.host) : null;
  out.sort((a, b) => {
    if (def) {
      if (a.hostname === def) return -1;
      if (b.hostname === def) return 1;
    }
    return a.hostname.localeCompare(b.hostname);
  });
  return out;
}

function pickHostEntry(
  glab: GlabConfig,
  preferredHost?: string,
): { hostKey: string; entry: { token?: string; api_host?: string; user?: string } } | null {
  const preferred = preferredHost ?? glab.host ?? Object.keys(glab.hosts)[0];
  if (!preferred) return null;

  const key = hostKey(preferred);
  const entry =
    glab.hosts[key] ??
    glab.hosts[preferred] ??
    Object.entries(glab.hosts).find(([k]) => k.includes(key) || key.includes(k))?.[1];

  if (!entry) {
    for (const [hostKeyName, e] of Object.entries(glab.hosts)) {
      if (e?.token) return { hostKey: hostKeyName, entry: e };
    }
    return null;
  }
  return { hostKey: key, entry };
}

/**
 * Resolve host + token **only via glab**.
 *
 * - glab missing → error with install + authenticate steps
 * - glab present but no token / not logged in → error with authenticate step
 *   (and install reminder if config is totally empty)
 */
export async function resolveAuth(preferredHost?: string): Promise<AuthResolved> {
  if (!isGlabInstalled()) {
    throw new AuthError(
      "glab_not_installed",
      "glab is not installed (or not on PATH). ciview uses glab for GitLab credentials.",
      [INSTALL_STEP, AUTH_STEP],
    );
  }

  const glab = await readGlabConfig();
  if (!glab || Object.keys(glab.hosts).length === 0) {
    throw new AuthError(
      "glab_not_authenticated",
      "glab is installed but not authenticated (no hosts in glab config).",
      [AUTH_STEP],
    );
  }

  const picked = pickHostEntry(glab, preferredHost);
  const token = picked?.entry.token?.trim();
  if (!token) {
    throw new AuthError(
      "glab_no_token",
      preferredHost
        ? `glab has no API token for host "${hostKey(preferredHost)}".`
        : "glab is installed but no API token was found for the active host.",
      [AUTH_STEP],
    );
  }

  const host = normalizeHost(
    picked!.entry.api_host ? `https://${picked!.entry.api_host}` : picked!.hostKey,
  );

  return { host, token, tokenSource: "glab" };
}

/** Match a saved pref / CLI host against authenticated glab hosts. */
export function findHostOption(
  hosts: GlabHostEntry[],
  preferred: string | null | undefined,
): GlabHostEntry | null {
  if (!preferred) return null;
  const key = hostKey(preferred);
  return (
    hosts.find((h) => h.hostname === key || h.apiHost === key) ??
    hosts.find((h) => key.includes(h.hostname) || h.hostname.includes(key)) ??
    null
  );
}
