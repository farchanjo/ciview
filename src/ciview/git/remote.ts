/** Resolve path/with/namespace from git remote origin. */
export async function projectFromGitRemote(cwd = process.cwd()): Promise<string | null> {
  try {
    const proc = Bun.spawn({
      cmd: ["git", "remote", "get-url", "origin"],
      cwd,
      stdout: "pipe",
      stderr: "pipe",
    });
    const text = await new Response(proc.stdout).text();
    await proc.exited;
    const url = text.trim();
    if (!url) return null;
    // git@host:group/proj.git  or https://host/group/proj.git
    let path = url;
    if (path.startsWith("git@")) {
      path = path.split(":").slice(1).join(":");
    } else {
      try {
        const u = new URL(path);
        path = u.pathname.replace(/^\//, "");
      } catch {
        /* keep */
      }
    }
    path = path.replace(/\.git$/, "").replace(/^\//, "");
    return path.includes("/") ? path : null;
  } catch {
    return null;
  }
}
