"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { SITE_URL } from "@/lib/seo/site";

const TOOL_PATH = "/utilitarios/empresa/gerador-recibo";
const TOOL_URL =`${SITE_URL}${TOOL_PATH}`;

type ShareState = "idle" | "copied" | "error";

/**
 * Ações da prévia do recibo: imprimir/salvar PDF (via window.print() nativo
 * do navegador), gerar um novo recibo e compartilhar. O compartilhamento
 * nunca inclui dados do recibo — apenas o link público da própria
 * ferramenta (ETAPA 2, seção 12).
 */
export function ReceiptActions({ onReset }: { onReset: () => void }) {
  const [shareState, setShareState] = useState<ShareState>("idle");

  async function handleShare() {
    const shareData = {
      title: "Gerador de Recibo Online Grátis | Alilu Utilitários",
      text: "Crie recibos online grátis, sem cadastro, com o Alilu Utilitários.",
      url: TOOL_URL,
    };

    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share(shareData);
      } catch {
        // Usuário cancelou o compartilhamento nativo — nada a fazer.
      }
      return;
    }

    try {
      await navigator.clipboard.writeText(TOOL_URL);
      setShareState("copied");
      setTimeout(() => setShareState("idle"), 2500);
    } catch {
      setShareState("error");
    }
  }

  return (
    <div className="mt-6 flex flex-wrap items-center gap-3 print:hidden">
      <Button type="button" onClick={() => window.print()}>
        Imprimir / Salvar PDF
      </Button>
      <Button type="button" variant="secondary" onClick={onReset}>
        Novo recibo
      </Button>
      <Button type="button" variant="ghost" onClick={handleShare}>
        Compartilhar
      </Button>
      {shareState === "copied" ? (
        <span role="status" className="text-sm text-emerald-600">
          Link da ferramenta copiado!
        </span>
      ) : null}
      {shareState === "error" ? (
        <span role="status" className="text-sm text-zinc-600">
          Não foi possível copiar automaticamente. Link: {TOOL_URL}
        </span>
      ) : null}
    </div>
  );
}
