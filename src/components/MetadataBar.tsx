import type { NoteEntry } from "../lib/types";
import { formatTimeRange } from "../lib/format";

interface MetadataBarProps {
  note: NoteEntry;
  meetingTypeName?: string;
  onTitleChange: (title: string) => void;
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
  onTitleChange,
  saveState,
}: MetadataBarProps) {
  const { metadata } = note;

  return (
    <div className="border-b border-gray-200 px-4 py-2 flex flex-col gap-1 bg-gray-50">
      <div className="flex items-center gap-2">
        <input
          className="flex-1 text-lg font-semibold bg-transparent outline-none border-b border-transparent focus:border-gray-300"
          value={metadata.title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder="Untitled note"
        />
        <span className="text-xs text-gray-500 whitespace-nowrap">
          {saveState === "saving"
            ? "Saving…"
            : saveState === "dirty"
              ? "Unsaved"
              : "Saved"}
        </span>
      </div>
      <div className="flex items-center gap-3 text-xs text-gray-500 flex-wrap">
        <span className="px-1.5 py-0.5 rounded bg-gray-200 text-gray-700">
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
