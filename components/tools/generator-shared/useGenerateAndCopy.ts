"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { copyTextToClipboard } from "@/lib/client/clipboard";

/** Quanto tempo o feedback fica visível (1,5 a 2,5 s). */
export const COPY_FEEDBACK_MS = 2200;

export type CopyFeedback = { key: string; ok: boolean; message: string } | null;

export interface CopyOptions {
  /** Identifica de onde veio a cópia (ex.: "generate", "single", "row-3", "all"). */
  key: string;
  successMessage: string;
  failureMessage: string;
}

/**
 * Cópia com feedback para os geradores.
 *
 * REGRA: `copy` recebe sempre o TEXTO já calculado (variável local), nunca lê
 * state. Assim "Gerar e copiar" copia o valor novo, não o anterior que ainda
 * estaria no state antes do re-render:
 *
 *   const generated = generateCpfBatch(input);
 *   setResults(generated);
 *   void copy(generated.join("\n"), {...});
 *
 * `copy` deve ser chamado de forma síncrona dentro do handler de clique (sem
 * `await` antes), para o navegador manter o gesto do usuário e liberar a
 * Clipboard API também no celular.
 */
export function useGenerateAndCopy() {
  const [feedback, setFeedback] = useState<CopyFeedback>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };

  useEffect(() => clearTimer, []);

  const clear = useCallback(() => {
    clearTimer();
    setFeedback(null);
  }, []);

  const copy = useCallback(async (text: string, options: CopyOptions): Promise<boolean> => {
    const ok = await copyTextToClipboard(text);
    clearTimer();
    setFeedback({ key: options.key, ok, message: ok ? options.successMessage : options.failureMessage });
    timer.current = setTimeout(() => setFeedback(null), COPY_FEEDBACK_MS);
    return ok;
  }, []);

  return { feedback, copy, clear };
}
