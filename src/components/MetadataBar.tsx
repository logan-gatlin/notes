import type { NoteEntry } from "../lib/types";
import { formatTimeRange, noteTitle } from "../lib/format";

interface MetadataBarProps {
  note: NoteEntry;
  meetingTypeName?: string;
  saveState: "saved" | "saving" | "dirty";
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
}: MetadataBarProps) {
  const { metadata } = note;

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
        {metadata.start && (
          <span>{formatTimeRange(metadata.start, metadata.end)}</span>
        )}
      </div>
    </div>
  );
}
