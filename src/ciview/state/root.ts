import type { Prefs } from "../config/prefs.ts";
import type {
  AuthResolved,
  Job,
  PaneId,
  Pipeline,
  Project,
  SliceStatus,
  StageGroup,
} from "../gitlab/types.ts";
import type { ProjectScope } from "../projects/filter.ts";
import type { LogViewMode } from "../util/smartLog.ts";
import { createStore } from "./createStore.ts";

export interface SessionState {
  host: string;
  tokenSource: AuthResolved["tokenSource"] | "";
  ready: boolean;
  fatalError: string | null;
}

export interface EntitySlice<T> {
  items: T[];
  status: SliceStatus;
  error: string | null;
  scopeId: number | null;
}

export interface TraceState {
  jobId: number | null;
  text: string;
  status: SliceStatus;
  error: string | null;
}

export interface SelectionState {
  /** Open project (graph source) — only set by openProject, not j/k. */
  projectId: number | null;
  pipelineId: number | null;
  jobId: number | null;
  projectGen: number;
  pipelineGen: number;
  jobGen: number;
}

export interface BoardCursor {
  pipelineIndex: number;
  stageIndex: number;
  jobIndex: number;
}

export interface UiChromeState {
  focusedPane: PaneId;
  /** Cursor in project flat list (independent of open project). */
  projectCursor: number;
  projectFilter: string;
  projectScope: ProjectScope;
  filterActive: boolean;
  filterDraft: string;
  logFollow: boolean;
  /** Lines from bottom when following; increases when user scrolls up (pauses follow). */
  logScrollFromBottom: number;
  /** Smart log view: condensed failures / errors-only / full. */
  logMode: LogViewMode;
  /** Cursor into error hits for n/N jump (index into errorViewIndices). */
  logErrorCursor: number;
  sidebarVisible: boolean;
  /** User override; when null, layout decides from terminal width. */
  sidebarForce?: boolean | null;
  helpOpen: boolean;
  helpScroll: number;
  /** Feature 002: log modal */
  logOpen: boolean;
  board: BoardCursor;
  /** Terminal width for responsive collapse (updated by UI). */
  termWidth: number;
  /** Terminal height for modal viewport sizing. */
  termHeight: number;
  /**
   * Parent pipeline ids when diving into child pipelines via bridges (FR-13).
   * Top of stack is nearest parent; empty when at root pipeline of the project.
   */
  pipelineStack: number[];
  /** Multi-host glab picker modal open. */
  hostPickerOpen: boolean;
  /** Cursor in host list. */
  hostPickerCursor: number;
  /**
   * When true, Esc cannot dismiss the picker (first launch, no saved host).
   * Quit with q still works.
   */
  hostPickerRequired: boolean;
  /** RECENT section shows 20 instead of 10. */
  recentExpanded: boolean;
}

export interface QueueMetaState {
  inflight: string[];
  lastError: string | null;
  pending: number;
}

export interface PrefsState extends Prefs {}

export function createRootStores(initialPrefs: Prefs) {
  return {
    session: createStore<SessionState>({
      host: "",
      tokenSource: "",
      ready: false,
      fatalError: null,
    }),
    prefs: createStore<PrefsState>({ ...initialPrefs }),
    projects: createStore<EntitySlice<Project>>({
      items: [],
      status: "idle",
      error: null,
      scopeId: null,
    }),
    pipelines: createStore<EntitySlice<Pipeline>>({
      items: [],
      status: "idle",
      error: null,
      scopeId: null,
    }),
    jobs: createStore<{
      items: Job[];
      stages: StageGroup[];
      status: SliceStatus;
      error: string | null;
      scopeId: number | null;
    }>({
      items: [],
      stages: [],
      status: "idle",
      error: null,
      scopeId: null,
    }),
    trace: createStore<TraceState>({
      jobId: null,
      text: "",
      status: "idle",
      error: null,
    }),
    selection: createStore<SelectionState>({
      projectId: null,
      pipelineId: null,
      jobId: null,
      projectGen: 0,
      pipelineGen: 0,
      jobGen: 0,
    }),
    chrome: createStore<UiChromeState>({
      focusedPane: "projects",
      projectCursor: 0,
      projectFilter: "",
      projectScope: initialPrefs.projectScope,
      filterActive: false,
      filterDraft: "",
      logFollow: true,
      logScrollFromBottom: 0,
      logMode: "smart",
      logErrorCursor: 0,
      sidebarVisible: initialPrefs.sidebarVisible,
      sidebarForce: null,
      helpOpen: false,
      helpScroll: 0,
      logOpen: false,
      board: { pipelineIndex: 0, stageIndex: 0, jobIndex: 0 },
      termWidth: 120,
      termHeight: 40,
      pipelineStack: [],
      hostPickerOpen: false,
      hostPickerCursor: 0,
      hostPickerRequired: false,
      recentExpanded: false,
    }),
    queueMeta: createStore<QueueMetaState>({
      inflight: [],
      lastError: null,
      pending: 0,
    }),
  };
}

export type RootStores = ReturnType<typeof createRootStores>;
