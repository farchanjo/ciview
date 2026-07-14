import type { Project } from "../gitlab/types.ts";

export type ProjectScope = "smart" | "pinned" | "all";

export interface ProjectSection {
  id: "pinned" | "recent" | "rest";
  title: string;
  items: Project[];
}

export interface ProjectViewModel {
  sections: ProjectSection[];
  /** Flat list for j/k cursor (section headers are not included). */
  flat: Project[];
  total: number;
  shown: number;
  query: string;
  scope: ProjectScope;
}

/** Space-separated tokens: all must match path or name (case-insensitive). */
export function matchesProjectQuery(project: Project, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const hay = `${project.pathWithNamespace} ${project.name}`.toLowerCase();
  const tokens = q.split(/\s+/).filter(Boolean);
  return tokens.every((t) => hay.includes(t));
}

function sortProjects(items: Project[], recent: string[]): Project[] {
  const recentRank = new Map(recent.map((p, i) => [p, i]));
  return [...items].sort((a, b) => {
    if (a.pinned !== b.pinned) return Number(b.pinned) - Number(a.pinned);
    const ra = recentRank.has(a.pathWithNamespace)
      ? recentRank.get(a.pathWithNamespace)!
      : 999;
    const rb = recentRank.has(b.pathWithNamespace)
      ? recentRank.get(b.pathWithNamespace)!
      : 999;
    if (ra !== rb) return ra - rb;
    return a.pathWithNamespace.localeCompare(b.pathWithNamespace);
  });
}

/**
 * Build sidebar sections.
 * - smart: pinned + recent (unpinned) + remaining matches (when query or scope all)
 * - pinned: only pins (respect query)
 * - all: flat sorted list (respect query), single section
 */
export function buildProjectView(
  all: Project[],
  opts: {
    query: string;
    scope: ProjectScope;
    recent: string[];
  },
): ProjectViewModel {
  const { query, scope, recent } = opts;
  const matched = all.filter((p) => matchesProjectQuery(p, query));
  const byPath = new Map(matched.map((p) => [p.pathWithNamespace, p]));

  if (scope === "pinned") {
    const items = sortProjects(
      matched.filter((p) => p.pinned),
      recent,
    );
    return {
      sections: [{ id: "pinned", title: "PINNED", items }],
      flat: items,
      total: all.length,
      shown: items.length,
      query,
      scope,
    };
  }

  if (scope === "all") {
    const items = sortProjects(matched, recent);
    return {
      sections: [{ id: "rest", title: query.trim() ? "MATCHES" : "ALL", items }],
      flat: items,
      total: all.length,
      shown: items.length,
      query,
      scope,
    };
  }

  // smart
  const pinned = sortProjects(
    matched.filter((p) => p.pinned),
    recent,
  );
  const pinnedPaths = new Set(pinned.map((p) => p.pathWithNamespace));

  const recentItems: Project[] = [];
  for (const path of recent) {
    if (pinnedPaths.has(path)) continue;
    const p = byPath.get(path);
    if (p) recentItems.push(p);
  }
  const recentPaths = new Set(recentItems.map((p) => p.pathWithNamespace));

  const rest = sortProjects(
    matched.filter(
      (p) => !pinnedPaths.has(p.pathWithNamespace) && !recentPaths.has(p.pathWithNamespace),
    ),
    recent,
  );

  // Without query: smart shows pinned + recent only (avoid chaos). With query: also rest matches.
  const showRest = query.trim().length > 0 || rest.length <= 30;
  const sections: ProjectSection[] = [];
  if (pinned.length) sections.push({ id: "pinned", title: "PINNED", items: pinned });
  if (recentItems.length) sections.push({ id: "recent", title: "RECENT", items: recentItems });
  if (showRest && rest.length) {
    sections.push({
      id: "rest",
      title: query.trim() ? "MATCHES" : "ALL",
      items: rest,
    });
  } else if (!query.trim() && rest.length > 30 && !pinned.length && !recentItems.length) {
    // cold start: no pins/recent — show first chunk alphabetically + hint via title
    sections.push({
      id: "rest",
      title: `ALL (top 40 · / to filter · ${rest.length} total)`,
      items: rest.slice(0, 40),
    });
  } else if (!query.trim() && rest.length > 30) {
    sections.push({
      id: "rest",
      title: `MORE (${rest.length} · type / to filter)`,
      items: [],
    });
  }

  const flat = sections.flatMap((s) => s.items);
  return {
    sections,
    flat,
    total: all.length,
    shown: flat.length,
    query,
    scope,
  };
}

export function cycleScope(current: ProjectScope): ProjectScope {
  if (current === "smart") return "pinned";
  if (current === "pinned") return "all";
  return "smart";
}

export function pushRecent(recent: string[], path: string, max = 12): string[] {
  const next = [path, ...recent.filter((p) => p !== path)];
  return next.slice(0, max);
}
