"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/instagram/ConfirmDialog";

/**
 * "Desconectar Instagram" com confirmação. Com `accountId`, desconecta só
 * aquela conta (multi-conta); sem, desconecta todas.
 */
export function DisconnectInstagramButton({ accountId, username }: { accountId?: string; username?: string | null } = {}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function disconnect() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(
        accountId ? `/api/instagram/account?accountId=${encodeURIComponent(accountId)}` : "/api/instagram/account",
        { method: "DELETE" },
      );
      if (!response.ok) throw new Error();
      setOpen(false);
      router.refresh();
    } catch {
      setError("Não foi possível desconectar agora. Tente de novo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="text-sm font-medium text-red-700 underline">
        {accountId ? "Desconectar" : "Desconectar Instagram"}
      </button>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <ConfirmDialog
        open={open}
        title={username ? `Desconectar @${username}?` : "Desconectar o Instagram?"}
        description="O Alilu deixa de publicar nessa conta (agendamentos e piloto automático ficam pausados até você conectar de novo). Suas publicações salvas não são apagadas."
        confirmLabel="Desconectar"
        destructive
        busy={busy}
        onConfirm={disconnect}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
