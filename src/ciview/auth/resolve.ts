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

function normalizeHost(raw: string): string {
  let h = raw.trim().replace(/\/$/, "");
  if (!h.startsWith("http://") && !h.startsWith("https://")) {
    h = `https://${h}`;
  }
  return h;
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

async function readGlabConfig(): Promise<{
  hosts: Record<string, { token?: string; api_host?: string }>;
  host?: string;
} | null> {
  const path = join(homedir(), ".config", "glab-cli", "config.yml");
  const file = Bun.file(path);
  if (!(await file.exists())) return null;
  try {
    const text = await file.text();
    const doc = parseYaml(text) as Record<string, unknown>;
    const hosts = (doc.hosts ?? {}) as Record<string, { token?: string; api_host?: string }>;
    const host = typeof doc.host === "string" ? doc.host : undefined;
    return { hosts, host };
  } catch {
    return null;
  }
}

function pickHostEntry(
  glab: { hosts: Record<string, { token?: string; api_host?: string }>; host?: string },
  preferredHost?: string,
): { hostKey: string; entry: { token?: string; api_host?: string } } | null {
  const preferred =
    preferredHost ??
    glab.host ??
    Object.keys(glab.hosts)[0];
  if (!preferred) return null;

  const key = preferred.replace(/^https?:\/\//, "").replace(/\/$/, "");
  const entry =
    glab.hosts[key] ??
    glab.hosts[preferred] ??
    Object.entries(glab.hosts).find(([k]) => k.includes(key) || key.includes(k))?.[1];

  if (!entry) {
    // first host with a token
    for (const [hostKey, e] of Object.entries(glab.hosts)) {
      if (e?.token) return { hostKey, entry: e };
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
  const token = picked?.entry.token;
  if (!token) {
    throw new AuthError(
      "glab_no_token",
      "glab is installed but no API token was found for the active host.",
      [AUTH_STEP],
    );
  }

  const host = normalizeHost(
    picked!.entry.api_host ? `https://${picked!.entry.api_host}` : picked!.hostKey,
  );

  return { host, token, tokenSource: "glab" };
}
