export type KeyCategory =
  | "General"
  | "Projects"
  | "Graph"
  | "Log"
  | "CI";

export interface KeyBinding {
  key: string;
  label: string;
  category: KeyCategory;
}

/** Single source of truth for Help overlay + docs (feature 002 / 004). */
export const KEY_BINDINGS: KeyBinding[] = [
  { key: "?", label: "Toggle Help", category: "General" },
  {
    key: "q / Ctrl+C / SIGTERM",
    label: "Quit gracefully (Help open: Esc/? first; never rely on kill -9)",
    category: "General",
  },
  { key: "Tab", label: "Cycle focus zones", category: "General" },
  { key: "s [ ]", label: "Toggle / hide / show sidebar", category: "General" },
  {
    key: "H",
    label: "Switch GitLab host (multi-host only; 1 host = skip)",
    category: "General",
  },

  { key: "j/k", label: "Move project cursor (no open)", category: "Projects" },
  { key: "Enter", label: "Open project → stage board", category: "Projects" },
  { key: "/", label: "Filter projects (live)", category: "Projects" },
  { key: "m", label: "Scope smart→pinned→all", category: "Projects" },
  { key: "p", label: "Pin project under cursor", category: "Projects" },

  { key: "h/l", label: "Stage columns (or strip)", category: "Graph" },
  { key: "j/k", label: "Jobs in stage / pipelines", category: "Graph" },
  { key: "Enter", label: "Open job log", category: "Graph" },
  { key: "Esc", label: "Close log / back to projects", category: "Graph" },
  { key: "2/3", label: "Focus strip / board", category: "Graph" },

  { key: "Enter on job", label: "Open smart log modal / dive into bridge", category: "Log" },
  { key: "j/k", label: "Scroll log (up pauses follow)", category: "Log" },
  { key: "n/N", label: "Next / previous error in log", category: "Log" },
  { key: "e", label: "Cycle log mode smart→errors→all", category: "Log" },
  { key: "g/G", label: "Log top / end (follow)", category: "Log" },
  { key: "PgUp/PgDn", label: "Full page up / down in log", category: "Log" },
  { key: "Space/b", label: "Half page down / up in log", category: "Log" },
  { key: "Esc", label: "Close log / pop child pipeline", category: "Log" },
  { key: "f", label: "Toggle log follow (on → jump bottom)", category: "Log" },

  { key: "r", label: "Refresh focused zone", category: "CI" },
  { key: "R", label: "Toggle live poll", category: "CI" },
  { key: "o", label: "Open web_url", category: "CI" },
];

export const STATUS_HINT =
  "?:help  H:host  j/k  Enter  h/l board  log:n/e/j/k  Esc  / m p  r R  q";

export function bindingsByCategory(): Map<KeyCategory, KeyBinding[]> {
  const map = new Map<KeyCategory, KeyBinding[]>();
  for (const b of KEY_BINDINGS) {
    const list = map.get(b.category) ?? [];
    list.push(b);
    map.set(b.category, list);
  }
  return map;
}
