import { describe, expect, test } from "bun:test";
import { hasActiveCi, shouldEnqueuePoll } from "./policy.ts";

describe("shouldEnqueuePoll (FR-08b)", () => {
  test("live off never polls", () => {
    expect(
      shouldEnqueuePoll({
        live: false,
        projectId: 1,
        pipelineStatuses: ["running"],
        jobStatuses: [],
      }),
    ).toBe(false);
  });

  test("live on + open project polls even when fully idle", () => {
    expect(
      shouldEnqueuePoll({
        live: true,
        projectId: 42,
        pipelineStatuses: ["success", "failed"],
        jobStatuses: ["success"],
      }),
    ).toBe(true);
  });

  test("live on + no project open does not poll", () => {
    expect(
      shouldEnqueuePoll({
        live: true,
        projectId: null,
        pipelineStatuses: [],
        jobStatuses: [],
      }),
    ).toBe(false);
  });
});

describe("hasActiveCi", () => {
  test("detects running pipeline or job", () => {
    expect(hasActiveCi(["success"], ["running"])).toBe(true);
    expect(hasActiveCi(["pending"], [])).toBe(true);
    expect(hasActiveCi(["success"], ["failed"])).toBe(false);
  });
});
