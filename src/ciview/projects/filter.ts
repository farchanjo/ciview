import type { RecentMode } from "../config/prefs.ts";
import { projectActivityRankMs } from "../gitlab/map.ts";
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
  recentLimit: number;
  recentMode: RecentMode;
  recentExpanded: boolean;
  moreCount: number;
}

/** Space-separated tokens: all must match path or name (case-insensitive). */
export function matchesProjectQuery(project: Project, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const hay = `${project.pathWithNamespace} ${project.name}`.toLowerCase();
  const tokens = q.split(/\s+/).filter(Boolean);
  return tokens.every((t) => hay.includes(t));
}

function sortByOpenedRecent(items: Project[], recent: string[]): Project[] {
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

function sortByActivity(items: Project[]): Project[] {
  return [...items].sort((a, b) => {
    if (a.pinned !== b.pinned) return Number(b.pinned) - Number(a.pinned);
    const da = projectActivityRankMs(a);
    const db = projectActivityRankMs(b);
    if (db !== da) return db - da;
    return a.pathWithNamespace.localeCompare(b.pathWithNamespace);
  });
}

export const RECENT_LIMIT_COLLAPSED = 10;
export const RECENT_LIMIT_EXPANDED = 20;

export function recentLimitFor(expanded: boolean): number {
  return expanded ? RECENT_LIMIT_EXPANDED : RECENT_LIMIT_COLLAPSED;
}

/**
 * Build sidebar sections.
 * - smart: pinned + recent (cap) + MORE stub (search for the rest)
 * - pinned: only pins
 * - all: flat sorted list (respect query)
 */
export function buildProjectView(
  all: Project[],
  opts: {
    query: string;
    scope: ProjectScope;
    recent: string[];
    recentMode?: RecentMode;
    recentExpanded?: boolean;
  },
): ProjectViewModel {
  const { query, scope, recent } = opts;
  const recentMode: RecentMode = opts.recentMode ?? "activity";
  const recentExpanded = opts.recentExpanded === true;
  const limit = recentLimitFor(recentExpanded);
  const matched = all.filter((p) => matchesProjectQuery(p, query));
  const byPath = new Map(matched.map((p) => [p.pathWithNamespace, p]));
  const hasQuery = query.trim().length > 0;

  if (scope === "pinned") {
    const items =
      recentMode === "activity"
        ? sortByActivity(matched.filter((p) => p.pinned))
        : sortByOpenedRecent(
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
      recentLimit: limit,
      recentMode,
      recentExpanded,
      moreCount: 0,
    };
  }

  if (scope === "all") {
    const items =
      recentMode === "activity"
        ? sortByActivity(matched)
        : sortByOpenedRecent(matched, recent);
    return {
      sections: [{ id: "rest", title: hasQuery ? "MATCHES" : "ALL", items }],
      flat: items,
      total: all.length,
      shown: items.length,
      query,
      scope,
      recentLimit: limit,
      recentMode,
      recentExpanded,
      moreCount: 0,
    };
  }

  // smart
  const pinned =
    recentMode === "activity"
      ? sortByActivity(matched.filter((p) => p.pinned))
      : sortByOpenedRecent(
          matched.filter((p) => p.pinned),
          recent,
        );
  const pinnedPaths = new Set(pinned.map((p) => p.pathWithNamespace));

  let recentPool: Project[];
  if (recentMode === "opened") {
    recentPool = [];
    for (const path of recent) {
      if (pinnedPaths.has(path)) continue;
      const p = byPath.get(path);
      if (p) recentPool.push(p);
    }
  } else {
    recentPool = sortByActivity(
      matched.filter((p) => !pinnedPaths.has(p.pathWithNamespace)),
    );
  }

  const recentItems = hasQuery ? recentPool : recentPool.slice(0, limit);
  const recentPaths = new Set(recentItems.map((p) => p.pathWithNamespace));

  const restPool =
    recentMode === "activity"
      ? sortByActivity(
          matched.filter(
            (p) =>
              !pinnedPaths.has(p.pathWithNamespace) &&
              !recentPaths.has(p.pathWithNamespace),
          ),
        )
      : sortByOpenedRecent(
          matched.filter(
            (p) =>
              !pinnedPaths.has(p.pathWithNamespace) &&
              !recentPaths.has(p.pathWithNamespace),
          ),
          recent,
        );

  // With query: show all matches under MATCHES (no cap). Without: MORE stub only.
  const sections: ProjectSection[] = [];
  if (pinned.length) sections.push({ id: "pinned", title: "PINNED", items: pinned });

  const recentTitle =
    recentMode === "activity" ? "RECENT" : "RECENT";
  if (recentItems.length) {
    sections.push({
      id: "recent",
      title: recentTitle,
      items: recentItems,
    });
  }

  let moreCount = 0;
  if (hasQuery) {
    if (restPool.length) {
      sections.push({
        id: "rest",
        title: "MATCHES",
        items: restPool,
      });
    }
  } else {
    // activity: rest is everything after cap; opened: rest is non-recent membership
    moreCount =
      recentMode === "activity"
        ? Math.max(0, recentPool.length - recentItems.length)
        : restPool.length;
    // also count unpinned not in recent pool for opened mode when list is huge
    if (recentMode === "opened") {
      moreCount = matched.filter(
        (p) => !pinnedPaths.has(p.pathWithNamespace) && !recentPaths.has(p.pathWithNamespace),
      ).length;
    }
    if (moreCount > 0 || (!pinned.length && !recentItems.length && restPool.length)) {
      const expandHint = !recentExpanded && recentMode === "activity" ? " · x expand" : "";
      sections.push({
        id: "rest",
        title: `MORE (${moreCount || restPool.length} · / filter${expandHint})`,
        items: [],
      });
      if (!moreCount) moreCount = restPool.length;
    }
  }

  const flat = sections.flatMap((s) => s.items);
  return {
    sections,
    flat,
    total: all.length,
    shown: flat.length,
    query,
    scope,
    recentLimit: limit,
    recentMode,
    recentExpanded,
    moreCount,
  };
}

export function cycleScope(current: ProjectScope): ProjectScope {
  if (current === "smart") return "pinned";
  if (current === "pinned") return "all";
  return "smart";
}

export function cycleRecentMode(current: RecentMode): RecentMode {
  return current === "activity" ? "opened" : "activity";
}

export function pushRecent(recent: string[], path: string, max = 20): string[] {
  const next = [path, ...recent.filter((p) => p !== path)];
  return next.slice(0, max);
}
