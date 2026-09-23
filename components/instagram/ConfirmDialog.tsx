"use client";

import { Button } from "@/components/ui/Button";
import { Dialog } from "./Dialog";

/** Confirmação com texto e botões explícitos (substitui window.confirm). */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancelar",
  destructive = false,
  busy = false,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog
      open={open}
      title={title}
      onClose={busy ? () => undefined : onClose}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={destructive ? "bg-red-600 hover:bg-red-700 active:bg-red-800" : ""}
          >
            {busy ? "Aguarde…" : confirmLabel}
          </Button>
        </>
      }
    >
      {description ? <p className="text-sm text-zinc-600">{description}</p> : null}
    </Dialog>
  );
}
