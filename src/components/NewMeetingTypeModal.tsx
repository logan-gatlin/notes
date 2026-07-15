import { useState } from "react";
import { Modal } from "./Modal";
import { useMeetingTypesStore } from "../state/meetingTypesStore";

interface Props {
  onClose: () => void;
}

export function NewMeetingTypeModal({ onClose }: Props) {
  const create = useMeetingTypesStore((s) => s.create);

  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await create({ name: name.trim() });
      onClose();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="New Meeting Type" onClose={onClose}>
      <div className="flex flex-col gap-3 text-sm">
        <label className="flex flex-col gap-1">
          <span className="text-gray-400">Name</span>
          <input
            className="bg-gray-900 border border-gray-700 text-gray-100 placeholder-gray-500 rounded px-2 py-1 outline-none focus:border-emerald-500"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Weekly Sync"
            autoFocus
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
    </Modal>
  );
}
