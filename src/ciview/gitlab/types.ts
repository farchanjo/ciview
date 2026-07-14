export type CiStatus =
  | "created"
  | "pending"
  | "running"
  | "success"
  | "failed"
  | "canceled"
  | "cancelled"
  | "skipped"
  | "manual"
  | "scheduled"
  | "waiting_for_resource"
  | "preparing"
  | "waiting_for_callback"
  | "canceling"
  | string;

export type SliceStatus = "idle" | "loading" | "ready" | "error" | "stale";

/** Focus zones for feature 002 layout. */
export type PaneId = "projects" | "pipeline_strip" | "stage_board" | "job_log";

export interface Project {
  id: number;
  pathWithNamespace: string;
  name: string;
  webUrl: string;
  pulseStatus?: CiStatus;
  pinned: boolean;
}

export interface Pipeline {
  id: number;
  iid: number;
  projectId: number;
  sha: string;
  ref: string;
  status: CiStatus;
  source?: string;
  webUrl: string;
  createdAt?: string;
  updatedAt?: string;
  duration?: number;
  failedJobName?: string;
}

export interface Job {
  id: number;
  pipelineId: number;
  name: string;
  stage: string;
  status: CiStatus;
  allowFailure: boolean;
  webUrl?: string;
  duration?: number;
  /** True when this row comes from a bridge (trigger/child pipeline). */
  isBridge?: boolean;
  /** Downstream pipeline id if bridge. */
  downstreamPipelineId?: number;
}

export interface StageGroup {
  name: string;
  jobIds: number[];
}

export interface AuthResolved {
  host: string;
  token: string;
  tokenSource: "glab";
}

export const ACTIVE_STATUSES = new Set<string>([
  "created",
  "pending",
  "running",
  "waiting_for_resource",
  "preparing",
  "waiting_for_callback",
  "canceling",
]);

export function isActiveStatus(status: string | undefined): boolean {
  return !!status && ACTIVE_STATUSES.has(status);
}
