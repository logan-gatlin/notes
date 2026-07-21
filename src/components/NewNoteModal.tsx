import { useState } from "react";
import { Modal } from "./Modal";
import { useMeetingTypesStore } from "../state/meetingTypesStore";
import { useNotesStore } from "../state/notesStore";

interface Props {
  onClose: () => void;
  onCreated: () => void;
}

/** Create a manual note tied to an existing meeting type. */
export function NewNoteModal({ onClose, onCreated }: Props) {
  const types = useMeetingTypesStore((s) => s.types);
  const createNote = useNotesStore((s) => s.create);

  const [meetingTypeId, setMeetingTypeId] = useState(types[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const selectedType = types.find((t) => t.id === meetingTypeId);

  const submit = async () => {
    if (!meetingTypeId) {
      setError("Select a meeting type");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await createNote({
        title: title.trim() || selectedType?.name || "Meeting Note",
        meetingTypeId,
        source: "manual",
      });
      onCreated();
      onClose();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="New Meeting Note" onClose={onClose}>
      {types.length === 0 ? (
        <div className="text-sm text-ink-soft">
          Create a meeting type first.
        </div>
      ) : (
        <div className="flex flex-col gap-4 text-sm">
          <label className="flex flex-col gap-1.5">
            <span className="eyebrow">Meeting type</span>
            <select
              className="bg-paper border border-line-strong text-ink rounded-md px-2.5 py-1.5 outline-none focus:border-accent transition-colors"
              value={meetingTypeId}
              onChange={(e) => setMeetingTypeId(e.target.value)}
            >
              {types.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="eyebrow">Title (optional)</span>
            <input
              className="bg-paper border border-line-strong text-ink placeholder-muted rounded-md px-2.5 py-1.5 outline-none focus:border-accent transition-colors"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={selectedType?.name}
            />
          </label>

          {error && <div className="text-danger text-xs">{error}</div>}

          <div className="flex justify-end gap-2 mt-1">
            <button
              className="px-3 py-1.5 rounded-md border border-line-strong text-ink-soft hover:bg-paper transition-colors"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              className="px-3 py-1.5 rounded-md bg-ink text-paper font-medium hover:bg-black disabled:opacity-50 transition-colors"
              onClick={submit}
              disabled={busy}
            >
              Create
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
