import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  AuthError,
  findHostOption,
  glabConfigCandidates,
  hostKey,
  isGlabInstalled,
  listAuthenticatedHosts,
  resolveAuth,
} from "./resolve.ts";
import { shouldShowHostPicker } from "./switchHost.ts";

describe("resolveAuth (glab-only)", () => {
  test("isGlabInstalled reflects PATH", () => {
    expect(typeof isGlabInstalled()).toBe("boolean");
  });

  test("hostKey strips scheme and trailing slash", () => {
    expect(hostKey("https://git.example.com/")).toBe("git.example.com");
    expect(hostKey("git.example.com")).toBe("git.example.com");
  });

  test("glabConfigCandidates prefers GLAB_CONFIG_DIR then XDG then home", () => {
    const prevGlab = process.env.GLAB_CONFIG_DIR;
    const prevXdg = process.env.XDG_CONFIG_HOME;
    try {
      process.env.GLAB_CONFIG_DIR = "/tmp/glab-test-cfg";
      process.env.XDG_CONFIG_HOME = "/tmp/xdg-test";
      const c = glabConfigCandidates();
      expect(c[0]).toBe(join("/tmp/glab-test-cfg", "config.yml"));
      expect(c.some((p) => p.includes("xdg-test"))).toBe(true);
      expect(c.some((p) => p.includes(".config/glab-cli"))).toBe(true);
      if (process.platform === "darwin") {
        expect(c.some((p) => p.includes("Application Support"))).toBe(true);
      }
    } finally {
      if (prevGlab === undefined) delete process.env.GLAB_CONFIG_DIR;
      else process.env.GLAB_CONFIG_DIR = prevGlab;
      if (prevXdg === undefined) delete process.env.XDG_CONFIG_HOME;
      else process.env.XDG_CONFIG_HOME = prevXdg;
    }
  });

  test("listAuthenticatedHosts reads GLAB_CONFIG_DIR fixture", async () => {
    const dir = await mkdtemp(join(tmpdir(), "ciview-glab-"));
    const yaml = `
hosts:
  only-one.example:
    token: glpat-test-token-aaaaaaaa
    api_host: only-one.example
    user: alice
  second.example:
    token: glpat-test-token-bbbbbbbb
    api_host: second.example
  empty.example:
    token: ""
host: second.example
`;
    await writeFile(join(dir, "config.yml"), yaml, "utf8");
    const prev = process.env.GLAB_CONFIG_DIR;
    try {
      process.env.GLAB_CONFIG_DIR = dir;
      const hosts = await listAuthenticatedHosts();
      expect(hosts.length).toBe(2);
      expect(hosts.every((h) => h.token.length > 0)).toBe(true);
      // default host first
      expect(hosts[0]?.hostname).toBe("second.example");
      expect(hosts.some((h) => h.hostname === "only-one.example")).toBe(true);
      // empty token excluded
      expect(hosts.some((h) => h.hostname === "empty.example")).toBe(false);
    } finally {
      if (prev === undefined) delete process.env.GLAB_CONFIG_DIR;
      else process.env.GLAB_CONFIG_DIR = prev;
    }
  });

  test("findHostOption matches hostname and apiHost", () => {
    const hosts = [
      {
        hostname: "git.a.example",
        apiHost: "git.a.example",
        token: "t1",
      },
      {
        hostname: "git.b.example",
        apiHost: "api.b.example",
        token: "t2",
      },
    ];
    expect(findHostOption(hosts, null)).toBeNull();
    expect(findHostOption(hosts, "git.a.example")?.hostname).toBe("git.a.example");
    expect(findHostOption(hosts, "https://api.b.example/")?.hostname).toBe("git.b.example");
    expect(findHostOption(hosts, "missing.example")).toBeNull();
  });

  test("shouldShowHostPicker: single host never; multi without save yes", () => {
    expect(shouldShowHostPicker(1, null, ["a"])).toBe(false);
    expect(shouldShowHostPicker(0, null, [])).toBe(false);
    expect(shouldShowHostPicker(2, null, ["a", "b"])).toBe(true);
    expect(shouldShowHostPicker(2, "a", ["a", "b"])).toBe(false);
    expect(shouldShowHostPicker(2, "c", ["a", "b"])).toBe(true);
  });

  test("resolveAuth succeeds when glab is configured on this machine", async () => {
    if (!isGlabInstalled()) {
      try {
        await resolveAuth();
        expect.unreachable("should throw");
      } catch (e) {
        expect(e).toBeInstanceOf(AuthError);
        const err = e as AuthError;
        expect(err.code).toBe("glab_not_installed");
        expect(err.steps.length).toBe(2);
        expect(err.format()).toContain("Install glab");
        expect(err.format()).toContain("Authenticate");
      }
      return;
    }

    const a = await resolveAuth();
    expect(a.tokenSource).toBe("glab");
    expect(a.token.length).toBeGreaterThan(0);
    expect(a.host).toMatch(/^https?:\/\//);
  });

  test("resolveAuth prefers explicit host when multi-host fixture", async () => {
    const dir = await mkdtemp(join(tmpdir(), "ciview-glab-pref-"));
    await mkdir(dir, { recursive: true });
    await writeFile(
      join(dir, "config.yml"),
      `
hosts:
  alpha.example:
    token: glpat-alpha-token-xxxxxx
  beta.example:
    token: glpat-beta-token-yyyyyy
host: alpha.example
`,
      "utf8",
    );
    const prev = process.env.GLAB_CONFIG_DIR;
    try {
      process.env.GLAB_CONFIG_DIR = dir;
      const beta = await resolveAuth("beta.example");
      expect(beta.host).toContain("beta.example");
      expect(beta.token).toContain("beta");
      const alpha = await resolveAuth("alpha.example");
      expect(alpha.host).toContain("alpha.example");
    } finally {
      if (prev === undefined) delete process.env.GLAB_CONFIG_DIR;
      else process.env.GLAB_CONFIG_DIR = prev;
    }
  });

  test("AuthError.format lists numbered Fix steps", () => {
    const err = new AuthError("glab_not_installed", "missing", [
      "Install glab: brew install glab",
      "Authenticate: glab auth login",
    ]);
    const text = err.format();
    expect(text).toContain("1)");
    expect(text).toContain("2)");
    expect(text).toContain("Install glab");
    expect(text).toContain("Authenticate");
  });
});
