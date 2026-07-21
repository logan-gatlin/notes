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
      <div className="flex flex-col gap-5 text-sm">
        <p className="text-ink-soft leading-relaxed">{message}</p>
        <div className="flex justify-end gap-2">
          <button
            className="px-3 py-1.5 rounded-md border border-line-strong text-ink-soft hover:bg-paper transition-colors"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className={
              "px-3 py-1.5 rounded-md font-medium text-paper transition-colors " +
              (destructive
                ? "bg-danger hover:brightness-110"
                : "bg-ink hover:bg-black")
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
