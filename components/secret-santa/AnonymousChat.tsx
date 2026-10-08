"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { call, inputClass } from "./api";

interface Msg {
  id: string;
  mine: boolean;
  body: string;
  createdAt: string;
}
interface Side {
  messages: Msg[];
  canWrite: boolean;
}
interface Conversation {
  enabled: boolean;
  asGiver?: Side | null;
  asReceiver?: Side | null;
}

const QUICK_QUESTIONS = ["Qual é a sua cor favorita?", "Que tamanho você usa?", "Tem algo que você NÃO gostaria de ganhar?"];

/**
 * Conversa anônima. O servidor só devolve { id, mine, body, createdAt }: o rótulo da outra ponta é fixo
 * (nenhuma identidade chega ao navegador). Atualiza a cada 30 s (não há tempo real no Alilu).
 */
export function AnonymousChat({ groupId, as, friendName }: { groupId: string; as: "GIVER" | "RECEIVER"; friendName?: string }) {
  const [side, setSide] = useState<Side | null>(null);
  const [enabled, setEnabled] = useState(true);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    const result = await call<Conversation>("GET", `/api/secret-santa/groups/${groupId}/conversation`);
    if (!result.data) return;
    setEnabled(result.data.enabled);
    setSide((as === "GIVER" ? result.data.asGiver : result.data.asReceiver) ?? null);
  }, [groupId, as]);

  useEffect(() => {
    const first = setTimeout(() => void refresh(), 0);
    const timer = setInterval(() => void refresh(), 30_000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [refresh]);

  useEffect(() => {
    bottom.current?.scrollIntoView?.({ block: "nearest" });
  }, [side?.messages.length]);

  async function send() {
    if (!text.trim() || busy) return;
    setBusy(true);
    setError(null);
    const result = await call("POST", `/api/secret-santa/groups/${groupId}/conversation`, { as, body: text });
    setBusy(false);
    if (result.error) return setError(result.error);
    setText("");
    await refresh();
  }

  if (!enabled) return <p className="text-sm text-zinc-500">As mensagens anônimas estão desativadas neste grupo.</p>;
  const other = as === "GIVER" ? friendName ?? "seu amigo sorteado" : "Seu amigo secreto";

  return (
    <div className="space-y-3">
      {as === "RECEIVER" && (side?.messages.length ?? 0) === 0 ? (
        <p className="text-sm text-zinc-600">Seu amigo secreto pode entrar em contato anonimamente com você.</p>
      ) : null}
      <ul className="max-h-72 space-y-2 overflow-y-auto" aria-label="Mensagens" aria-live="polite">
        {side?.messages.map((m) => (
          <li key={m.id} className={`flex ${m.mine ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${m.mine ? "bg-rose-700 text-white" : "bg-zinc-100 text-zinc-900"}`}>
              <p className={`text-[11px] font-semibold ${m.mine ? "text-rose-100" : "text-zinc-500"}`}>{m.mine ? "Você" : other}</p>
              <p className="whitespace-pre-wrap break-words">{m.body}</p>
            </div>
          </li>
        ))}
        <div ref={bottom} />
      </ul>
      {side?.canWrite ? (
        <div className="space-y-2">
          {as === "GIVER" ? (
            <div className="flex flex-wrap gap-2">
              {QUICK_QUESTIONS.map((q) => (
                <button key={q} type="button" onClick={() => setText(q)} className="min-h-9 rounded-full border border-zinc-300 px-3 text-xs text-zinc-700">
                  {q}
                </button>
              ))}
            </div>
          ) : null}
          <label className="block text-sm font-medium text-zinc-800">
            {as === "GIVER" ? "Mensagem anônima" : "Responder ao seu amigo secreto"}
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} maxLength={1000} className={inputClass} />
          </label>
          {error ? (
            <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}
          <Button type="button" onClick={send} disabled={busy || !text.trim()}>
            Enviar
          </Button>
        </div>
      ) : (
        <p className="text-xs text-zinc-500">Você poderá responder quando seu amigo secreto escrever.</p>
      )}
    </div>
  );
}
