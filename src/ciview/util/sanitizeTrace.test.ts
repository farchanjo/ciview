import { describe, expect, test } from "bun:test";
import { sanitizeTrace, tailLines } from "./sanitizeTrace.ts";
import { groupJobsByStage, firstFailedJobName } from "../gitlab/map.ts";
import type { Job } from "../gitlab/types.ts";
import { PRIORITY } from "../runtime/priorities.ts";

describe("sanitizeTrace", () => {
  test("keeps newlines and strips NULs", () => {
    expect(sanitizeTrace("a\x00b\nc")).toBe("a b\nc");
  });
});

describe("tailLines", () => {
  test("keeps last N lines", () => {
    expect(tailLines("a\nb\nc\nd", 2)).toBe("c\nd");
  });
});

describe("groupJobsByStage", () => {
  test("preserves stage order", () => {
    const jobs: Job[] = [
      { id: 1, pipelineId: 1, name: "build", stage: "build", status: "success", allowFailure: false },
      { id: 2, pipelineId: 1, name: "test", stage: "test", status: "failed", allowFailure: false },
      { id: 3, pipelineId: 1, name: "lint", stage: "test", status: "success", allowFailure: false },
    ];
    const stages = groupJobsByStage(jobs);
    expect(stages.map((s) => s.name)).toEqual(["build", "test"]);
    expect(firstFailedJobName(jobs)).toBe("test");
  });
});

describe("priorities", () => {
  test("user outranks poll", () => {
    expect(PRIORITY.user).toBeGreaterThan(PRIORITY.poll);
    expect(PRIORITY.poll).toBeGreaterThan(PRIORITY.idle);
  });
});
