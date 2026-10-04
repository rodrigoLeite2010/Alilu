"use client";

import { useState } from "react";

/**
 * Botão "Conectar Instagram": link normal (redirect, sem popup — funciona
 * em qualquer navegador do celular). Mostra "Abrindo o Instagram…" depois
 * do toque para a pessoa não tocar de novo enquanto a Meta carrega.
 */
export function ConnectInstagramLink({
  returnTo,
  label = "Conectar Instagram",
  className = "flex h-11 items-center justify-center rounded-md bg-zinc-900 px-4 text-sm font-medium text-white transition-colors hover:bg-zinc-800",
}: {
  returnTo?: string | null;
  label?: string;
  className?: string;
}) {
  const [opening, setOpening] = useState(false);
  const href = returnTo ? `/api/instagram/oauth/start?returnTo=${encodeURIComponent(returnTo)}` : "/api/instagram/oauth/start";
  return (
    <a
      href={href}
      onClick={() => setOpening(true)}
      aria-busy={opening}
      className={`${className} ${opening ? "pointer-events-none opacity-70" : ""}`}
    >
      {opening ? "Abrindo o Instagram…" : label}
    </a>
  );
}
