import type { Job, Pipeline, Project, StageGroup } from "./types.ts";

export function mapProject(raw: Record<string, unknown>, pinned: boolean): Project {
  return {
    id: Number(raw.id),
    pathWithNamespace: String(raw.path_with_namespace ?? raw.pathWithNamespace ?? ""),
    name: String(raw.name ?? ""),
    webUrl: String(raw.web_url ?? raw.webUrl ?? ""),
    pinned,
  };
}

export function mapPipeline(raw: Record<string, unknown>): Pipeline {
  return {
    id: Number(raw.id),
    iid: Number(raw.iid),
    projectId: Number(raw.project_id ?? raw.projectId),
    sha: String(raw.sha ?? ""),
    ref: String(raw.ref ?? ""),
    status: String(raw.status ?? "unknown"),
    source: raw.source != null ? String(raw.source) : undefined,
    webUrl: String(raw.web_url ?? raw.webUrl ?? ""),
    createdAt: raw.created_at != null ? String(raw.created_at) : undefined,
    updatedAt: raw.updated_at != null ? String(raw.updated_at) : undefined,
    duration: raw.duration != null ? Number(raw.duration) : undefined,
  };
}

export function mapJob(raw: Record<string, unknown>): Job {
  const pipeline = raw.pipeline as Record<string, unknown> | undefined;
  return {
    id: Number(raw.id),
    pipelineId: Number(pipeline?.id ?? raw.pipeline_id ?? 0),
    name: String(raw.name ?? ""),
    stage: String(raw.stage ?? ""),
    status: String(raw.status ?? "unknown"),
    allowFailure: Boolean(raw.allow_failure ?? raw.allowFailure ?? false),
    webUrl: raw.web_url != null ? String(raw.web_url) : undefined,
    duration: raw.duration != null ? Number(raw.duration) : undefined,
    startedAt: raw.started_at != null ? String(raw.started_at) : undefined,
  };
}

/** Map a bridge job (trigger) into a Job-like row for the stage board. */
export function mapBridge(raw: Record<string, unknown>): Job {
  const downstream = raw.downstream_pipeline as Record<string, unknown> | undefined;
  const pipeline = raw.pipeline as Record<string, unknown> | undefined;
  return {
    id: Number(raw.id),
    pipelineId: Number(pipeline?.id ?? raw.pipeline_id ?? 0),
    name: `↳ ${String(raw.name ?? "child")}`,
    stage: String(raw.stage ?? "trigger"),
    status: String(raw.status ?? downstream?.status ?? "unknown"),
    allowFailure: Boolean(raw.allow_failure ?? false),
    webUrl: raw.web_url != null ? String(raw.web_url) : undefined,
    duration: raw.duration != null ? Number(raw.duration) : undefined,
    startedAt: raw.started_at != null ? String(raw.started_at) : undefined,
    isBridge: true,
    downstreamPipelineId: downstream?.id != null ? Number(downstream.id) : undefined,
  };
}

export function groupJobsByStage(jobs: Job[]): StageGroup[] {
  const order: string[] = [];
  const map = new Map<string, number[]>();
  for (const job of jobs) {
    if (!map.has(job.stage)) {
      map.set(job.stage, []);
      order.push(job.stage);
    }
    map.get(job.stage)!.push(job.id);
  }
  return order.map((name) => ({ name, jobIds: map.get(name)! }));
}

export function firstFailedJobName(jobs: Job[]): string | undefined {
  const hit = jobs.find((j) => j.status === "failed" && !j.allowFailure);
  return hit?.name;
}
