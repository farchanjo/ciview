import type { AxiosInstance } from "axios";
import { logger } from "../util/logger.ts";
import { applyAuthToHttp, createGitLabHttp } from "./http.ts";
import type { AuthResolved } from "./types.ts";

export class GitLabClient {
  private auth: AuthResolved;
  private http: AxiosInstance;

  constructor(auth: AuthResolved, httpClient?: AxiosInstance) {
    this.auth = auth;
    this.http = httpClient ?? createGitLabHttp(auth);
  }

  get host(): string {
    return this.auth.host;
  }

  /** Swap credentials when the operator picks another glab host. */
  setAuth(auth: AuthResolved): void {
    this.auth = auth;
    applyAuthToHttp(this.http, auth);
  }

  /** Test / DI hook. */
  setHttp(httpClient: AxiosInstance): void {
    this.http = httpClient;
  }

  private async request<T>(
    path: string,
    init?: { signal?: AbortSignal; responseType?: "json" | "text" },
  ): Promise<T> {
    const p = path.startsWith("/") ? path : `/${path}`;
    try {
      const res = await this.http.get(p, {
        signal: init?.signal,
        responseType: init?.responseType === "text" ? "text" : "json",
        headers:
          init?.responseType === "text"
            ? { Accept: "text/plain" }
            : undefined,
      });
      if (res.status === 204) return undefined as T;
      if (res.status < 200 || res.status >= 300) {
        const body =
          typeof res.data === "string"
            ? res.data
            : res.data != null
              ? JSON.stringify(res.data)
              : "";
        const err = new Error(`GitLab ${res.status} ${path}: ${body.slice(0, 200)}`);
        if (res.status >= 500) {
          logger.error("gitlab_http_error", { status: res.status, path: p });
        } else if (res.status === 429) {
          logger.warn("gitlab_rate_limit", { status: res.status, path: p });
        }
        throw err;
      }
      return res.data as T;
    } catch (e) {
      if ((e as Error)?.name === "CanceledError" || (e as Error)?.name === "AbortError") {
        const abort = new Error("Aborted");
        abort.name = "AbortError";
        throw abort;
      }
      if (axiosIsTimeout(e)) {
        logger.warn("gitlab_timeout", { path: p });
      }
      throw e;
    }
  }

  /**
   * Membership projects, newest activity first.
   * Pages until exhausted or maxPages (default 5 × 100 = 500).
   */
  async listProjects(signal?: AbortSignal, maxPages = 5): Promise<Record<string, unknown>[]> {
    const all: Record<string, unknown>[] = [];
    for (let page = 1; page <= maxPages; page++) {
      const batch = await this.request<Record<string, unknown>[]>(
        `/projects?membership=true&simple=true&per_page=100&page=${page}&order_by=last_activity_at&sort=desc`,
        { signal },
      );
      all.push(...batch);
      if (batch.length < 100) break;
    }
    return all;
  }

  async listPipelines(projectId: number, signal?: AbortSignal): Promise<Record<string, unknown>[]> {
    return this.request(`/projects/${projectId}/pipelines?per_page=30`, { signal });
  }

  async listJobs(projectId: number, pipelineId: number, signal?: AbortSignal): Promise<Record<string, unknown>[]> {
    return this.request(`/projects/${projectId}/pipelines/${pipelineId}/jobs?per_page=100`, {
      signal,
    });
  }

  async listBridges(projectId: number, pipelineId: number, signal?: AbortSignal): Promise<Record<string, unknown>[]> {
    return this.request(`/projects/${projectId}/pipelines/${pipelineId}/bridges?per_page=50`, {
      signal,
    });
  }

  async jobTrace(projectId: number, jobId: number, signal?: AbortSignal): Promise<string> {
    const text = await this.request<string>(`/projects/${projectId}/jobs/${jobId}/trace`, {
      signal,
      responseType: "text",
    });
    return typeof text === "string" ? text : String(text ?? "");
  }

  async latestPipeline(projectId: number, signal?: AbortSignal): Promise<Record<string, unknown> | null> {
    const list = await this.request<Record<string, unknown>[]>(
      `/projects/${projectId}/pipelines?per_page=1`,
      { signal },
    );
    return list[0] ?? null;
  }
}

function axiosIsTimeout(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e != null &&
    "code" in e &&
    (e as { code?: string }).code === "ECONNABORTED"
  );
}
