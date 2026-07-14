import { describe, expect, test } from "bun:test";
import {
  assertBudgetFits,
  computeLayoutBudget,
  densityForHeight,
  effectiveSidebarVisible,
  logPageStep,
  sidebarWidthFor,
} from "./layoutBudget.ts";

describe("densityForHeight", () => {
  test("tiers", () => {
    expect(densityForHeight(18)).toBe("compact");
    expect(densityForHeight(28)).toBe("normal");
    expect(densityForHeight(48)).toBe("comfortable");
  });
});

describe("computeLayoutBudget fit invariants", () => {
  const cases: Array<[number, number]> = [
    [80, 24],
    [100, 30],
    [120, 40],
    [200, 60],
    [60, 18],
  ];

  for (const [w, h] of cases) {
    test(`${w}x${h} fits terminal`, () => {
      const b = computeLayoutBudget({
        termWidth: w,
        termHeight: h,
        sidebarPrefVisible: true,
        sidebarForce: null,
        stageCount: 4,
      });
      expect(assertBudgetFits(b)).toEqual([]);
      expect(b.termWidth).toBe(w);
      expect(b.termHeight).toBe(h);
      expect(b.logModal.contentRows).toBeGreaterThanOrEqual(6);
      expect(b.stageColWidth).toBeGreaterThanOrEqual(10);
      expect(b.logModal.width).toBeLessThanOrEqual(w);
      expect(b.logModal.height).toBeLessThanOrEqual(h);
      // stacked chrome estimate: status + strip + min board
      expect(b.statusRows + b.stripRows).toBeLessThan(h);
    });
  }

  test("narrow width auto-hides sidebar", () => {
    const b = computeLayoutBudget({
      termWidth: 90,
      termHeight: 40,
      sidebarPrefVisible: true,
      sidebarForce: null,
      stageCount: 3,
    });
    expect(b.sidebarVisibleEffective).toBe(false);
    expect(b.sidebarWidth).toBe(0);
  });

  test("force show sidebar on narrow", () => {
    const b = computeLayoutBudget({
      termWidth: 90,
      termHeight: 40,
      sidebarPrefVisible: false,
      sidebarForce: true,
      stageCount: 3,
    });
    expect(b.sidebarVisibleEffective).toBe(true);
    expect(b.sidebarWidth).toBeGreaterThanOrEqual(18);
  });

  test("more stages → narrower columns but still ≥10", () => {
    const few = computeLayoutBudget({
      termWidth: 120,
      termHeight: 40,
      sidebarPrefVisible: true,
      sidebarForce: true,
      stageCount: 2,
    });
    const many = computeLayoutBudget({
      termWidth: 120,
      termHeight: 40,
      sidebarPrefVisible: true,
      sidebarForce: true,
      stageCount: 8,
    });
    expect(many.stageColWidth).toBeLessThanOrEqual(few.stageColWidth);
    expect(many.stageColWidth).toBeGreaterThanOrEqual(10);
  });

  test("taller terminal → more log content rows", () => {
    const short = computeLayoutBudget({
      termWidth: 120,
      termHeight: 24,
      sidebarPrefVisible: true,
      sidebarForce: null,
      stageCount: 3,
    });
    const tall = computeLayoutBudget({
      termWidth: 120,
      termHeight: 60,
      sidebarPrefVisible: true,
      sidebarForce: null,
      stageCount: 3,
    });
    expect(tall.logModal.contentRows).toBeGreaterThan(short.logModal.contentRows);
  });

  test("logPageStep scales with contentRows", () => {
    const b = computeLayoutBudget({
      termWidth: 120,
      termHeight: 50,
      sidebarPrefVisible: true,
      sidebarForce: null,
      stageCount: 1,
    });
    expect(logPageStep(b)).toBeGreaterThanOrEqual(5);
    expect(logPageStep(b)).toBeLessThanOrEqual(b.logModal.contentRows);
  });
});

describe("effectiveSidebarVisible / sidebarWidthFor", () => {
  test("force overrides", () => {
    expect(effectiveSidebarVisible(false, true, 80)).toBe(true);
    expect(effectiveSidebarVisible(true, false, 200)).toBe(false);
  });

  test("sidebar width caps", () => {
    expect(sidebarWidthFor(200, true)).toBeLessThanOrEqual(32);
    expect(sidebarWidthFor(80, true)).toBeGreaterThanOrEqual(18);
    expect(sidebarWidthFor(120, false)).toBe(0);
  });
});
