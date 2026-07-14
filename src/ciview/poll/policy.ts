import { isActiveStatus } from "../gitlab/types.ts";

export interface PollTickInput {
  live: boolean;
  /** Open project (selection.projectId). */
  projectId: number | null;
  pipelineStatuses: string[];
  jobStatuses: string[];
}

/**
 * FR-08 / FR-08b live poll gate.
 *
 * - Live off → never poll.
 * - Project open → always poll (silent pipelines list so **new pipelines**
 *   appear even when everything is idle). Jobs/trace depth is decided in
 *   RefreshVisible, not here.
 * - No project open → no visible CI surface to refresh.
 */
export function shouldEnqueuePoll(input: PollTickInput): boolean {
  if (!input.live) return false;
  if (input.projectId != null) return true;
  return false;
}

/** True when any pipeline/job is in an active CI state (for deeper refresh). */
export function hasActiveCi(pipelineStatuses: string[], jobStatuses: string[]): boolean {
  return (
    pipelineStatuses.some((s) => isActiveStatus(s)) ||
    jobStatuses.some((s) => isActiveStatus(s))
  );
}
