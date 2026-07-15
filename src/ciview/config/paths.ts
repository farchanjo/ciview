import { homedir } from "node:os";
import { join } from "node:path";

/** XDG-style config root: `$XDG_CONFIG_HOME/ciview` or `~/.config/ciview`. */
export function configDir(): string {
  const xdg = process.env.XDG_CONFIG_HOME;
  if (xdg) return join(xdg, "ciview");
  return join(homedir(), ".config", "ciview");
}

export function configPath(): string {
  return join(configDir(), "config.json");
}

export function logsDir(): string {
  return join(configDir(), "logs");
}

export function logFilePath(): string {
  return join(logsDir(), "ciview.log");
}
