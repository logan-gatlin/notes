import type { MeetingType } from "../lib/types";
import clsx from "clsx";
import { MISC_ID } from "../state/notesStore";

interface SidebarProps {
  meetingTypes: MeetingType[];
  activeFilter: string | null;
  onSelectFilter: (id: string | null) => void;
  onNewNote: () => void;
  onNewMiscNote: () => void;
  onNewMeetingType: () => void;
}

export function Sidebar({
  meetingTypes,
  activeFilter,
  onSelectFilter,
  onNewNote,
  onNewMiscNote,
  onNewMeetingType,
}: SidebarProps) {
  const item = (id: string | null, label: string) => (
    <button
      key={id ?? "all"}
      className={clsx(
        "w-full text-left px-3 py-1.5 rounded text-sm",
        activeFilter === id
          ? "bg-blue-100 text-blue-800 font-medium"
          : "hover:bg-gray-100 text-gray-700",
      )}
      onClick={() => onSelectFilter(id)}
    >
      {label}
    </button>
  );

  return (
    <div className="w-60 shrink-0 border-r border-gray-200 flex flex-col h-full bg-white">
      <div className="px-3 py-3 border-b border-gray-200">
        <h1 className="text-base font-semibold">Meeting Notes</h1>
      </div>

      <div className="flex flex-col gap-1 p-2 overflow-auto flex-1">
        {item(null, "All Notes")}
        <div className="mt-2 mb-1 px-3 text-xs uppercase tracking-wide text-gray-400">
          Meeting Types
        </div>
        {meetingTypes.length === 0 && (
          <div className="px-3 text-xs text-gray-400">None yet</div>
        )}
        {meetingTypes.map((mt) => item(mt.id, mt.name))}
        <div className="mt-2 mb-1 px-3 text-xs uppercase tracking-wide text-gray-400">
          Other
        </div>
        {item(MISC_ID, "Misc Notes")}
      </div>

      <div className="p-2 border-t border-gray-200 flex flex-col gap-1">
        <button
          className="w-full px-3 py-1.5 rounded bg-blue-600 text-white text-sm hover:bg-blue-700"
          onClick={onNewNote}
        >
          + New Meeting Note
        </button>
        <button
          className="w-full px-3 py-1.5 rounded border border-gray-300 text-sm hover:bg-gray-50"
          onClick={onNewMiscNote}
        >
          + New Misc Note
        </button>
        <button
          className="w-full px-3 py-1.5 rounded border border-gray-300 text-sm hover:bg-gray-50"
          onClick={onNewMeetingType}
        >
          + New Meeting Type
        </button>
      </div>
    </div>
  );
}
