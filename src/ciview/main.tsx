#!/usr/bin/env bun
import { createCliRenderer } from "@opentui/core";
import { createRoot } from "@opentui/react";
import {
  AuthError,
  findHostOption,
  isGlabInstalled,
  listAuthenticatedHosts,
  resolveAuth,
} from "./auth/resolve.ts";
import { HELP_TEXT, parseArgs } from "./cli/args.ts";
import { loadPrefs } from "./config/prefs.ts";
import { projectFromGitRemote } from "./git/remote.ts";
import { GitLabClient } from "./gitlab/client.ts";
import { openProject } from "./nav/openProject.ts";
import { startPollTimer } from "./poll/timer.ts";
import { wireSelectionEffects } from "./runtime/effects.ts";
import { createHandlers } from "./runtime/handlers.ts";
import type { JobRequest } from "./runtime/jobs.ts";
import { createJobQueue } from "./runtime/queue.ts";
import { GRACEFUL_SIGNALS, installGracefulShutdown } from "./runtime/shutdown.ts";
import { createRootStores } from "./state/root.ts";
import { App } from "./ui/App.tsx";

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    console.log(HELP_TEXT);
    process.exit(0);
  }

  const prefs = await loadPrefs();

  let hosts;
  try {
    if (!isGlabInstalled()) {
      throw new AuthError(
        "glab_not_installed",
        "glab is not installed (or not on PATH). ciview uses glab for GitLab credentials.",
        [
          "Install glab (GitLab CLI):  brew install glab\n" +
            "     See also: https://gitlab.com/gitlab-org/cli#installation",
          "Authenticate with glab:  glab auth login\n" +
            "     Self-hosted example:  glab auth login --hostname git.example.com\n" +
            "     Then verify:  glab auth status",
        ],
      );
    }
    hosts = await listAuthenticatedHosts();
  } catch (e) {
    if (e instanceof AuthError) {
      console.error(e.format());
    } else {
      console.error(`ciview: ${String(e)}`);
    }
    process.exit(2);
  }

  if (hosts.length === 0) {
    console.error(
      new AuthError(
        "glab_not_authenticated",
        "glab is installed but not authenticated (no hosts with tokens in glab config).",
        [
          "Authenticate with glab:  glab auth login\n" +
            "     Self-hosted example:  glab auth login --hostname git.example.com\n" +
            "     Then verify:  glab auth status",
        ],
      ).format(),
    );
    process.exit(2);
  }

  // FR-63: single host → no picker. FR-64/65: multi → picker if no valid saved host.
  const saved = findHostOption(hosts, prefs.gitlabHost);
  const needPicker = hosts.length >= 2 && !saved;
  const initialHost = saved ?? hosts[0]!;

  let auth;
  try {
    auth = await resolveAuth(initialHost.hostname);
  } catch (e) {
    if (e instanceof AuthError) {
      console.error(e.format());
    } else {
      console.error(`ciview: ${String(e)}`);
    }
    process.exit(2);
  }

  // Persist auto-chosen single host / valid saved so prefs stay in sync
  if (!needPicker && prefs.gitlabHost !== initialHost.hostname) {
    prefs.gitlabHost = initialHost.hostname;
  }

  const stores = createRootStores(prefs);
  stores.session.set({
    host: auth.host,
    tokenSource: auth.tokenSource,
    ready: true,
    fatalError: null,
  });

  if (needPicker) {
    const cursor = Math.max(
      0,
      hosts.findIndex((h) => h.hostname === initialHost.hostname),
    );
    stores.chrome.patch({
      hostPickerOpen: true,
      hostPickerRequired: true,
      hostPickerCursor: cursor < 0 ? 0 : cursor,
    });
  }

  const client = new GitLabClient(auth);
  // enqueue ref so LoadProjects can schedule idle LoadPulse without a cycle
  const enqueueRef: { current: (req: JobRequest) => void } = {
    current: () => {},
  };
  const handlers = createHandlers(client, stores, (req) => enqueueRef.current(req));
  const queue = createJobQueue(stores, handlers);
  enqueueRef.current = (req) => {
    void queue.enqueue(req);
  };
  const unwire = wireSelectionEffects(stores, queue);
  const stopPoll = startPollTimer(stores, queue);

  // Persist gitlabHost when we auto-bound (single host or restored pref)
  if (!needPicker) {
    void queue.enqueue({ kind: "SavePrefs", key: "prefs:save", band: "idle" });
  }

  // Timers that must be cleared on graceful exit (keep event loop alive otherwise).
  let focusIv: ReturnType<typeof setInterval> | null = null;
  let focusTimeout: ReturnType<typeof setTimeout> | null = null;
  let cleaned = false;
  let exited = false;
  // set after createCliRenderer; quit may race destroy-from-signal
  let destroyRenderer: () => void = () => {};

  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    if (focusIv != null) {
      clearInterval(focusIv);
      focusIv = null;
    }
    if (focusTimeout != null) {
      clearTimeout(focusTimeout);
      focusTimeout = null;
    }
    stopPoll();
    unwire();
    queue.clear();
  };

  const exitProcess = (code = 0) => {
    if (exited) return;
    exited = true;
    process.exit(code);
  };

  // FR-64: do not load projects until host is confirmed when picker required
  if (!needPicker) {
    void queue.enqueue({ kind: "LoadProjects", key: "user:projects", band: "user" });
  }

  // focus project from CLI after projects load (poll briefly)
  const focusPath =
    args.project ?? (args.fromGit ? await projectFromGitRemote() : null);

  if (focusPath && !needPicker) {
    const tryFocus = () => {
      const items = stores.projects.get().items;
      if (items.length === 0) return false;
      const hit =
        items.find((p) => p.pathWithNamespace === focusPath) ??
        items.find((p) => p.pathWithNamespace.endsWith(focusPath));
      if (!hit) return false;
      const idx = items.findIndex((p) => p.id === hit.id);
      stores.chrome.patch({ projectCursor: Math.max(0, idx) });
      openProject(stores, queue, hit.id);
      return true;
    };
    focusIv = setInterval(() => {
      if (tryFocus() || stores.projects.get().status === "error") {
        if (focusIv != null) clearInterval(focusIv);
        focusIv = null;
      }
    }, 200);
    focusTimeout = setTimeout(() => {
      if (focusIv != null) clearInterval(focusIv);
      focusIv = null;
    }, 15000);
  }

  // FR-27: install before renderer so SIGTERM during setup still cleans up.
  // CRITICAL: never process.exit on the early "destroy" event — OpenTUI emits
  // it mid-finalizeDestroy BEFORE lib.destroyRenderer restores the tty.
  // Only exit from onDestroy (end of finalize) or quit() after destroy returns.
  const shutdown = installGracefulShutdown({
    cleanup,
    destroyRenderer: () => destroyRenderer(),
    exitProcess,
  });

  const renderer = await createCliRenderer({
    exitOnCtrlC: true,
    clearOnShutdown: true,
    // Let OpenTUI tear down on these; we still own process.exit via onDestroy.
    exitSignals: [...GRACEFUL_SIGNALS],
    targetFps: 30,
    // Called at END of finalizeDestroy (after native tty restore).
    onDestroy: () => {
      shutdown.afterRendererDestroyed(0);
    },
  });

  destroyRenderer = () => {
    try {
      // Prefer explicit kitty disable before destroy when available.
      const r = renderer as { disableKittyKeyboard?: () => void };
      r.disableKittyKeyboard?.();
    } catch {
      /* optional */
    }
    try {
      renderer.destroy();
    } catch {
      /* already destroyed */
    }
  };

  // Do NOT listen for "destroy" + process.exit — that event fires too early
  // and was leaving the shell with Kitty CSI-u garbage and alt-screen residue.

  createRoot(renderer).render(
    <App
      stores={stores}
      queue={queue}
      client={client}
      onQuit={() => shutdown.quit(0)}
    />,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
