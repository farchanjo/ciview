import { describe, expect, test } from "bun:test";
import {
  firstFailedJobName,
  groupJobsByStage,
  mapBridge,
  mapJob,
  mapPipeline,
} from "./map.ts";
import type { Job } from "./types.ts";

describe("mapPipeline (FR-03/04)", () => {
  test("maps duration and core fields", () => {
    const p = mapPipeline({
      id: 10,
      iid: 3,
      project_id: 1,
      sha: "abc",
      ref: "main",
      status: "failed",
      source: "push",
      web_url: "https://gl.example/p/-/pipelines/10",
      created_at: "2026-01-01T00:00:00Z",
      duration: 125,
    });
    expect(p.iid).toBe(3);
    expect(p.duration).toBe(125);
    expect(p.source).toBe("push");
    expect(p.status).toBe("failed");
  });
});

describe("mapJob / mapBridge (FR-05/13)", () => {
  test("mapJob maps duration, started_at and allow_failure", () => {
    const j = mapJob({
      id: 99,
      name: "test",
      stage: "test",
      status: "success",
      allow_failure: true,
      duration: 42.2,
      started_at: "2026-07-14T12:00:00Z",
      pipeline: { id: 10 },
    });
    expect(j.duration).toBe(42.2);
    expect(j.startedAt).toBe("2026-07-14T12:00:00Z");
    expect(j.allowFailure).toBe(true);
    expect(j.isBridge).toBeUndefined();
  });

  test("mapBridge flags child pipeline", () => {
    const j = mapBridge({
      id: 7,
      name: "trigger-child",
      stage: "deploy",
      status: "running",
      pipeline: { id: 10 },
      downstream_pipeline: { id: 55, status: "running" },
      web_url: "https://gl.example/bridge",
    });
    expect(j.isBridge).toBe(true);
    expect(j.downstreamPipelineId).toBe(55);
    expect(j.name).toContain("trigger-child");
    expect(j.stage).toBe("deploy");
  });

  test("groupJobsByStage includes bridges in stage order", () => {
    const jobs: Job[] = [
      mapJob({ id: 1, name: "build", stage: "build", status: "success", pipeline: { id: 1 } }),
      mapBridge({
        id: 2,
        name: "child",
        stage: "trigger",
        status: "success",
        pipeline: { id: 1 },
        downstream_pipeline: { id: 9 },
      }),
    ];
    const stages = groupJobsByStage(jobs);
    expect(stages.map((s) => s.name)).toEqual(["build", "trigger"]);
    expect(stages[1]!.jobIds).toEqual([2]);
  });
});

describe("firstFailedJobName (FR-04)", () => {
  test("returns first hard-failed job, skips allow_failure", () => {
    const jobs: Job[] = [
      {
        id: 1,
        pipelineId: 1,
        name: "lint",
        stage: "test",
        status: "failed",
        allowFailure: true,
      },
      {
        id: 2,
        pipelineId: 1,
        name: "unit",
        stage: "test",
        status: "failed",
        allowFailure: false,
      },
    ];
    expect(firstFailedJobName(jobs)).toBe("unit");
  });

  test("undefined when no failures", () => {
    expect(
      firstFailedJobName([
        {
          id: 1,
          pipelineId: 1,
          name: "ok",
          stage: "test",
          status: "success",
          allowFailure: false,
        },
      ]),
    ).toBeUndefined();
  });
});
