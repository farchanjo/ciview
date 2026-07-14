import type { CiStatus } from "../gitlab/types.ts";
import { isActiveStatus } from "../gitlab/types.ts";

export function statusGlyph(status: CiStatus | undefined): string {
  if (!status) return "·";
  if (isActiveStatus(status)) return "●";
  switch (status) {
    case "success":
      return "✓";
    case "failed":
      return "✗";
    case "canceled":
    case "cancelled":
      return "⊘";
    case "skipped":
      return "–";
    case "manual":
      return "▶";
    default:
      return "·";
  }
}

export function statusColor(status: CiStatus | undefined): string {
  if (!status) return "#888888";
  if (isActiveStatus(status)) return "#f5c518";
  switch (status) {
    case "success":
      return "#3fb950";
    case "failed":
      return "#f85149";
    case "canceled":
    case "cancelled":
      return "#8b949e";
    case "manual":
      return "#58a6ff";
    default:
      return "#8b949e";
  }
}
