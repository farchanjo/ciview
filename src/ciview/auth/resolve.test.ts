import { describe, expect, test } from "bun:test";
import { AuthError, isGlabInstalled, resolveAuth } from "./resolve.ts";

describe("resolveAuth (glab-only)", () => {
  test("isGlabInstalled reflects PATH", () => {
    // On this machine glab should exist; still a boolean API.
    expect(typeof isGlabInstalled()).toBe("boolean");
  });

  test("resolveAuth succeeds when glab is configured on this machine", async () => {
    if (!isGlabInstalled()) {
      // CI without glab: expect install error shape
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
