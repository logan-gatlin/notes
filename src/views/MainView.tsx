import { Sidebar } from "../components/Sidebar";
import { EditorPane } from "../components/EditorPane";
import { useNotesStore } from "../state/notesStore";

export function MainView() {
  const selected = useNotesStore((s) => s.selected);

  return (
    <div className="flex h-full bg-paper text-ink">
      <Sidebar />

      {/* Editor column */}
      <div className="flex-1 min-w-0 h-full">
        {selected ? (
          <EditorPane key={selected.path} note={selected} />
        ) : (
          <div className="h-full flex flex-col items-center justify-center gap-3 px-6 text-center">
            <span className="eyebrow">No note open</span>
            <p className="max-w-xs font-serif text-lg text-ink-soft">
              Pick a note from the list, or start a new one to begin the record.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
