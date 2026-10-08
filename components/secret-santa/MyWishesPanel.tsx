"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { QuickForm } from "@/components/mesada/QuickForm";
import { formatCents, parseMoneyToCents } from "@/lib/allowance/money";
import { call, cardClass } from "./api";
import { AnonymousChat } from "./AnonymousChat";

interface Wish {
  id: string;
  title: string;
  description: string | null;
  url: string | null;
  estimatedPriceCents: number | null;
  priority: number;
  publicToGroup: boolean;
}
interface Wishlist {
  enabled: { wishes: boolean; preferences: boolean };
  mine: Wish[];
  publicWishes: Array<Wish & { ownerName: string }>;
  preferences: Record<string, string | null> | null;
}

/** Meus desejos e preferências + conversa com "Seu amigo secreto" (quem me tirou continua anônimo). */
export function MyWishesPanel({ groupId, drawn, messagesEnabled }: { groupId: string; drawn: boolean; messagesEnabled: boolean }) {
  const [data, setData] = useState<Wishlist | null>(null);
  const [wishForm, setWishForm] = useState<Wish | "new" | null>(null);
  const [prefsOpen, setPrefsOpen] = useState(false);

  const load = useCallback(async () => {
    const r = await call<Wishlist>("GET", `/api/secret-santa/groups/${groupId}/wishlist`);
    if (r.data) setData(r.data);
  }, [groupId]);
  useEffect(() => {
    const t = setTimeout(() => void load(), 0);
    return () => clearTimeout(t);
  }, [load]);

  if (!data) return <p className="text-sm text-zinc-500">Carregando…</p>;
  const editing = wishForm && wishForm !== "new" ? wishForm : null;

  return (
    <div className="space-y-4">
      {drawn && messagesEnabled ? (
        <section className={cardClass}>
          <h3 className="font-semibold text-zinc-900">Seu amigo secreto</h3>
          <div className="mt-2">
            <AnonymousChat groupId={groupId} as="RECEIVER" />
          </div>
        </section>
      ) : null}

      {data.enabled.wishes ? (
        <section className={cardClass}>
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-semibold text-zinc-900">Meus desejos</h3>
            <Button type="button" variant="secondary" onClick={() => setWishForm("new")}>
              + Desejo
            </Button>
          </div>
          <p className="mt-1 text-xs text-zinc-500">Só quem tirou você vê (a menos que você marque como público).</p>
          {data.mine.length === 0 ? (
            <p className="mt-2 text-sm text-zinc-500">Adicione ideias para ajudar seu amigo secreto.</p>
          ) : (
            <ul className="mt-2 divide-y divide-zinc-100">
              {data.mine.map((w) => (
                <li key={w.id} className="flex items-start justify-between gap-3 py-2 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium text-zinc-900">{w.title}</p>
                    <p className="text-xs text-zinc-500">
                      {w.estimatedPriceCents !== null ? `~${formatCents(w.estimatedPriceCents)}` : ""}
                      {w.publicToGroup ? " · público no grupo" : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button type="button" className="min-h-10 px-2 text-xs font-semibold text-rose-800 underline" onClick={() => setWishForm(w)}>
                      Editar
                    </button>
                    <button
                      type="button"
                      className="min-h-10 px-2 text-xs font-semibold text-red-700 underline"
                      onClick={async () => {
                        await call("DELETE", `/api/secret-santa/groups/${groupId}/wishlist/${w.id}`);
                        await load();
                      }}
                    >
                      Excluir
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {data.enabled.preferences ? (
        <section className={cardClass}>
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-semibold text-zinc-900">Minhas preferências</h3>
            <Button type="button" variant="secondary" onClick={() => setPrefsOpen(true)}>
              Editar
            </Button>
          </div>
          <p className="mt-1 text-sm text-zinc-600">
            {data.preferences ? [data.preferences.clothingSize, data.preferences.favoriteColors, data.preferences.likes].filter(Boolean).join(" · ") || "Preenchidas." : "Tamanhos, cores, o que você gosta e o que evitar."}
          </p>
        </section>
      ) : null}

      {data.publicWishes.length > 0 ? (
        <section className={cardClass}>
          <h3 className="font-semibold text-zinc-900">Desejos públicos do grupo</h3>
          <ul className="mt-2 space-y-1 text-sm">
            {data.publicWishes.map((w) => (
              <li key={w.id}>
                <span className="font-medium">{w.ownerName}:</span> {w.title}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <QuickForm
        key={editing?.id ?? "new"}
        open={wishForm !== null}
        title={editing ? "Editar desejo" : "Novo desejo"}
        submitLabel="Salvar"
        onClose={() => setWishForm(null)}
        fields={[
          { name: "title", label: "O que você quer?", type: "text", required: true, defaultValue: editing?.title ?? "", maxLength: 120 },
          { name: "price", label: "Preço aproximado (R$)", type: "money", defaultValue: editing?.estimatedPriceCents ? String(editing.estimatedPriceCents / 100).replace(".", ",") : "" },
          { name: "url", label: "Link (opcional)", type: "text", defaultValue: editing?.url ?? "", maxLength: 500 },
          { name: "description", label: "Detalhes (opcional)", type: "text", defaultValue: editing?.description ?? "", maxLength: 500 },
          {
            name: "priority",
            label: "Prioridade",
            type: "select",
            defaultValue: String(editing?.priority ?? 2),
            options: [
              { value: "1", label: "Quero muito" },
              { value: "2", label: "Legal ganhar" },
              { value: "3", label: "Se sobrar" },
            ],
          },
          { name: "publicToGroup", label: "Mostrar para todo o grupo", type: "checkbox", defaultValue: editing?.publicToGroup ?? false },
        ]}
        onSubmit={async (v) => {
          const priceText = String(v.price ?? "").trim();
          const payload = {
            title: v.title,
            description: v.description || null,
            url: v.url || null,
            estimatedPriceCents: priceText ? parseMoneyToCents(priceText) : null,
            priority: Number(v.priority),
            publicToGroup: v.publicToGroup === true,
          };
          const result = editing
            ? await call("PATCH", `/api/secret-santa/groups/${groupId}/wishlist/${editing.id}`, payload)
            : await call("POST", `/api/secret-santa/groups/${groupId}/wishlist`, payload);
          if (result.error) return result.error;
          await load();
          return null;
        }}
      />
      <QuickForm
        open={prefsOpen}
        title="Minhas preferências"
        submitLabel="Salvar"
        onClose={() => setPrefsOpen(false)}
        fields={[
          { name: "clothingSize", label: "Tamanho de roupa", type: "text", defaultValue: data.preferences?.clothingSize ?? "", maxLength: 30 },
          { name: "shoeSize", label: "Número do calçado", type: "text", defaultValue: data.preferences?.shoeSize ?? "", maxLength: 30 },
          { name: "favoriteColors", label: "Cores favoritas", type: "text", defaultValue: data.preferences?.favoriteColors ?? "", maxLength: 200 },
          { name: "likes", label: "Gosto de", type: "text", defaultValue: data.preferences?.likes ?? "", maxLength: 500 },
          { name: "avoid", label: "Prefiro evitar", type: "text", defaultValue: data.preferences?.avoid ?? "", maxLength: 500 },
          { name: "notes", label: "Observações", type: "text", defaultValue: data.preferences?.notes ?? "", maxLength: 500 },
        ]}
        onSubmit={async (v) => {
          const result = await call("PUT", `/api/secret-santa/groups/${groupId}/wishlist`, v);
          if (result.error) return result.error;
          await load();
          return null;
        }}
      />
    </div>
  );
}
