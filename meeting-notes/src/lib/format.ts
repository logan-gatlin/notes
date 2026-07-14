import { format, isValid, parseISO } from "date-fns";

/** Format an RFC3339 string as a friendly date-time, or "" if absent/invalid. */
export function formatDateTime(iso?: string | null): string {
  if (!iso) return "";
  const d = parseISO(iso);
  return isValid(d) ? format(d, "EEE, MMM d yyyy · h:mm a") : "";
}

export function formatDate(iso?: string | null): string {
  if (!iso) return "";
  const d = parseISO(iso);
  return isValid(d) ? format(d, "MMM d, yyyy") : "";
}

export function formatTimeRange(
  start?: string | null,
  end?: string | null,
): string {
  if (!start) return "";
  const s = parseISO(start);
  if (!isValid(s)) return "";
  const base = format(s, "EEE, MMM d · h:mm a");
  if (!end) return base;
  const e = parseISO(end);
  return isValid(e) ? `${base} – ${format(e, "h:mm a")}` : base;
}
