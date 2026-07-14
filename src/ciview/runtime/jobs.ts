import type { PriorityBand } from "./priorities.ts";
import { PRIORITY } from "./priorities.ts";

export type JobKind =
  | "LoadProjects"
  | "LoadPipelines"
  | "LoadJobs"
  | "LoadTrace"
  | "LoadPulse"
  | "RefreshVisible"
  | "SavePrefs";

export interface JobRequest {
  kind: JobKind;
  /** Coalesce key — only one job per key queued/running. */
  key: string;
  band: PriorityBand;
  projectId?: number;
  pipelineId?: number;
  jobId?: number;
  gen?: number;
  signal?: AbortSignal;
  /**
   * Silent refresh (live poll / background): update data in place without
   * flipping pane status to loading (no UI flash).
   * User navigation must leave this false/undefined so loading shows.
   */
  silent?: boolean;
}

export function jobPriority(req: JobRequest): number {
  return PRIORITY[req.band];
}
