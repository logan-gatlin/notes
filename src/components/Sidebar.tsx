import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { NoteList } from "./NoteList";
import { NewNoteModal } from "./NewNoteModal";
import { NewMeetingTypeModal } from "./NewMeetingTypeModal";
import { ConfirmDialog } from "./ConfirmDialog";
import { ARCHIVE_ID, MISC_ID, useNotesStore } from "../state/notesStore";
import { useMeetingTypesStore } from "../state/meetingTypesStore";
import type { MeetingType } from "../lib/types";

type Mode = "selector" | "list";

/**
 * Unified contextual sidebar.
 *
 * Starts as a category *selector* (All / each meeting type / Misc / Archive).
 * Choosing a category drills into a *list* of that category's notes, with a
 * back button and context-appropriate "new note" actions at the top.
 * Collapsible.
 */
export function Sidebar() {
  const notes = useNotesStore();
  const meetingTypes = useMeetingTypesStore();

  const [mode, setMode] = useState<Mode>("selector");
  const [collapsed, setCollapsed] = useState(false);
  const [showNewNote, setShowNewNote] = useState(false);
  const [showNewType, setShowNewType] = useState(false);
  const [typeToDelete, setTypeToDelete] = useState<MeetingType | null>(null);

  useEffect(() => {
    meetingTypes.load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openCategory = (id: string | null) => {
    notes.loadNotes(id);
    setMode("list");
  };

  const activeType = meetingTypes.types.find((t) => t.id === notes.filter);
  const categoryLabel =
    notes.filter === null
      ? "All Notes"
      : notes.filter === MISC_ID
        ? "Misc Notes"
        : notes.filter === ARCHIVE_ID
          ? "Archive"
          : (activeType?.name ?? "Notes");

  const newMiscNote = async () => {
    const note = await notes.create({ title: "Untitled", source: "misc" });
    notes.select(note);
  };

  const newTypedNote = async () => {
    if (!activeType) return;
    const note = await notes.create({
      title: activeType.name,
      meetingTypeId: activeType.id,
      source: "manual",
    });
    notes.select(note);
  };

  if (collapsed) {
    return (
      <div className="w-10 shrink-0 border-r border-gray-800 bg-gray-900 flex flex-col items-center py-2">
        <button
          className="p-1.5 rounded text-gray-400 hover:bg-gray-800 hover:text-gray-200"
          onClick={() => setCollapsed(false)}
          title="Expand sidebar"
        >
          »
        </button>
      </div>
    );
  }

  return (
    <div className="w-64 shrink-0 border-r border-gray-800 bg-gray-900 flex flex-col h-full">
      {mode === "selector" ? (
        <SelectorView
          onCollapse={() => setCollapsed(true)}
          meetingTypes={meetingTypes.types}
          onOpen={openCategory}
          onNewMeetingType={() => setShowNewType(true)}
          onDeleteMeetingType={setTypeToDelete}
        />
      ) : (
        <ListView
          label={categoryLabel}
          onBack={() => setMode("selector")}
          onCollapse={() => setCollapsed(true)}
          filter={notes.filter}
          onNewMeetingNote={() => setShowNewNote(true)}
          onNewMiscNote={newMiscNote}
          onNewTypedNote={newTypedNote}
          notes={notes}
        />
      )}

      {showNewNote && (
        <NewNoteModal
          onClose={() => setShowNewNote(false)}
          onCreated={() => notes.loadNotes(notes.filter)}
        />
      )}
      {showNewType && (
        <NewMeetingTypeModal onClose={() => setShowNewType(false)} />
      )}
      {typeToDelete && (
        <ConfirmDialog
          title="Delete meeting type"
          message={`Delete the "${typeToDelete.name}" meeting type? Existing notes are kept on disk but will no longer be grouped under it.`}
          confirmLabel="Delete"
          destructive
          onConfirm={() => {
            void meetingTypes.remove(typeToDelete.id);
            setTypeToDelete(null);
          }}
          onClose={() => setTypeToDelete(null)}
        />
      )}
    </div>
  );
}

/** Icon-only header button (collapse). */
function IconButton({
  onClick,
  title,
  children,
}: {
  onClick: () => void;
  title: string;
  children: ReactNode;
}) {
  return (
    <button
      className="p-1.5 rounded text-gray-400 hover:bg-gray-800 hover:text-gray-200 leading-none"
      onClick={onClick}
      title={title}
    >
      {children}
    </button>
  );
}

interface SelectorViewProps {
  onCollapse: () => void;
  meetingTypes: MeetingType[];
  onOpen: (id: string | null) => void;
  onNewMeetingType: () => void;
  onDeleteMeetingType: (mt: MeetingType) => void;
}

function SelectorView({
  onCollapse,
  meetingTypes,
  onOpen,
  onNewMeetingType,
  onDeleteMeetingType,
}: SelectorViewProps) {
  const item = (id: string | null, label: string) => (
    <button
      key={id ?? "all"}
      className="w-full text-left px-3 py-1.5 rounded text-sm text-gray-300 hover:bg-gray-800"
      onClick={() => onOpen(id)}
    >
      {label}
    </button>
  );

  return (
    <>
      <div className="flex items-center justify-end px-2 py-2 border-b border-gray-800">
        <IconButton onClick={onCollapse} title="Collapse sidebar">
          «
        </IconButton>
      </div>
      <div className="flex flex-col gap-1 p-2 overflow-auto flex-1">
        {item(null, "All Notes")}
        <div className="mt-2 mb-1 px-3 text-xs uppercase tracking-wide text-gray-500">
          Meeting Types
        </div>
        {meetingTypes.map((mt) => (
          <div key={mt.id} className="group flex items-center rounded hover:bg-gray-800">
            <button
              className="flex-1 min-w-0 text-left px-3 py-1.5 text-sm text-gray-300 truncate"
              onClick={() => onOpen(mt.id)}
            >
              {mt.name}
            </button>
            <button
              className="opacity-0 group-hover:opacity-100 px-2 py-1.5 text-gray-500 hover:text-red-400 leading-none"
              onClick={() => onDeleteMeetingType(mt)}
              title={`Delete "${mt.name}"`}
              aria-label={`Delete ${mt.name}`}
            >
              ×
            </button>
          </div>
        ))}
        <button
          className="w-full text-left px-3 py-1.5 rounded text-sm text-emerald-400 hover:bg-gray-800"
          onClick={onNewMeetingType}
        >
          + New Meeting Type
        </button>
        <div className="mt-2 mb-1 px-3 text-xs uppercase tracking-wide text-gray-500">
          Other
        </div>
        {item(MISC_ID, "Misc Notes")}
        {item(ARCHIVE_ID, "Archive")}
      </div>
    </>
  );
}

interface ListViewProps {
  label: string;
  onBack: () => void;
  onCollapse: () => void;
  filter: string | null;
  onNewMeetingNote: () => void;
  onNewMiscNote: () => void;
  onNewTypedNote: () => void;
  notes: ReturnType<typeof useNotesStore.getState>;
}

function ListView({
  label,
  onBack,
  onCollapse,
  filter,
  onNewMeetingNote,
  onNewMiscNote,
  onNewTypedNote,
  notes,
}: ListViewProps) {
  const primaryBtn =
    "w-full px-3 py-1.5 rounded bg-emerald-600 text-white text-sm hover:bg-emerald-500";
  const secondaryBtn =
    "w-full px-3 py-1.5 rounded border border-gray-700 text-gray-200 text-sm hover:bg-gray-800";

  const showCreate = filter !== ARCHIVE_ID;

  return (
    <>
      <div className="flex items-center gap-1 px-2 py-1.5 border-b border-gray-800">
        <button
          className="shrink-0 flex items-center gap-1 pl-2 pr-3 py-1.5 rounded text-sm text-gray-300 hover:bg-gray-800 hover:text-gray-100"
          onClick={onBack}
          title="Back to categories"
        >
          <span className="text-lg leading-none">‹</span>
          Back
        </button>
        <span className="flex-1 min-w-0 truncate text-sm font-medium text-gray-100 text-right">
          {label}
        </span>
        <IconButton onClick={onCollapse} title="Collapse sidebar">
          «
        </IconButton>
      </div>

      {showCreate && (
        <div className="flex flex-col gap-1 p-2 border-b border-gray-800">
          {filter === null && (
            <>
              <button className={primaryBtn} onClick={onNewMeetingNote}>
                + New Meeting Note
              </button>
              <button className={secondaryBtn} onClick={onNewMiscNote}>
                + New Misc Note
              </button>
            </>
          )}
          {filter === MISC_ID && (
            <button className={primaryBtn} onClick={onNewMiscNote}>
              + New Misc Note
            </button>
          )}
          {filter !== null && filter !== MISC_ID && (
            <button className={primaryBtn} onClick={onNewTypedNote}>
              + New Note
            </button>
          )}
        </div>
      )}

      <div className="p-2 border-b border-gray-800">
        <input
          className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-gray-100 placeholder-gray-500 outline-none focus:border-emerald-500"
          placeholder="Search notes…"
          value={notes.searchQuery}
          onChange={(e) => notes.search(e.target.value)}
        />
      </div>

      <div className="flex-1 min-h-0 overflow-auto">
        <NoteList
          notes={notes.notes}
          selectedPath={notes.selected?.path}
          loading={notes.loading}
          onSelect={(n) => notes.select(n)}
          onDelete={(n) => notes.remove(n.path)}
          onToggleArchive={(n) =>
            notes.setArchived(n.path, !n.metadata.archived)
          }
        />
      </div>
    </>
  );
}
