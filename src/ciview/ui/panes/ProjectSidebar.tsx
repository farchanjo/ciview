import { buildProjectView } from "../../projects/filter.ts";
import type { RootStores } from "../../state/root.ts";
import { statusColor, statusGlyph } from "../../util/statusGlyph.ts";
import { LoadingLine } from "../chrome/LoadingLine.tsx";
import { useStore } from "../hooks/useStore.ts";

export function ProjectSidebar(props: { stores: RootStores }) {
  const projects = useStore(props.stores.projects);
  const chrome = useStore(props.stores.chrome);
  const prefs = useStore(props.stores.prefs);
  const sel = useStore(props.stores.selection);

  const query =
    chrome.filterActive && chrome.focusedPane === "projects"
      ? chrome.filterDraft
      : chrome.projectFilter;

  const view = buildProjectView(projects.items, {
    query,
    scope: chrome.projectScope,
    recent: prefs.recentProjects,
  });

  const focused = chrome.focusedPane === "projects";
  const borderColor = focused ? "#58a6ff" : "#30363d";
  const qLabel = query.trim() ? ` /${query.trim().slice(0, 10)}` : "";
  const title = ` Projects ${view.scope}${qLabel} ${view.shown}/${view.total} `;

  return (
    <box
      title={title.slice(0, 36)}
      style={{
        border: true,
        borderColor,
        flexDirection: "column",
        width: 30,
        flexGrow: 0,
        flexShrink: 0,
        height: "100%",
      }}
    >
      <text fg="#6e7681">j/k cursor · Enter open · / m p</text>
      {projects.status === "loading" && projects.items.length === 0 ? (
        <LoadingLine label="loading projects…" />
      ) : null}
      {projects.error ? <text fg="#f85149">{projects.error.slice(0, 28)}</text> : null}
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
              ── {section.title}
              {section.items.length ? ` (${section.items.length})` : ""} ──
            </text>
          ) : null}
          {section.items.length === 0 && section.id === "rest" ? (
            <text fg="#8b949e">  / filter or m=all</text>
          ) : null}
          {section.items.map((p) => {
            const flatIdx = view.flat.findIndex((x) => x.id === p.id);
            const isCursor = flatIdx === chrome.projectCursor && focused;
            const isOpen = p.id === sel.projectId;
            const prefix = p.pinned ? "★" : isOpen ? "●" : "·";
            // FR-02: CI pulse glyph of latest known pipeline status
            const pulse = statusGlyph(p.pulseStatus);
            const line = `${prefix}${pulse} ${p.pathWithNamespace}`.slice(0, 28);
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
  const query =
    chrome.filterActive && chrome.focusedPane === "projects"
      ? chrome.filterDraft
      : chrome.projectFilter;
  return buildProjectView(stores.projects.get().items, {
    query,
    scope: chrome.projectScope,
    recent: stores.prefs.get().recentProjects,
  });
}
