import { format, isValid, parseISO } from "date-fns";
import type { NoteEntry } from "./types";

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

/** Format an RFC3339 string as a `YYYY-MM-DD` value for a native date input. */
export function toDateInputValue(iso?: string | null): string {
  if (!iso) return "";
  const d = parseISO(iso);
  return isValid(d) ? format(d, "yyyy-MM-dd") : "";
}

/**
 * Combine a `YYYY-MM-DD` (from a date input) with the time-of-day of an
 * existing RFC3339 timestamp, producing a new RFC3339 string that includes the
 * local timezone offset (so Rust's `DateTime<FixedOffset>` parses it). Falls
 * back to local midnight when `base` is absent/invalid. Returns null on empty.
 */
export function setDatePreservingTime(
  dateStr: string,
  base?: string | null,
): string | null {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) return null;
  const baseDate = base ? parseISO(base) : null;
  const valid = baseDate && isValid(baseDate);
  const result = new Date(
    y,
    m - 1,
    d,
    valid ? baseDate!.getHours() : 0,
    valid ? baseDate!.getMinutes() : 0,
    valid ? baseDate!.getSeconds() : 0,
  );
  return format(result, "yyyy-MM-dd'T'HH:mm:ssxxx");
}

/** Text of the first non-empty line if it is an h1 (`# heading`), else null. */
function firstH1(body: string): string | null {
  for (const raw of body.split("\n")) {
    const line = raw.trim();
    if (line === "") continue;
    const m = /^#\s+(.+)$/.exec(line);
    return m ? m[1].trim() : null;
  }
  return null;
}

/**
 * The title to display for a note. Titles are derived, not stored:
 * - misc notes use their first line when it is an h1 (`# heading`);
 * - meeting notes are titled by their date (e.g. "June 14").
 * Falls back to the stored title, then "Untitled".
 */
export function noteTitle(note: NoteEntry): string {
  const { metadata, body } = note;
  if (metadata.source === "misc") {
    return firstH1(body) ?? metadata.title ?? "Untitled";
  }
  const iso = metadata.start ?? metadata.createdAt;
  const d = parseISO(iso);
  return isValid(d) ? format(d, "MMMM d") : metadata.title || "Untitled";
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
