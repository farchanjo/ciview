import type { AuthResolved } from "./types.ts";

export type FetchFn = typeof fetch;

export class GitLabClient {
  constructor(
    private readonly auth: AuthResolved,
    private readonly fetchFn: FetchFn = fetch,
  ) {}

  get host(): string {
    return this.auth.host;
  }

  private apiUrl(path: string): string {
    const base = this.auth.host.replace(/\/$/, "");
    const p = path.startsWith("/") ? path : `/${path}`;
    return `${base}/api/v4${p}`;
  }

  private async request<T>(path: string, init?: RequestInit & { signal?: AbortSignal }): Promise<T> {
    const res = await this.fetchFn(this.apiUrl(path), {
      ...init,
      headers: {
        "PRIVATE-TOKEN": this.auth.token,
        Accept: "application/json",
        ...(init?.headers ?? {}),
      },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`GitLab ${res.status} ${path}: ${body.slice(0, 200)}`);
    }
    if (res.status === 204) return undefined as T;
    const ct = res.headers.get("content-type") ?? "";
    if (ct.includes("json")) return (await res.json()) as T;
    return (await res.text()) as T;
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
    const res = await this.fetchFn(this.apiUrl(`/projects/${projectId}/jobs/${jobId}/trace`), {
      signal,
      headers: {
        "PRIVATE-TOKEN": this.auth.token,
        Accept: "text/plain",
      },
    });
    if (!res.ok) {
      throw new Error(`GitLab ${res.status} job trace`);
    }
    return await res.text();
  }

  async latestPipeline(projectId: number, signal?: AbortSignal): Promise<Record<string, unknown> | null> {
    const list = await this.request<Record<string, unknown>[]>(
      `/projects/${projectId}/pipelines?per_page=1`,
      { signal },
    );
    return list[0] ?? null;
  }
}
