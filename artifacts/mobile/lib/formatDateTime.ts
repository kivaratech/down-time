// Absolute timestamp formatting for issues and comments. The list/detail
// screens already show a relative age ("3 days old", "5m ago") for quick
// triage; these helpers give the exact date + time for record-keeping —
// restaurant staff and supervisors need to know precisely when something
// was reported or commented, not just roughly how long ago.

/**
 * Full timestamp: "Jun 15, 2026, 2:34 PM".
 * Used on the issue tile and as the exact comment submission time.
 */
export function formatTimestamp(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * Compact timestamp without the year: "Jun 15, 2:34 PM". Handy where space
 * is tight (e.g. comment metadata rows) — falls back to including the year
 * automatically when the date is not in the current year.
 */
export function formatTimestampShort(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
    hour: "numeric",
    minute: "2-digit",
  });
}
