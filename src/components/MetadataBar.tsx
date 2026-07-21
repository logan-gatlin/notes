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

  return (
    <div className="border-b border-gray-800 px-4 py-2 flex flex-col gap-1 bg-gray-800/50">
      <div className="flex items-center gap-2">
        <h2 className="flex-1 min-w-0 text-lg font-semibold text-gray-100 truncate">
          {noteTitle(note)}
        </h2>
        <span className="text-xs text-gray-400 whitespace-nowrap">
          {saveState === "saving"
            ? "Saving…"
            : saveState === "dirty"
              ? "Unsaved"
              : "Saved"}
        </span>
      </div>
      <div className="flex items-center gap-3 text-xs text-gray-400 flex-wrap">
        <span className="px-1.5 py-0.5 rounded bg-gray-700 text-gray-200">
          {sourceLabel[metadata.source] ?? metadata.source}
        </span>
        {meetingTypeName && <span>{meetingTypeName}</span>}
        {metadata.source !== "misc" && (
          <label className="flex items-center gap-1" title="Change note date">
            <span>Date</span>
            <input
              type="date"
              className="bg-gray-900 border border-gray-700 text-gray-200 rounded px-1.5 py-0.5 outline-none focus:border-emerald-500"
              value={dateValue}
              onChange={(e) => onDateChange?.(e.target.value)}
            />
          </label>
        )}
      </div>
    </div>
  );
}
