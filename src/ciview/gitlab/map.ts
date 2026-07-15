import type { Job, Pipeline, Project, StageGroup } from "./types.ts";

export function mapProject(raw: Record<string, unknown>, pinned: boolean): Project {
  const lastActivity =
    raw.last_activity_at != null
      ? String(raw.last_activity_at)
      : raw.lastActivityAt != null
        ? String(raw.lastActivityAt)
        : undefined;
  return {
    id: Number(raw.id),
    pathWithNamespace: String(raw.path_with_namespace ?? raw.pathWithNamespace ?? ""),
    name: String(raw.name ?? ""),
    webUrl: String(raw.web_url ?? raw.webUrl ?? ""),
    pinned,
    lastActivityAt: lastActivity,
  };
}

/** Rank timestamp for RECENT activity mode: prefer last pipeline, else activity. */
export function projectActivityRankMs(p: Project): number {
  const iso = p.lastPipelineAt ?? p.lastActivityAt;
  if (!iso) return 0;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : 0;
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

/**
 * Group jobs into stage columns for the board.
 *
 * GitLab list-jobs defaults to id DESC, so first-seen stage order is often
 * reverse of pipeline order (deploy → build). Order stages by minimum job id
 * ascending — jobs are created in stage order, so min(id) ≈ pipeline order
 * (left → right: build → test → deploy).
 */
export function groupJobsByStage(jobs: Job[]): StageGroup[] {
  const map = new Map<string, number[]>();
  for (const job of jobs) {
    if (!map.has(job.stage)) map.set(job.stage, []);
    map.get(job.stage)!.push(job.id);
  }
  const stages: StageGroup[] = [];
  for (const [name, jobIds] of map) {
    jobIds.sort((a, b) => a - b);
    stages.push({ name, jobIds });
  }
  stages.sort((a, b) => (a.jobIds[0] ?? 0) - (b.jobIds[0] ?? 0));
  return stages;
}

export function firstFailedJobName(jobs: Job[]): string | undefined {
  const hit = jobs.find((j) => j.status === "failed" && !j.allowFailure);
  return hit?.name;
}
