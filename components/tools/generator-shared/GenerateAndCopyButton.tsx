"use client";

import type { ButtonHTMLAttributes } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import type { CopyFeedback } from "./useGenerateAndCopy";

/**
 * Botão principal dos geradores: GERAR + COPIAR em um clique. Largura total no
 * celular (alvo de toque grande), automática no desktop. Troca o rótulo para
 * "Copiado" por instantes quando a cópia deu certo.
 */
export function GenerateAndCopyButton({
  label,
  copied = false,
  className = "",
  ...rest
}: {
  label: string;
  copied?: boolean;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children">) {
  return (
    <Button type="submit" className={`min-h-12 w-full sm:w-auto ${className}`} {...rest}>
      <Icon name={copied ? "check" : "copy"} className="h-4 w-4" aria-hidden />
      {copied ? "Copiado" : label}
    </Button>
  );
}

/**
 * Mensagem de feedback. A região `aria-live` fica SEMPRE no DOM (vazia quando
 * não há mensagem) para leitores de tela anunciarem a mudança de texto.
 */
export function CopyFeedbackMessage({ feedback, className = "" }: { feedback: CopyFeedback; className?: string }) {
  return (
    <p
      role="status"
      aria-live="polite"
      className={`min-h-5 text-sm ${feedback ? (feedback.ok ? "font-medium text-emerald-700" : "font-medium text-amber-700") : ""} ${className}`}
    >
      {feedback ? `${feedback.ok ? "✓ " : "⚠ "}${feedback.message}` : ""}
    </p>
  );
}
