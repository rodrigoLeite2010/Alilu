"use client";

import { useState } from "react";
import { Check, Copy, Pencil } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { copyTextToClipboard } from "@/lib/instagram/captions/clipboard";
import type { GeneratedCaption } from "@/lib/instagram/captions/types";

const INSTAGRAM_CAPTION_LIMIT = 2200;

/**
 * Card de uma legenda gerada (ETAPA 11): texto, botão de copiar, botão de
 * editar e contador de caracteres. O estado do texto é local a cada card
 * (o componente pai usa `key={caption.id}`, que muda a cada nova geração),
 * então editar uma legenda nunca afeta as outras.
 */
export function CaptionResultCard({ caption, index }: { caption: GeneratedCaption; index: number }) {
  const [text, setText] = useState(caption.text);
  const [isEditing, setIsEditing] = useState(false);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");

  async function handleCopy() {
    const succeeded = await copyTextToClipboard(text);
    setCopyState(succeeded ? "copied" : "error");
    setTimeout(() => setCopyState("idle"), 2000);
  }

  const textareaId = `instagram-caption-result-${caption.id}`;

  return (
    <div className="space-y-3 rounded-lg border border-zinc-200 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-zinc-700">Opção {index + 1}</p>
        <p className="text-xs text-zinc-500">
          {text.length} caracteres / {INSTAGRAM_CAPTION_LIMIT}
        </p>
      </div>

      {isEditing ? (
        <>
          <label htmlFor={textareaId} className="sr-only">
            Editar opção {index + 1}
          </label>
          <textarea
            id={textareaId}
            value={text}
            onChange={(event) => setText(event.target.value)}
            rows={8}
            className="w-full rounded-lg border border-zinc-300 bg-white p-3 text-sm text-zinc-900 focus:border-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-700/20"
          />
        </>
      ) : (
        <p className="whitespace-pre-wrap rounded-lg bg-zinc-50 p-3 text-sm text-zinc-800">{text}</p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="secondary" onClick={() => setIsEditing((prev) => !prev)}>
          <Pencil className="h-4 w-4" aria-hidden />
          {isEditing ? "Concluir edição" : "Editar"}
        </Button>
        <Button type="button" onClick={handleCopy}>
          {copyState === "copied" ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
          {copyState === "copied" ? "Copiado!" : "Copiar"}
        </Button>
        {copyState === "error" ? (
          <span role="alert" className="text-xs text-red-600">
            Não foi possível copiar automaticamente. Selecione o texto manualmente.
          </span>
        ) : null}
      </div>
    </div>
  );
}
