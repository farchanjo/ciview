import { describe, expect, test } from "bun:test";
import type { Project } from "../gitlab/types.ts";
import {
  buildProjectView,
  cycleScope,
  matchesProjectQuery,
  pushRecent,
} from "./filter.ts";

function p(path: string, pinned = false): Project {
  return {
    id: path.length,
    pathWithNamespace: path,
    name: path.split("/").pop()!,
    webUrl: `https://x/${path}`,
    pinned,
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

describe("buildProjectView smart", () => {
  const all = [
    p("infra/a", true),
    p("infra/b"),
    p("apps/web"),
    p("apps/api"),
    p("backend/accouting"),
  ];

  test("without query hides huge rest when pins/recent exist", () => {
    const view = buildProjectView(all, {
      query: "",
      scope: "smart",
      recent: ["apps/web"],
    });
    expect(view.sections.some((s) => s.id === "pinned")).toBe(true);
    expect(view.sections.some((s) => s.id === "recent")).toBe(true);
    const rest = view.sections.find((s) => s.id === "rest");
    // either empty MORE section or not full dump
    if (rest) {
      expect(rest.items.length).toBeLessThan(all.length);
    }
  });

  test("with query shows matches", () => {
    const view = buildProjectView(all, {
      query: "apps",
      scope: "smart",
      recent: [],
    });
    expect(view.flat.every((x) => x.pathWithNamespace.includes("apps"))).toBe(true);
    expect(view.shown).toBe(2);
  });

  test("pinned scope only pins", () => {
    const view = buildProjectView(all, { query: "", scope: "pinned", recent: [] });
    expect(view.flat.every((x) => x.pinned)).toBe(true);
  });
});

describe("cycleScope", () => {
  test("smart → pinned → all → smart", () => {
    expect(cycleScope("smart")).toBe("pinned");
    expect(cycleScope("pinned")).toBe("all");
    expect(cycleScope("all")).toBe("smart");
  });
});

describe("pushRecent", () => {
  test("dedupes and caps", () => {
    expect(pushRecent(["a", "b"], "c", 2)).toEqual(["c", "a"]);
    expect(pushRecent(["a", "b"], "a", 5)).toEqual(["a", "b"]);
  });
});
