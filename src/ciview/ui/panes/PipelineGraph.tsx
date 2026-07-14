import type { Job, Pipeline } from "../../gitlab/types.ts";
import type { RootStores } from "../../state/root.ts";
import { computeLayoutBudget, stripWindowStart } from "../../util/layoutBudget.ts";
import { statusColor, statusGlyph } from "../../util/statusGlyph.ts";
import { LoadingLine } from "../chrome/LoadingLine.tsx";
import { useStore } from "../hooks/useStore.ts";

export { effectiveSidebarVisible } from "../../util/layoutBudget.ts";

export function fmtDur(sec?: number): string {
  if (sec == null || Number.isNaN(sec)) return "";
  if (sec < 60) return `${Math.round(sec)}s`;
  return `${Math.floor(sec / 60)}m${Math.round(sec % 60)
    .toString()
    .padStart(2, "0")}s`;
}

/** Relative age from ISO timestamp when duration is missing (FR-03/32). */
export function fmtAge(iso?: string): string {
  if (!iso) return "";
  const ms = Date.now() - Date.parse(iso);
  if (Number.isNaN(ms) || ms < 0) return "";
  const m = Math.floor(ms / 60_000);
  if (m < 1) return "<1m";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function jobsInStage(jobs: Job[], stage: string): Job[] {
  return jobs.filter((j) => j.stage === stage);
}

export function PipelineGraph(props: { stores: RootStores }) {
  const pipelines = useStore(props.stores.pipelines);
  const jobsState = useStore(props.stores.jobs);
  const chrome = useStore(props.stores.chrome);
  const sel = useStore(props.stores.selection);
  const projects = useStore(props.stores.projects);

  const openProj = projects.items.find((p) => p.id === sel.projectId);
  const stripFocus = chrome.focusedPane === "pipeline_strip";
  const boardFocus = chrome.focusedPane === "stage_board";
  const board = chrome.board;
  const budget = computeLayoutBudget({
    termWidth: chrome.termWidth,
    termHeight: chrome.termHeight,
    sidebarPrefVisible: chrome.sidebarVisible,
    sidebarForce: chrome.sidebarForce,
    stageCount: jobsState.stages.length,
  });
  const sidebarOn = budget.sidebarVisibleEffective;
  const colW = budget.stageColWidth;
  const stripCount = budget.stripRows;
  const childDepth = chrome.pipelineStack.length;

  if (sel.projectId == null) {
    return (
      <box
        title=" Pipeline graph "
        style={{
          border: true,
          borderColor: "#30363d",
          flexDirection: "column",
          flexGrow: 1,
          flexShrink: 1,
          minHeight: 3,
          padding: 1,
        }}
      >
        <text fg="#8b949e">Open a project with Enter (j/k only moves cursor)</text>
      </box>
    );
  }

  const pipeItems = pipelines.items;
  const stages = jobsState.stages;
  const graphTitle =
    childDepth > 0
      ? ` Graph · ${openProj?.pathWithNamespace ?? "?"} · child×${childDepth} Esc↑ `
      : ` Graph · ${openProj?.pathWithNamespace ?? "?"} · ${budget.density} `;

  // Windowed strip: follow pipelineIndex so older pipelines appear when j/k down.
  const stripStart = stripWindowStart(board.pipelineIndex, stripCount, pipeItems.length);
  const stripVisible = pipeItems.slice(stripStart, stripStart + stripCount);
  const aboveCount = stripStart;
  const belowCount = Math.max(0, pipeItems.length - stripStart - stripCount);
  const overflowHint =
    aboveCount > 0 || belowCount > 0
      ? `  …${aboveCount > 0 ? ` ↑${aboveCount}` : ""}${aboveCount > 0 && belowCount > 0 ? " ·" : ""}${belowCount > 0 ? ` +${belowCount} more` : ""}`
      : null;
  // Strip box: border chrome (~2) + pipeline rows + optional overflow line
  const stripBoxHeight = Math.max(3, stripCount + 2 + (overflowHint ? 1 : 0));

  return (
    <box
      title={graphTitle}
      style={{
        border: true,
        borderColor: stripFocus || boardFocus ? "#58a6ff" : "#30363d",
        flexDirection: "column",
        flexGrow: 1,
        flexShrink: 1,
        minHeight: 5,
      }}
    >
      <box
        title={` Pipelines ${pipelines.status === "loading" ? "· loading" : ""} `}
        style={{
          border: true,
          borderColor: stripFocus ? "#58a6ff" : "#21262d",
          flexDirection: "column",
          height: stripBoxHeight,
          flexShrink: 0,
        }}
      >
        {pipelines.status === "loading" ? <LoadingLine label="loading pipelines…" /> : null}
        {pipelines.error ? <text fg="#f85149">{pipelines.error.slice(0, 60)}</text> : null}
        {pipelines.status !== "loading" && pipeItems.length === 0 ? (
          <text fg="#8b949e">no pipelines</text>
        ) : null}
        {stripVisible.map((p, i) => {
          const absIndex = stripStart + i;
          return (
            <PipelineStripRow
              key={p.id}
              pipeline={p}
              active={absIndex === board.pipelineIndex && stripFocus}
              selected={p.id === sel.pipelineId}
              maxLen={Math.max(24, chrome.termWidth - (sidebarOn ? budget.sidebarWidth + 6 : 8))}
            />
          );
        })}
        {overflowHint ? <text fg="#6e7681">{overflowHint}</text> : null}
      </box>

      <box
        title={` Board ${jobsState.status === "loading" ? "· loading" : ""} · h/l stage · j/k job · Enter log `}
        style={{
          border: true,
          borderColor: boardFocus ? "#58a6ff" : "#21262d",
          flexDirection: "row",
          flexGrow: 1,
          flexShrink: 1,
          minHeight: 3,
        }}
      >
        {jobsState.status === "loading" ? (
          <box style={{ flexDirection: "column", padding: 1 }}>
            <LoadingLine label="loading jobs…" />
          </box>
        ) : null}
        {jobsState.error ? <text fg="#f85149">{jobsState.error}</text> : null}
        {jobsState.status !== "loading" && stages.length === 0 ? (
          <text fg="#8b949e"> no jobs for this pipeline </text>
        ) : null}
        {stages.map((stage, si) => {
          const stageJobs = jobsInStage(jobsState.items, stage.name);
          const stageActive = boardFocus && si === board.stageIndex;
          return (
            <box
              key={stage.name}
              title={` ${stage.name.slice(0, colW - 2)} `}
              style={{
                border: true,
                borderColor: stageActive ? "#58a6ff" : "#30363d",
                flexDirection: "column",
                width: colW,
                flexGrow: 0,
                flexShrink: 0,
              }}
            >
              {stageJobs.map((job, ji) => {
                const cellActive = stageActive && ji === board.jobIndex;
                const selected = job.id === sel.jobId;
                const af = job.allowFailure ? "!" : "";
                const dur = job.duration != null ? ` ${fmtDur(job.duration)}` : "";
                const line = `${statusGlyph(job.status)} ${job.name}${af}${dur}`.slice(
                  0,
                  colW - 2,
                );
                return (
                  <text
                    key={job.id}
                    fg={cellActive || selected ? "#ffffff" : statusColor(job.status)}
                    bg={cellActive ? "#1f6feb" : selected ? "#21262d" : undefined}
                  >
                    {line}
                  </text>
                );
              })}
              {stageJobs.length === 0 ? <text fg="#6e7681"> — </text> : null}
            </box>
          );
        })}
      </box>
    </box>
  );
}

function PipelineStripRow(props: {
  pipeline: Pipeline;
  active: boolean;
  selected: boolean;
  maxLen: number;
}) {
  const p = props.pipeline;
  const culprit = p.failedJobName ? ` · ✗${p.failedJobName}` : "";
  const time = fmtDur(p.duration) || fmtAge(p.updatedAt ?? p.createdAt);
  const src = p.source ? ` ${p.source}` : "";
  const line =
    `${statusGlyph(p.status)} #${p.iid} ${p.ref}${src} ${p.status}${time ? ` ${time}` : ""}${culprit}`.slice(
      0,
      props.maxLen,
    );
  return (
    <text
      fg={props.active || props.selected ? "#ffffff" : statusColor(p.status)}
      bg={props.active ? "#1f6feb" : props.selected ? "#21262d" : undefined}
    >
      {line}
    </text>
  );
}

export function boardStages(stores: RootStores) {
  return stores.jobs.get().stages;
}

export function boardJobsInStage(stores: RootStores, stageIndex: number) {
  const stages = stores.jobs.get().stages;
  const stage = stages[stageIndex];
  if (!stage) return [];
  return stores.jobs.get().items.filter((j) => j.stage === stage.name);
}
