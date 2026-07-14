import type { RootStores } from "../../state/root.ts";
import { useStore } from "../hooks/useStore.ts";
import { STATUS_HINT } from "../keys.ts";

export function StatusBar(props: { stores: RootStores }) {
  const session = useStore(props.stores.session);
  const prefs = useStore(props.stores.prefs);
  const meta = useStore(props.stores.queueMeta);
  const chrome = useStore(props.stores.chrome);
  const sel = useStore(props.stores.selection);
  const projects = useStore(props.stores.projects);

  const project = projects.items.find((p) => p.id === sel.projectId);
  const host = session.host.replace(/^https?:\/\//, "");
  const live = prefs.live ? "LIVE" : "idle";
  // Only show spinner for user (non-poll) inflight keys
  const userInflight = meta.inflight.filter((k) => k.startsWith("user:"));
  const loading = userInflight.length > 0 ? ` · ⟳ loading` : "";
  const err = meta.lastError ? ` err:${meta.lastError.slice(0, 40)}` : "";
  const sidebarHidden =
    chrome.sidebarForce === false ||
    (chrome.sidebarForce == null && chrome.termWidth > 0 && chrome.termWidth < 100) ||
    !chrome.sidebarVisible;
  const proj = sidebarHidden && project ? ` · ${project.pathWithNamespace}` : "";
  const child = chrome.pipelineStack.length > 0 ? ` · child×${chrome.pipelineStack.length}` : "";

  return (
    <box style={{ flexDirection: "column", height: 2, flexShrink: 0 }}>
      <text fg={userInflight.length ? "#f5c518" : "#8b949e"}>
        ciview · {host} · {session.tokenSource} · {live}
        {loading}
        {proj}
        {child}
        {err}
      </text>
      <text fg="#6e7681">{STATUS_HINT}</text>
    </box>
  );
}
