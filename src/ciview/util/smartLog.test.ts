import { describe, expect, test } from "bun:test";
import {
  buildLogView,
  classifyLine,
  cycleLogMode,
  logVisibleLines,
  scrollToViewIndex,
  stripAnsi,
} from "./smartLog.ts";

describe("stripAnsi", () => {
  test("removes CSI color sequences", () => {
    expect(stripAnsi("\x1b[31mred\x1b[0m")).toBe("red");
  });
});

describe("classifyLine", () => {
  test("detects errors", () => {
    expect(classifyLine("Error: boom")).toBe("error");
    expect(classifyLine("npm ERR! code ERESOLVE")).toBe("error");
    expect(classifyLine("BUILD FAILED")).toBe("error");
    expect(classifyLine("exit code 1")).toBe("error");
  });

  test("detects warnings and sections", () => {
    expect(classifyLine("WARNING: deprecated API")).toBe("warn");
    expect(classifyLine("section_start:123:build")).toBe("section");
    expect(classifyLine("=== deploy ===")).toBe("section");
  });

  test("detects ok and noise", () => {
    expect(classifyLine("✓ all tests passed")).toBe("ok");
    expect(classifyLine("Downloading packages...")).toBe("noise");
  });
});

describe("buildLogView", () => {
  const sample = [
    "starting job",
    "Downloading artifacts",
    "section_start:1:test",
    "running tests",
    "Error: assertion failed",
    "  at main.ts:10",
    "more context after",
    "noise line 1",
    "noise line 2",
    "noise line 3",
    "noise line 4",
    "noise line 5",
    "Job failed: exit code 1",
  ].join("\n");

  test("all mode keeps every line", () => {
    const v = buildLogView(sample, "all");
    expect(v.view.length).toBe(13);
    expect(v.errorCount).toBeGreaterThanOrEqual(2);
  });

  test("errors mode keeps only error/warn", () => {
    const v = buildLogView(sample, "errors");
    expect(v.view.every((l) => l.type === "content" && (l.kind === "error" || l.kind === "warn"))).toBe(
      true,
    );
    expect(v.view.length).toBeGreaterThanOrEqual(2);
  });

  test("smart mode collapses noise with ellipsis", () => {
    const v = buildLogView(sample, "smart", 1, 2);
    const ellipsis = v.view.filter((l) => l.type === "ellipsis");
    expect(ellipsis.length).toBeGreaterThan(0);
    expect(v.errorViewIndices.length).toBeGreaterThan(0);
    // first error still present
    const texts = v.view
      .filter((l): l is Extract<typeof l, { type: "content" }> => l.type === "content")
      .map((l) => l.text);
    expect(texts.some((t) => t.includes("assertion failed"))).toBe(true);
  });
});

describe("cycleLogMode / scroll helpers", () => {
  test("cycles smart → errors → all → smart", () => {
    expect(cycleLogMode("smart")).toBe("errors");
    expect(cycleLogMode("errors")).toBe("all");
    expect(cycleLogMode("all")).toBe("smart");
  });

  test("logVisibleLines scales with terminal", () => {
    expect(logVisibleLines(40)).toBeGreaterThanOrEqual(10);
    expect(logVisibleLines(80)).toBeGreaterThan(logVisibleLines(40));
  });

  test("scrollToViewIndex parks target near top", () => {
    // 100 lines, show 20, target 50 → start ~48, fromBottom = 100-68 = 32
    const fromBottom = scrollToViewIndex(100, 50, 20, 2);
    expect(fromBottom).toBe(100 - (50 - 2 + 20));
  });
});
