"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * "Usar como principal" (multi-conta): define em qual conta publicam as telas
 * que ainda usam uma conta só (calendário, Posts Virais, Reels). O Piloto
 * Automático não depende disso — cada automação tem a sua conta.
 */
export function MakePrimaryAccountButton({ accountId }: { accountId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function makePrimary() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/instagram/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId }),
      });
      if (!response.ok) throw new Error();
      router.refresh();
    } catch {
      setError("Não foi possível trocar agora.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" onClick={makePrimary} disabled={busy} className="text-sm font-medium text-teal-800 underline disabled:opacity-60">
        {busy ? "Trocando…" : "Usar como principal"}
      </button>
      {error ? <span className="text-xs text-red-700">{error}</span> : null}
    </>
  );
}
