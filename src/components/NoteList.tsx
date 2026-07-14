import type { NoteEntry } from "../lib/types";
import { formatDate } from "../lib/format";
import clsx from "clsx";

interface NoteListProps {
  notes: NoteEntry[];
  selectedPath?: string | null;
  loading: boolean;
  onSelect: (note: NoteEntry) => void;
  onDelete: (note: NoteEntry) => void;
}

export function NoteList({
  notes,
  selectedPath,
  loading,
  onSelect,
  onDelete,
}: NoteListProps) {
  if (loading) {
    return <div className="p-4 text-sm text-gray-400">Loading…</div>;
  }
  if (notes.length === 0) {
    return <div className="p-4 text-sm text-gray-400">No notes yet.</div>;
  }

  return (
    <ul className="overflow-auto">
      {notes.map((note) => {
        const selected = note.path === selectedPath;
        const when = note.metadata.start ?? note.metadata.createdAt;
        return (
          <li
            key={note.path}
            className={clsx(
              "group px-3 py-2 border-b border-gray-100 cursor-pointer flex items-start justify-between gap-2",
              selected ? "bg-blue-50" : "hover:bg-gray-50",
            )}
            onClick={() => onSelect(note)}
          >
            <div className="min-w-0">
              <div className="text-sm font-medium truncate">
                {note.metadata.title || "Untitled"}
              </div>
              <div className="text-xs text-gray-500">{formatDate(when)}</div>
            </div>
            <button
              className="opacity-0 group-hover:opacity-100 text-xs text-red-500 hover:text-red-700"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(note);
              }}
              title="Delete note"
            >
              Delete
            </button>
          </li>
        );
      })}
    </ul>
  );
}
