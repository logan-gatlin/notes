import { Sidebar } from "../components/Sidebar";
import { EditorPane } from "../components/EditorPane";
import { useNotesStore } from "../state/notesStore";

export function MainView() {
  const selected = useNotesStore((s) => s.selected);

  return (
    <div className="flex h-full">
      <Sidebar />

      {/* Editor column */}
      <div className="flex-1 min-w-0 h-full">
        {selected ? (
          <EditorPane key={selected.path} note={selected} />
        ) : (
          <div className="h-full flex items-center justify-center text-gray-500 text-sm">
            Select or create a note.
          </div>
        )}
      </div>
    </div>
  );
}
