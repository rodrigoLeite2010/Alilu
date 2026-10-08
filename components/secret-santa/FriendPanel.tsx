"use client";

import { useCallback, useEffect, useState } from "react";
import { Gift } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { QuickForm } from "@/components/mesada/QuickForm";
import { formatCents, parseMoneyToCents } from "@/lib/allowance/money";
import { AnonymousChat } from "./AnonymousChat";
import { budgetLabel, call, cardClass } from "./api";

interface Wish {
  id: string;
  title: string;
  description: string | null;
  url: string | null;
  estimatedPriceCents: number | null;
  priority: number;
  purchased?: boolean;
}
interface Assignment {
  drawn: boolean;
  friend?: { name: string };
  wishes?: Wish[];
  preferences?: Record<string, string | null> | null;
  gift?: { name: string; priceCents: number | null; notes: string | null; purchased: boolean } | null;
  messages?: { enabled: boolean; unread: number; started: boolean };
  budget?: { minCents: number | null; maxCents: number | null };
}

const PREF_LABELS: Array<[string, string]> = [
  ["clothingSize", "Tamanho de roupa"],
  ["shoeSize", "Calçado"],
  ["favoriteColors", "Cores favoritas"],
  ["likes", "Gosta de"],
  ["avoid", "Prefere evitar"],
  ["notes", "Observações"],
];
const PRIORITY = ["", "Quero muito", "Legal ganhar", "Se sobrar"];

/** "Quem eu tirei": só a pessoa que o usuário autenticado tirou — o servidor nunca manda mais que isso. */
export function FriendPanel({ groupId, onChanged }: { groupId: string; onChanged: () => void }) {
  const [data, setData] = useState<Assignment | null>(null);
  const [giftOpen, setGiftOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);

  const load = useCallback(async () => {
    const result = await call<Assignment>("GET", `/api/secret-santa/groups/${groupId}/my-assignment`);
    if (result.data) setData(result.data);
  }, [groupId]);
  useEffect(() => {
    const t = setTimeout(() => void load(), 0);
    return () => clearTimeout(t);
  }, [load]);

  if (!data) return <p className="text-sm text-zinc-500">Carregando…</p>;
  if (!data.drawn || !data.friend) return <p className="text-sm text-zinc-600">O sorteio ainda não foi realizado.</p>;
  const budget = budgetLabel(data.budget?.minCents ?? null, data.budget?.maxCents ?? null);
  const prefs = PREF_LABELS.filter(([key]) => data.preferences?.[key]);

  async function togglePurchased(w: Wish) {
    await call("PATCH", `/api/secret-santa/groups/${groupId}/wishlist/${w.id}`, { purchased: !w.purchased });
    await load();
  }

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-rose-200 bg-rose-50 p-5 text-center">
        <Gift className="mx-auto h-7 w-7 text-rose-700" aria-hidden />
        <p className="mt-2 text-sm text-zinc-600">Você tirou</p>
        <p className="text-2xl font-bold text-zinc-900">{data.friend.name}</p>
        {budget ? <p className="mt-1 text-sm text-zinc-600">Valor do presente: {budget}</p> : null}
        <p className="mt-2 text-xs text-zinc-500">Segredo! Só você vê isso.</p>
      </section>

      <section className={cardClass}>
        <h3 className="font-semibold text-zinc-900">Desejos de {data.friend.name}</h3>
        {data.wishes && data.wishes.length > 0 ? (
          <ul className="mt-2 divide-y divide-zinc-100">
            {data.wishes.map((w) => (
              <li key={w.id} className="flex items-start justify-between gap-3 py-2 text-sm">
                <div className="min-w-0">
                  <p className={`font-medium ${w.purchased ? "text-zinc-400 line-through" : "text-zinc-900"}`}>{w.title}</p>
                  <p className="text-xs text-zinc-500">
                    {PRIORITY[w.priority]}
                    {w.estimatedPriceCents !== null ? ` · ~${formatCents(w.estimatedPriceCents)}` : ""}
                  </p>
                  {w.description ? <p className="text-xs text-zinc-600">{w.description}</p> : null}
                  {w.url ? (
                    <a href={w.url} target="_blank" rel="noopener noreferrer nofollow" className="break-all text-xs text-rose-800 underline">
                      Ver link
                    </a>
                  ) : null}
                </div>
                <button type="button" onClick={() => togglePurchased(w)} className="min-h-10 shrink-0 px-2 text-xs font-semibold text-rose-800 underline">
                  {w.purchased ? "Desmarcar" : "Já comprei"}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-sm text-zinc-500">Ainda sem desejos. Mande uma mensagem anônima perguntando! 😉</p>
        )}
        {prefs.length > 0 ? (
          <dl className="mt-3 grid gap-x-4 gap-y-1 border-t border-zinc-100 pt-3 text-sm sm:grid-cols-2">
            {prefs.map(([key, label]) => (
              <div key={key}>
                <dt className="text-xs text-zinc-500">{label}</dt>
                <dd className="text-zinc-900">{data.preferences?.[key]}</dd>
              </div>
            ))}
          </dl>
        ) : null}
      </section>

      <section className={cardClass}>
        <h3 className="font-semibold text-zinc-900">Meu presente</h3>
        {data.gift ? (
          <p className="mt-1 text-sm text-zinc-700">
            {data.gift.name}
            {data.gift.priceCents !== null ? ` · ${formatCents(data.gift.priceCents)}` : ""} — {data.gift.purchased ? "comprado ✅" : "escolhido"}
          </p>
        ) : (
          <p className="mt-1 text-sm text-zinc-500">Ninguém além de você vê o que você escolheu.</p>
        )}
        <Button type="button" variant="secondary" className="mt-2" onClick={() => setGiftOpen(true)}>
          {data.gift ? "Editar presente" : "Marcar presente escolhido"}
        </Button>
        <QuickForm
          open={giftOpen}
          title="Presente escolhido"
          submitLabel="Salvar"
          onClose={() => setGiftOpen(false)}
          fields={[
            { name: "name", label: "Qual presente?", type: "text", required: true, defaultValue: data.gift?.name ?? "", maxLength: 120 },
            { name: "price", label: "Valor (R$)", type: "money", defaultValue: data.gift?.priceCents ? String(data.gift.priceCents / 100).replace(".", ",") : "" },
            { name: "notes", label: "Anotações", type: "text", defaultValue: data.gift?.notes ?? "", maxLength: 500 },
            { name: "purchased", label: "Já comprei", type: "checkbox", defaultValue: data.gift?.purchased ?? false },
          ]}
          onSubmit={async (v) => {
            const priceText = String(v.price ?? "").trim();
            const result = await call("PUT", `/api/secret-santa/groups/${groupId}/gift`, {
              name: v.name,
              priceCents: priceText ? parseMoneyToCents(priceText) : null,
              notes: v.notes || null,
              purchased: v.purchased === true,
            });
            if (result.error) return result.error;
            await load();
            onChanged();
            return null;
          }}
        />
      </section>

      {data.messages?.enabled ? (
        <section className={cardClass}>
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-semibold text-zinc-900">Mensagem anônima</h3>
            <Button type="button" variant="secondary" onClick={() => setChatOpen((v) => !v)}>
              {chatOpen ? "Fechar" : data.messages.unread ? `Abrir (${data.messages.unread} nova)` : "Enviar mensagem"}
            </Button>
          </div>
          <p className="mt-1 text-xs text-zinc-500">{data.friend.name} não sabe quem você é.</p>
          {chatOpen ? (
            <div className="mt-3">
              <AnonymousChat groupId={groupId} as="GIVER" friendName={data.friend.name} />
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
