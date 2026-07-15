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
        <div className="text-sm text-gray-300">
          Create a meeting type first.
        </div>
      ) : (
        <div className="flex flex-col gap-3 text-sm">
          <label className="flex flex-col gap-1">
            <span className="text-gray-400">Meeting type</span>
            <select
              className="bg-gray-900 border border-gray-700 text-gray-100 rounded px-2 py-1 outline-none focus:border-emerald-500"
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

          <label className="flex flex-col gap-1">
            <span className="text-gray-400">Title (optional)</span>
            <input
              className="bg-gray-900 border border-gray-700 text-gray-100 placeholder-gray-500 rounded px-2 py-1 outline-none focus:border-emerald-500"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={selectedType?.name}
            />
          </label>

          {error && <div className="text-red-400 text-xs">{error}</div>}

          <div className="flex justify-end gap-2 mt-1">
            <button
              className="px-3 py-1.5 rounded border border-gray-700 text-gray-200 hover:bg-gray-700"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              className="px-3 py-1.5 rounded bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-50"
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
