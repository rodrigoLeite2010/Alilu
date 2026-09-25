"use client";

import { useEffect, useId, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";

type PromptState = "asking" | "form" | "thanks" | "hidden";

const STORAGE_KEY = "alilu.suggestionPrompt.dismissed";

async function readError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: unknown };
    return typeof body.error === "string" ? body.error : "Não foi possível enviar sua sugestão.";
  } catch {
    return "Não foi possível enviar sua sugestão.";
  }
}

export function SuggestionPrompt() {
  const textareaId = useId();
  const [state, setState] = useState<PromptState>("hidden");
  const [message, setMessage] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (window.sessionStorage.getItem(STORAGE_KEY) === "1") return;
    const timer = window.setTimeout(() => setState("asking"), 900);
    return () => window.clearTimeout(timer);
  }, []);

  function dismiss() {
    window.sessionStorage.setItem(STORAGE_KEY, "1");
    setState("hidden");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatusMessage(null);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, pagePath: window.location.pathname }),
      });
      if (!response.ok) {
        throw new Error(await readError(response));
      }
      setMessage("");
      setState("thanks");
      window.sessionStorage.setItem(STORAGE_KEY, "1");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Não foi possível enviar sua sugestão.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (state === "hidden") return null;

  return (
    <aside className="fixed bottom-4 right-4 z-40 w-[calc(100vw-2rem)] max-w-sm rounded-lg border border-zinc-200 bg-white p-4 shadow-lg print:hidden">
      {state === "asking" ? (
        <div className="space-y-3">
          <div>
            <p className="text-sm font-semibold text-zinc-900">Achou o que procura?</p>
            <p className="mt-1 text-sm text-zinc-600">
              Se faltar alguma ferramenta, me fala que desenvolvemos em instantes.
            </p>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" className="h-9 px-3 text-xs" onClick={dismiss}>
              Sim
            </Button>
            <Button type="button" className="h-9 px-3 text-xs" onClick={() => setState("form")}>
              Não
            </Button>
          </div>
        </div>
      ) : null}

      {state === "form" ? (
        <form onSubmit={(event) => void handleSubmit(event)} className="space-y-3">
          <div>
            <label htmlFor={textareaId} className="text-sm font-semibold text-zinc-900">
              Qual ferramenta você gostaria?
            </label>
            <p className="mt-1 text-xs text-zinc-500">Me fala que desenvolvemos em instantes.</p>
          </div>
          <textarea
            id={textareaId}
            required
            minLength={3}
            maxLength={1200}
            rows={4}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Ex.: conversor de imagem para WebP, calculadora de..."
            className="w-full resize-y rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
          />
          {statusMessage ? (
            <p role="alert" className="text-xs text-red-600">
              {statusMessage}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={isSubmitting} className="h-9 px-3 text-xs">
              {isSubmitting ? "Enviando..." : "Enviar sugestão"}
            </Button>
            <Button type="button" variant="ghost" className="h-9 px-3 text-xs" onClick={dismiss}>
              Agora não
            </Button>
          </div>
        </form>
      ) : null}

      {state === "thanks" ? (
        <div className="space-y-3">
          <p role="status" className="text-sm font-semibold text-teal-800">
            Sugestão recebida. Obrigado!
          </p>
          <Button type="button" variant="secondary" className="h-9 px-3 text-xs" onClick={() => setState("hidden")}>
            Fechar
          </Button>
        </div>
      ) : null}
    </aside>
  );
}
