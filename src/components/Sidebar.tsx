import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { NoteList } from "./NoteList";
import { NewNoteModal } from "./NewNoteModal";
import { NewMeetingTypeModal } from "./NewMeetingTypeModal";
import { AiSettingsModal } from "./AiSettingsModal";
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
  const [showAiSettings, setShowAiSettings] = useState(false);
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
      <div className="w-11 shrink-0 border-r border-line bg-panel flex flex-col items-center py-3">
        <button
          className="p-2 rounded-md text-muted hover:bg-paper hover:text-ink transition-colors"
          onClick={() => setCollapsed(false)}
          title="Expand sidebar"
          aria-label="Expand sidebar"
        >
          »
        </button>
      </div>
    );
  }

  return (
    <div className="w-64 shrink-0 border-r border-line bg-panel flex flex-col h-full">
      {mode === "selector" ? (
        <SelectorView
          onCollapse={() => setCollapsed(true)}
          meetingTypes={meetingTypes.types}
          onOpen={openCategory}
          onNewMeetingType={() => setShowNewType(true)}
          onDeleteMeetingType={setTypeToDelete}
          onOpenAiSettings={() => setShowAiSettings(true)}
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
      {showAiSettings && (
        <AiSettingsModal onClose={() => setShowAiSettings(false)} />
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
      className="p-1.5 rounded-md text-muted hover:bg-paper hover:text-ink leading-none transition-colors"
      onClick={onClick}
      title={title}
      aria-label={title}
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
  onOpenAiSettings: () => void;
}

function SelectorView({
  onCollapse,
  meetingTypes,
  onOpen,
  onNewMeetingType,
  onDeleteMeetingType,
  onOpenAiSettings,
}: SelectorViewProps) {
  const item = (id: string | null, label: string) => (
    <button
      key={id ?? "all"}
      className="w-full text-left px-3 py-2 rounded-md text-sm text-ink-soft hover:bg-paper hover:text-ink transition-colors"
      onClick={() => onOpen(id)}
    >
      {label}
    </button>
  );

  return (
    <>
      <div className="flex items-center justify-between px-3 h-12 border-b border-line">
        <span className="font-semibold text-ink tracking-tight">Notes</span>
        <div className="flex items-center gap-0.5">
          <IconButton onClick={onOpenAiSettings} title="AI settings">
            ⚙
          </IconButton>
          <IconButton onClick={onCollapse} title="Collapse sidebar">
            «
          </IconButton>
        </div>
      </div>
      <div className="flex flex-col gap-0.5 p-2 overflow-auto flex-1">
        {item(null, "All Notes")}

        <div className="eyebrow mt-4 mb-1.5 px-3">Meeting Types</div>
        {meetingTypes.map((mt) => (
          <div
            key={mt.id}
            className="group flex items-center rounded-md hover:bg-paper transition-colors"
          >
            <button
              className="flex-1 min-w-0 text-left px-3 py-2 text-sm text-ink-soft group-hover:text-ink truncate"
              onClick={() => onOpen(mt.id)}
            >
              {mt.name}
            </button>
            <button
              className="opacity-0 group-hover:opacity-100 px-2.5 py-2 text-muted hover:text-danger leading-none transition-opacity"
              onClick={() => onDeleteMeetingType(mt)}
              title={`Delete "${mt.name}"`}
              aria-label={`Delete ${mt.name}`}
            >
              ×
            </button>
          </div>
        ))}
        <button
          className="w-full text-left px-3 py-2 rounded-md text-sm text-accent font-medium hover:bg-paper transition-colors"
          onClick={onNewMeetingType}
        >
          + New meeting type
        </button>

        <div className="eyebrow mt-4 mb-1.5 px-3">Other</div>
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
    "w-full px-3 py-2 rounded-md bg-ink text-paper text-sm font-medium hover:bg-black transition-colors";
  const secondaryBtn =
    "w-full px-3 py-2 rounded-md border border-line-strong text-ink-soft text-sm hover:bg-paper hover:border-muted transition-colors";

  const showCreate = filter !== ARCHIVE_ID;

  return (
    <>
      <div className="flex items-center gap-1 px-2 h-12 border-b border-line">
        <button
          className="shrink-0 flex items-center gap-1 pl-1.5 pr-2.5 py-1.5 rounded-md text-sm text-ink-soft hover:bg-paper hover:text-ink transition-colors"
          onClick={onBack}
          title="Back to categories"
        >
          <span className="text-lg leading-none">‹</span>
          Back
        </button>
        <span className="flex-1 min-w-0 truncate text-sm font-semibold text-ink text-right">
          {label}
        </span>
        <IconButton onClick={onCollapse} title="Collapse sidebar">
          «
        </IconButton>
      </div>

      {showCreate && (
        <div className="flex flex-col gap-1.5 p-2 border-b border-line">
          {filter === null && (
            <>
              <button className={primaryBtn} onClick={onNewMeetingNote}>
                + New meeting note
              </button>
              <button className={secondaryBtn} onClick={onNewMiscNote}>
                + New misc note
              </button>
            </>
          )}
          {filter === MISC_ID && (
            <button className={primaryBtn} onClick={onNewMiscNote}>
              + New misc note
            </button>
          )}
          {filter !== null && filter !== MISC_ID && (
            <button className={primaryBtn} onClick={onNewTypedNote}>
              + New note
            </button>
          )}
        </div>
      )}

      <div className="p-2 border-b border-line">
        <input
          className="w-full bg-surface border border-line-strong rounded-md px-2.5 py-1.5 text-sm text-ink placeholder-muted outline-none focus:border-accent transition-colors"
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
