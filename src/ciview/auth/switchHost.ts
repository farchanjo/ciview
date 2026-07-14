import type { GitLabClient } from "../gitlab/client.ts";
import type { JobQueue } from "../runtime/queue.ts";
import type { RootStores } from "../state/root.ts";
import { findHostOption, hostKey, listAuthenticatedHosts, resolveAuth } from "./resolve.ts";

/**
 * Bind ciview to a glab host: setAuth, session, prefs, clear entity slices,
 * close picker, enqueue LoadProjects.
 */
export async function applyGitlabHost(
  stores: RootStores,
  client: GitLabClient,
  queue: JobQueue,
  hostname: string,
): Promise<void> {
  const auth = await resolveAuth(hostname);
  client.setAuth(auth);
  const key = hostKey(auth.host);

  stores.session.set({
    host: auth.host,
    tokenSource: auth.tokenSource,
    ready: true,
    fatalError: null,
  });
  stores.prefs.patch({ gitlabHost: key });

  stores.projects.set({ items: [], status: "idle", error: null, scopeId: null });
  stores.pipelines.set({ items: [], status: "idle", error: null, scopeId: null });
  stores.jobs.set({
    items: [],
    stages: [],
    status: "idle",
    error: null,
    scopeId: null,
  });
  stores.trace.set({ jobId: null, text: "", status: "idle", error: null });
  stores.selection.set({
    projectId: null,
    pipelineId: null,
    jobId: null,
    projectGen: 0,
    pipelineGen: 0,
    jobGen: 0,
  });
  stores.chrome.patch({
    projectCursor: 0,
    projectFilter: "",
    filterActive: false,
    filterDraft: "",
    logOpen: false,
    helpOpen: false,
    hostPickerOpen: false,
    hostPickerRequired: false,
    hostPickerCursor: 0,
    focusedPane: "projects",
    board: { pipelineIndex: 0, stageIndex: 0, jobIndex: 0 },
    pipelineStack: [],
  });

  void queue.enqueue({ kind: "SavePrefs", key: "prefs:save", band: "idle" });
  void queue.enqueue({ kind: "LoadProjects", key: "user:projects", band: "user" });
}

/** Open host picker when ≥ 2 authenticated hosts exist. */
export async function openHostPickerIfMulti(
  stores: RootStores,
  required = false,
): Promise<boolean> {
  const hosts = await listAuthenticatedHosts();
  if (hosts.length < 2) return false;

  const current = hostKey(stores.session.get().host || stores.prefs.get().gitlabHost || "");
  let cursor = hosts.findIndex(
    (h) => h.hostname === current || h.apiHost === current,
  );
  if (cursor < 0) cursor = 0;

  stores.chrome.patch({
    hostPickerOpen: true,
    hostPickerRequired: required,
    hostPickerCursor: cursor,
    helpOpen: false,
    logOpen: false,
  });
  return true;
}

export async function confirmHostPicker(
  stores: RootStores,
  client: GitLabClient,
  queue: JobQueue,
): Promise<void> {
  const hosts = await listAuthenticatedHosts();
  if (hosts.length === 0) return;
  const ch = stores.chrome.get();
  const idx = Math.max(0, Math.min(hosts.length - 1, ch.hostPickerCursor));
  const pick = hosts[idx];
  if (!pick) return;
  await applyGitlabHost(stores, client, queue, pick.hostname);
}

/** Decision helper for tests and main bootstrap. */
export function shouldShowHostPicker(
  hostCount: number,
  savedHost: string | null | undefined,
  authenticatedHostnames: string[],
): boolean {
  if (hostCount < 2) return false;
  if (!savedHost) return true;
  return !findHostOption(
    authenticatedHostnames.map((hostname) => ({
      hostname,
      apiHost: hostname,
      token: "x",
    })),
    savedHost,
  );
}
