export async function openUrl(url: string): Promise<void> {
  if (!url) return;
  const proc = Bun.spawn({
    cmd: process.platform === "darwin" ? ["open", url] : process.platform === "win32" ? ["cmd", "/c", "start", url] : ["xdg-open", url],
    stdout: "ignore",
    stderr: "ignore",
  });
  await proc.exited;
}
