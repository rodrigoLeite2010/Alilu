"use client";

import { useState } from "react";

/** Botão "Enviar e-mail de teste" (vai para o e-mail do próprio admin logado). */
export function EmailAdminTestButton() {
  const [state, setState] = useState<{ busy: boolean; message: string | null; ok: boolean }>({ busy: false, message: null, ok: false });
  const send = async () => {
    setState({ busy: true, message: null, ok: false });
    try {
      const response = await fetch("/api/admin/emails", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "test" }) });
      const body = (await response.json().catch(() => ({}))) as { error?: string; to?: string };
      setState(response.ok ? { busy: false, ok: true, message: `Enviado para ${body.to}. Confira a caixa de entrada (e o spam).` } : { busy: false, ok: false, message: body.error ?? "Falha ao enviar." });
    } catch {
      setState({ busy: false, ok: false, message: "Falha de conexão." });
    }
  };
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={() => void send()}
        disabled={state.busy}
        className="rounded-md bg-[var(--brand-primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
      >
        {state.busy ? "Enviando…" : "Enviar e-mail de teste"}
      </button>
      {state.message ? <p className={`text-sm ${state.ok ? "text-green-700" : "text-red-700"}`}>{state.message}</p> : null}
    </div>
  );
}
