import { buildProjectView } from "../../projects/filter.ts";
import type { RootStores } from "../../state/root.ts";
import { computeLayoutBudget } from "../../util/layoutBudget.ts";
import { statusColor, statusGlyph } from "../../util/statusGlyph.ts";
import { LoadingLine } from "../chrome/LoadingLine.tsx";
import { useStore } from "../hooks/useStore.ts";

export function ProjectSidebar(props: { stores: RootStores }) {
  const projects = useStore(props.stores.projects);
  const chrome = useStore(props.stores.chrome);
  const prefs = useStore(props.stores.prefs);
  const sel = useStore(props.stores.selection);
  const jobs = useStore(props.stores.jobs);

  const budget = computeLayoutBudget({
    termWidth: chrome.termWidth,
    termHeight: chrome.termHeight,
    sidebarPrefVisible: chrome.sidebarVisible,
    sidebarForce: chrome.sidebarForce,
    stageCount: jobs.stages.length,
  });
  const sideW = Math.max(18, budget.sidebarWidth || 28);
  const lineMax = Math.max(12, sideW - 2);

  const query =
    chrome.filterActive && chrome.focusedPane === "projects"
      ? chrome.filterDraft
      : chrome.projectFilter;

  const view = buildProjectView(projects.items, {
    query,
    scope: chrome.projectScope,
    recent: prefs.recentProjects,
    recentMode: prefs.recentMode,
    recentExpanded: chrome.recentExpanded,
  });

  const focused = chrome.focusedPane === "projects";
  const borderColor = focused ? "#58a6ff" : "#30363d";
  const qLabel = query.trim() ? ` /${query.trim().slice(0, 10)}` : "";
  const modeTag = prefs.recentMode === "activity" ? "·act" : "·open";
  const staleTag = projects.status === "stale" ? "…" : "";
  const title = ` Projects ${view.scope}${modeTag}${staleTag}${qLabel} ${view.shown}/${view.total} `;

  return (
    <box
      title={title.slice(0, Math.max(12, sideW - 2))}
      style={{
        border: true,
        borderColor,
        flexDirection: "column",
        width: sideW,
        flexGrow: 0,
        flexShrink: 0,
        height: "100%",
      }}
    >
      <text fg="#6e7681">j/k · Enter · / m y x p</text>
      {projects.status === "loading" && projects.items.length === 0 ? (
        <LoadingLine label="loading projects…" />
      ) : null}
      {projects.error ? (
        <text fg="#f85149">{projects.error.slice(0, lineMax)}</text>
      ) : null}
      {projects.status !== "loading" && view.flat.length === 0 ? (
        <text fg="#8b949e">
          {query.trim()
            ? "no matches"
            : view.scope === "pinned"
              ? "no pins"
              : "type / to filter"}
        </text>
      ) : null}
      {view.sections.map((section) => (
        <box key={section.id} style={{ flexDirection: "column" }}>
          {section.items.length > 0 || section.id === "rest" ? (
            <text fg="#58a6ff">
              {`── ${section.title}${section.items.length ? ` (${section.items.length})` : ""} ──`.slice(
                0,
                lineMax,
              )}
            </text>
          ) : null}
          {section.items.length === 0 && section.id === "rest" ? (
            <text fg="#8b949e">
              {chrome.recentExpanded
                ? "  / filter or m=all"
                : "  / filter · x expand · m=all"}
            </text>
          ) : null}
          {section.items.map((p) => {
            const flatIdx = view.flat.findIndex((x) => x.id === p.id);
            const isCursor = flatIdx === chrome.projectCursor && focused;
            const isOpen = p.id === sel.projectId;
            const prefix = p.pinned ? "★" : isOpen ? "●" : "·";
            const pulse = statusGlyph(p.pulseStatus);
            const line = `${prefix}${pulse} ${p.pathWithNamespace}`.slice(0, lineMax);
            return (
              <text
                key={p.id}
                fg={isCursor ? "#ffffff" : isOpen ? "#58a6ff" : statusColor(p.pulseStatus)}
                bg={isCursor ? "#1f6feb" : undefined}
              >
                {line}
              </text>
            );
          })}
        </box>
      ))}
    </box>
  );
}

export function projectViewFlat(stores: RootStores) {
  const chrome = stores.chrome.get();
  const prefs = stores.prefs.get();
  const query =
    chrome.filterActive && chrome.focusedPane === "projects"
      ? chrome.filterDraft
      : chrome.projectFilter;
  return buildProjectView(stores.projects.get().items, {
    query,
    scope: chrome.projectScope,
    recent: prefs.recentProjects,
    recentMode: prefs.recentMode,
    recentExpanded: chrome.recentExpanded,
  });
}
