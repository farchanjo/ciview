import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, readFile, stat, utimes, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  _resetLoggerForTests,
  clampLogAgeMs,
  configureLogger,
  log,
  MAX_LOG_AGE_MS,
  parseLoggingPrefs,
  pruneLogs,
} from "./logger.ts";

const prevXdg = process.env.XDG_CONFIG_HOME;
let tmpRoot: string;

beforeEach(async () => {
  tmpRoot = join(tmpdir(), `ciview-log-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  process.env.XDG_CONFIG_HOME = tmpRoot;
  _resetLoggerForTests({
    enabled: true,
    level: "debug",
    maxAgeMs: MAX_LOG_AGE_MS,
    maxBytes: 200,
    maxFiles: 3,
  });
});

afterEach(() => {
  if (prevXdg === undefined) delete process.env.XDG_CONFIG_HOME;
  else process.env.XDG_CONFIG_HOME = prevXdg;
  _resetLoggerForTests();
});

describe("clampLogAgeMs / parseLoggingPrefs", () => {
  test("hard-caps age at 1 hour", () => {
    expect(clampLogAgeMs(9_999_999)).toBe(MAX_LOG_AGE_MS);
    expect(parseLoggingPrefs({ maxAgeMs: 10_000_000 }).maxAgeMs).toBe(MAX_LOG_AGE_MS);
  });

  test("defaults when empty", () => {
    const p = parseLoggingPrefs(undefined);
    expect(p.enabled).toBe(true);
    expect(p.level).toBe("info");
    expect(p.maxAgeMs).toBe(MAX_LOG_AGE_MS);
  });
});

describe("file logger", () => {
  test("writes json lines and skips token fields", async () => {
    await log("info", "hello", { projectId: 1, token: "secret", ok: true });
    const path = join(tmpRoot, "ciview", "logs", "ciview.log");
    const body = await readFile(path, "utf8");
    expect(body).toContain('"msg":"hello"');
    expect(body).toContain('"projectId":1');
    expect(body).not.toContain("secret");
    expect(body).not.toContain("token");
  });

  test("respects level filter", async () => {
    configureLogger({
      enabled: true,
      level: "error",
      maxAgeMs: MAX_LOG_AGE_MS,
      maxBytes: 10_000,
      maxFiles: 3,
    });
    await log("info", "nope");
    await log("error", "yes");
    const path = join(tmpRoot, "ciview", "logs", "ciview.log");
    const body = await readFile(path, "utf8");
    expect(body).toContain("yes");
    expect(body).not.toContain("nope");
  });

  test("prune removes files older than maxAge", async () => {
    const dir = join(tmpRoot, "ciview", "logs");
    await mkdir(dir, { recursive: true });
    const oldPath = join(dir, "ciview.log.1");
    await writeFile(oldPath, "old\n");
    const ancient = new Date(Date.now() - MAX_LOG_AGE_MS - 60_000);
    await utimes(oldPath, ancient, ancient);
    await pruneLogs();
    await expect(stat(oldPath)).rejects.toThrow();
  });

  test("rotate when over maxBytes", async () => {
    const path = join(tmpRoot, "ciview", "logs", "ciview.log");
    // force many small writes so rotate runs (CHECK_EVERY)
    for (let i = 0; i < 40; i++) {
      await log("info", `line-${i}-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`);
    }
    const rotated = join(tmpRoot, "ciview", "logs", "ciview.log.1");
    // either active still exists or rotated appeared
    const activeExists = await stat(path).then(() => true).catch(() => false);
    const rotExists = await stat(rotated).then(() => true).catch(() => false);
    expect(activeExists || rotExists).toBe(true);
    // with maxBytes 200, rotation should have kicked
    expect(rotExists).toBe(true);
  });
});
