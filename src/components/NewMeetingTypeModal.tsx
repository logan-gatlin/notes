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
      <div className="flex flex-col gap-4 text-sm">
        <label className="flex flex-col gap-1.5">
          <span className="eyebrow">Name</span>
          <input
            className="bg-paper border border-line-strong text-ink placeholder-muted rounded-md px-2.5 py-1.5 outline-none focus:border-accent transition-colors"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Weekly Sync"
            autoFocus
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
    </Modal>
  );
}
