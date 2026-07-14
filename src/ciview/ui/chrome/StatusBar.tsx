import type { RootStores } from "../../state/root.ts";
import { computeLayoutBudget } from "../../util/layoutBudget.ts";
import { useStore } from "../hooks/useStore.ts";
import { STATUS_HINT } from "../keys.ts";

export function StatusBar(props: { stores: RootStores }) {
  const session = useStore(props.stores.session);
  const prefs = useStore(props.stores.prefs);
  const meta = useStore(props.stores.queueMeta);
  const chrome = useStore(props.stores.chrome);
  const sel = useStore(props.stores.selection);
  const projects = useStore(props.stores.projects);
  const jobs = useStore(props.stores.jobs);

  const budget = computeLayoutBudget({
    termWidth: chrome.termWidth,
    termHeight: chrome.termHeight,
    sidebarPrefVisible: chrome.sidebarVisible,
    sidebarForce: chrome.sidebarForce,
    stageCount: jobs.stages.length,
  });

  const project = projects.items.find((p) => p.id === sel.projectId);
  const host = session.host.replace(/^https?:\/\//, "");
  const live = prefs.live ? "LIVE" : "idle";
  const userInflight = meta.inflight.filter((k) => k.startsWith("user:"));
  const loading = userInflight.length > 0 ? ` · ⟳ loading` : "";
  const err = meta.lastError ? ` err:${meta.lastError.slice(0, 40)}` : "";
  const sidebarHidden = !budget.sidebarVisibleEffective;
  const proj = sidebarHidden && project ? ` · ${project.pathWithNamespace}` : "";
  const child = chrome.pipelineStack.length > 0 ? ` · child×${chrome.pipelineStack.length}` : "";
  const maxHost = Math.max(20, chrome.termWidth - 8);

  const line1 =
    `ciview · ${host} · ${session.tokenSource} · ${live}${loading}${proj}${child}${err}`.slice(
      0,
      maxHost,
    );

  // compact density: single status row (FR-43)
  if (budget.statusRows <= 1) {
    return (
      <box style={{ flexDirection: "column", height: 1, flexShrink: 0 }}>
        <text fg={userInflight.length ? "#f5c518" : "#8b949e"}>{line1}</text>
      </box>
    );
  }

  return (
    <box style={{ flexDirection: "column", height: 2, flexShrink: 0 }}>
      <text fg={userInflight.length ? "#f5c518" : "#8b949e"}>{line1}</text>
      <text fg="#6e7681">{STATUS_HINT.slice(0, maxHost)}</text>
    </box>
  );
}
