import axios, { type AxiosInstance, type AxiosRequestConfig } from "axios";
import http from "node:http";
import https from "node:https";
import type { AuthResolved } from "./types.ts";

/** Shared keep-alive agents (connection pool). maxSockets ≈ queue concurrency + headroom. */
const httpAgent = new http.Agent({
  keepAlive: true,
  maxSockets: 8,
  maxFreeSockets: 4,
});
const httpsAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 8,
  maxFreeSockets: 4,
});

function apiBase(host: string): string {
  return `${host.replace(/\/$/, "")}/api/v4`;
}

export function createGitLabHttp(auth: AuthResolved): AxiosInstance {
  return axios.create({
    baseURL: apiBase(auth.host),
    timeout: 30_000,
    httpAgent,
    httpsAgent,
    headers: {
      "PRIVATE-TOKEN": auth.token,
      Accept: "application/json",
    },
    validateStatus: () => true, // GitLabClient maps non-2xx to Error
  });
}

export function applyAuthToHttp(httpClient: AxiosInstance, auth: AuthResolved): void {
  httpClient.defaults.baseURL = apiBase(auth.host);
  httpClient.defaults.headers.common["PRIVATE-TOKEN"] = auth.token;
}

export type { AxiosInstance, AxiosRequestConfig };
