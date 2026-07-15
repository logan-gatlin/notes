import { Modal } from "./Modal";

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel?: string;
  /** Style the confirm button as a destructive action. */
  destructive?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel = "Confirm",
  destructive = false,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  return (
    <Modal title={title} onClose={onClose}>
      <div className="flex flex-col gap-4 text-sm">
        <p className="text-gray-300">{message}</p>
        <div className="flex justify-end gap-2">
          <button
            className="px-3 py-1.5 rounded border border-gray-700 text-gray-200 hover:bg-gray-700"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className={
              "px-3 py-1.5 rounded text-white " +
              (destructive
                ? "bg-red-600 hover:bg-red-500"
                : "bg-emerald-600 hover:bg-emerald-500")
            }
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}
