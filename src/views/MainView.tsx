import { useEffect, useState } from "react";
import { Sidebar } from "../components/Sidebar";
import { NoteList } from "../components/NoteList";
import { EditorPane } from "../components/EditorPane";
import { NewNoteModal } from "../components/NewNoteModal";
import { NewMeetingTypeModal } from "../components/NewMeetingTypeModal";
import { useNotesStore } from "../state/notesStore";
import { useMeetingTypesStore } from "../state/meetingTypesStore";

export function MainView() {
  const notes = useNotesStore();
  const meetingTypes = useMeetingTypesStore();

  const [showNewNote, setShowNewNote] = useState(false);
  const [showNewType, setShowNewType] = useState(false);

  useEffect(() => {
    meetingTypes.load();
    notes.loadNotes(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const newMiscNote = async () => {
    const note = await notes.create({
      title: "Untitled",
      source: "misc",
    });
    notes.select(note);
  };

  return (
    <div className="flex h-full">
      <Sidebar
        meetingTypes={meetingTypes.types}
        activeFilter={notes.filter}
        onSelectFilter={(id) => notes.loadNotes(id)}
        onNewNote={() => setShowNewNote(true)}
        onNewMiscNote={newMiscNote}
        onNewMeetingType={() => setShowNewType(true)}
      />

      {/* Note list column */}
      <div className="w-72 shrink-0 border-r border-gray-200 flex flex-col h-full">
        <div className="p-2 border-b border-gray-200">
          <input
            className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
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
          />
        </div>
      </div>

      {/* Editor column */}
      <div className="flex-1 min-w-0 h-full">
        {notes.selected ? (
          <EditorPane key={notes.selected.path} note={notes.selected} />
        ) : (
          <div className="h-full flex items-center justify-center text-gray-400 text-sm">
            Select or create a note.
          </div>
        )}
      </div>

      {showNewNote && (
        <NewNoteModal
          onClose={() => setShowNewNote(false)}
          onCreated={() => notes.loadNotes(notes.filter)}
        />
      )}
      {showNewType && (
        <NewMeetingTypeModal onClose={() => setShowNewType(false)} />
      )}
    </div>
  );
}
