import type { NoteEntry } from "../lib/types";
import { noteTitle, toDateInputValue } from "../lib/format";

interface MetadataBarProps {
  note: NoteEntry;
  meetingTypeName?: string;
  saveState: "saved" | "saving" | "dirty";
  /** Set the note's date (YYYY-MM-DD); backdates title, sort, and frontmatter. */
  onDateChange?: (dateStr: string) => void;
}

const sourceLabel: Record<string, string> = {
  auto: "Auto-created",
  manual: "Manual",
  misc: "Misc",
};

export function MetadataBar({
  note,
  meetingTypeName,
  saveState,
  onDateChange,
}: MetadataBarProps) {
  const { metadata } = note;
  const dateValue = toDateInputValue(metadata.start ?? metadata.createdAt);

  const save =
    saveState === "saving"
      ? { label: "Saving…", tone: "text-muted" }
      : saveState === "dirty"
        ? { label: "Unsaved", tone: "text-accent" }
        : { label: "Saved", tone: "text-muted" };

  return (
    <div className="border-b border-line px-4 py-3 flex flex-col gap-2 bg-surface">
      <div className="flex items-baseline gap-3">
        <h2 className="flex-1 min-w-0 font-serif text-xl font-semibold text-ink truncate">
          {noteTitle(note)}
        </h2>
        <span
          className={
            "shrink-0 flex items-center gap-1.5 font-mono text-[11px] tracking-tight whitespace-nowrap " +
            save.tone
          }
        >
          <span
            className={
              "inline-block w-1.5 h-1.5 rounded-full " +
              (saveState === "dirty" ? "bg-accent-soft" : "bg-line-strong")
            }
            aria-hidden
          />
          {save.label}
        </span>
      </div>
      <div className="flex items-center gap-3 text-xs text-muted flex-wrap">
        <span className="eyebrow border border-line-strong rounded px-1.5 py-1">
          {sourceLabel[metadata.source] ?? metadata.source}
        </span>
        {meetingTypeName && <span className="text-ink-soft">{meetingTypeName}</span>}
        {metadata.source !== "misc" && (
          <label className="flex items-center gap-1.5" title="Change note date">
            <span className="eyebrow">Date</span>
            <input
              type="date"
              className="bg-surface border border-line-strong text-ink-soft font-mono text-xs rounded px-1.5 py-0.5 outline-none focus:border-accent transition-colors"
              value={dateValue}
              onChange={(e) => onDateChange?.(e.target.value)}
            />
          </label>
        )}
      </div>
    </div>
  );
}
