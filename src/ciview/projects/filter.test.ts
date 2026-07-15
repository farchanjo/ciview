import { describe, expect, test } from "bun:test";
import type { Project } from "../gitlab/types.ts";
import {
  buildProjectView,
  cycleRecentMode,
  cycleScope,
  matchesProjectQuery,
  pushRecent,
  RECENT_LIMIT_COLLAPSED,
  RECENT_LIMIT_EXPANDED,
} from "./filter.ts";

function p(
  path: string,
  opts: { pinned?: boolean; lastActivityAt?: string; lastPipelineAt?: string } = {},
): Project {
  return {
    id: path.length + path.charCodeAt(0),
    pathWithNamespace: path,
    name: path.split("/").pop()!,
    webUrl: `https://x/${path}`,
    pinned: opts.pinned ?? false,
    lastActivityAt: opts.lastActivityAt,
    lastPipelineAt: opts.lastPipelineAt,
  };
}

describe("matchesProjectQuery", () => {
  test("multi-token AND", () => {
    const proj = p("infra/csseed");
    expect(matchesProjectQuery(proj, "infra")).toBe(true);
    expect(matchesProjectQuery(proj, "infra seed")).toBe(true);
    expect(matchesProjectQuery(proj, "infra no")).toBe(false);
  });
});

describe("buildProjectView smart activity", () => {
  const all = [
    p("infra/a", { pinned: true, lastActivityAt: "2026-01-01T00:00:00Z" }),
    p("infra/b", { lastActivityAt: "2026-06-01T00:00:00Z" }),
    p("apps/web", { lastActivityAt: "2026-07-01T00:00:00Z", lastPipelineAt: "2026-07-10T00:00:00Z" }),
    p("apps/api", { lastActivityAt: "2026-05-01T00:00:00Z" }),
    p("backend/accouting", { lastActivityAt: "2026-04-01T00:00:00Z" }),
  ];

  test("activity mode ranks by lastPipelineAt then lastActivityAt", () => {
    const view = buildProjectView(all, {
      query: "",
      scope: "smart",
      recent: [],
      recentMode: "activity",
      recentExpanded: false,
    });
    const recent = view.sections.find((s) => s.id === "recent")?.items ?? [];
    expect(recent[0]?.pathWithNamespace).toBe("apps/web");
    expect(recent.map((x) => x.pathWithNamespace)).not.toContain("infra/a");
  });

  test("opened mode uses prefs recent order", () => {
    const view = buildProjectView(all, {
      query: "",
      scope: "smart",
      recent: ["apps/api", "infra/b"],
      recentMode: "opened",
    });
    const recent = view.sections.find((s) => s.id === "recent")?.items ?? [];
    expect(recent.map((x) => x.pathWithNamespace)).toEqual(["apps/api", "infra/b"]);
  });

  test("caps recent at 10 unless expanded", () => {
    const many = Array.from({ length: 30 }, (_, i) =>
      p(`g/p${i}`, {
        lastActivityAt: new Date(Date.UTC(2026, 0, 1 + i)).toISOString(),
      }),
    );
    const collapsed = buildProjectView(many, {
      query: "",
      scope: "smart",
      recent: [],
      recentMode: "activity",
      recentExpanded: false,
    });
    const expanded = buildProjectView(many, {
      query: "",
      scope: "smart",
      recent: [],
      recentMode: "activity",
      recentExpanded: true,
    });
    expect(collapsed.sections.find((s) => s.id === "recent")?.items.length).toBe(
      RECENT_LIMIT_COLLAPSED,
    );
    expect(expanded.sections.find((s) => s.id === "recent")?.items.length).toBe(
      RECENT_LIMIT_EXPANDED,
    );
    const more = collapsed.sections.find((s) => s.id === "rest");
    expect(more?.items.length).toBe(0);
    expect(collapsed.moreCount).toBe(20);
  });

  test("with query shows matches beyond cap", () => {
    const view = buildProjectView(all, {
      query: "apps",
      scope: "smart",
      recent: [],
      recentMode: "activity",
    });
    expect(view.flat.every((x) => x.pathWithNamespace.includes("apps"))).toBe(true);
    expect(view.shown).toBe(2);
  });

  test("pinned scope only pins", () => {
    const view = buildProjectView(all, {
      query: "",
      scope: "pinned",
      recent: [],
      recentMode: "activity",
    });
    expect(view.flat.every((x) => x.pinned)).toBe(true);
  });
});

describe("cycleScope / cycleRecentMode", () => {
  test("smart → pinned → all → smart", () => {
    expect(cycleScope("smart")).toBe("pinned");
    expect(cycleScope("pinned")).toBe("all");
    expect(cycleScope("all")).toBe("smart");
  });

  test("activity ↔ opened", () => {
    expect(cycleRecentMode("activity")).toBe("opened");
    expect(cycleRecentMode("opened")).toBe("activity");
  });
});

describe("pushRecent", () => {
  test("dedupes and caps", () => {
    expect(pushRecent(["a", "b"], "c", 2)).toEqual(["c", "a"]);
    expect(pushRecent(["a", "b"], "a", 5)).toEqual(["a", "b"]);
  });
});
