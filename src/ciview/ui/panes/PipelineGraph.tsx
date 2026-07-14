import type { Job, Pipeline } from "../../gitlab/types.ts";
import type { RootStores } from "../../state/root.ts";
import { statusColor, statusGlyph } from "../../util/statusGlyph.ts";
import { LoadingLine } from "../chrome/LoadingLine.tsx";
import { useStore } from "../hooks/useStore.ts";

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

/** Column width scales with terminal width for FR-12 readability. */
function stageColWidth(termWidth: number, stageCount: number, sidebarOn: boolean): number {
  const sidebar = sidebarOn ? 30 : 0;
  const usable = Math.max(40, termWidth - sidebar - 4);
  if (stageCount <= 0) return 18;
  return Math.max(14, Math.min(22, Math.floor(usable / Math.min(stageCount, 6))));
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
  const sidebarOn = effectiveSidebarVisible(
    chrome.sidebarVisible,
    chrome.sidebarForce,
    chrome.termWidth,
  );
  const colW = stageColWidth(chrome.termWidth, jobsState.stages.length, sidebarOn);
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
          height: "100%",
          padding: 1,
        }}
      >
        <text fg="#8b949e">Open a project with Enter (j/k only moves cursor)</text>
      </box>
    );
  }

  const pipeItems = pipelines.items;
  const stages = jobsState.stages;
  // FR-12: fewer strip rows + narrower board on tight terminals
  const stripCount = chrome.termWidth < 80 ? 2 : chrome.termWidth < 100 ? 3 : 5;
  const graphTitle =
    childDepth > 0
      ? ` Graph · ${openProj?.pathWithNamespace ?? "?"} · child×${childDepth} Esc↑ `
      : ` Graph · ${openProj?.pathWithNamespace ?? "?"} `;

  return (
    <box
      title={graphTitle}
      style={{
        border: true,
        borderColor: stripFocus || boardFocus ? "#58a6ff" : "#30363d",
        flexDirection: "column",
        flexGrow: 1,
        height: "100%",
      }}
    >
      <box
        title={` Pipelines ${pipelines.status === "loading" ? "· loading" : ""} `}
        style={{
          border: true,
          borderColor: stripFocus ? "#58a6ff" : "#21262d",
          flexDirection: "column",
          height: Math.min(8, 3 + stripCount),
          flexShrink: 0,
        }}
      >
        {pipelines.status === "loading" ? <LoadingLine label="loading pipelines…" /> : null}
        {pipelines.error ? <text fg="#f85149">{pipelines.error.slice(0, 60)}</text> : null}
        {pipelines.status !== "loading" && pipeItems.length === 0 ? (
          <text fg="#8b949e">no pipelines</text>
        ) : null}
        {pipeItems.slice(0, stripCount).map((p, i) => (
          <PipelineStripRow
            key={p.id}
            pipeline={p}
            active={i === board.pipelineIndex && stripFocus}
            selected={p.id === sel.pipelineId}
            maxLen={Math.max(36, chrome.termWidth - (sidebarOn ? 36 : 8))}
          />
        ))}
        {pipeItems.length > stripCount ? (
          <text fg="#6e7681">  … +{pipeItems.length - stripCount} more</text>
        ) : null}
      </box>

      <box
        title={` Board ${jobsState.status === "loading" ? "· loading" : ""} · h/l stage · j/k job · Enter log `}
        style={{
          border: true,
          borderColor: boardFocus ? "#58a6ff" : "#21262d",
          flexDirection: "row",
          flexGrow: 1,
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

export function effectiveSidebarVisible(
  prefVisible: boolean,
  force: boolean | null | undefined,
  termWidth: number,
): boolean {
  if (force === true) return true;
  if (force === false) return false;
  // FR-12: collapse sidebar under 100 columns unless forced
  if (termWidth > 0 && termWidth < 100) return false;
  return prefVisible;
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
