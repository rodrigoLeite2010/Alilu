"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { QuickForm } from "@/components/mesada/QuickForm";
import { parseMoneyToCents } from "@/lib/allowance/money";
import { call, cardClass } from "./api";
import { RestrictionsEditor, type PersonLite, type RestrictionLite } from "./RestrictionsEditor";
import { ShareButtons } from "./ShareButtons";
import type { GroupViewData } from "./GroupView";

type Preview = { canDraw: boolean; acceptedCount: number; pendingCount: number; needsPendingConfirmation: boolean; message: string | null; redraw: boolean; summary: string };

/** Painel do organizador. Toda checagem de permissão é do servidor; aqui só há a interface. */
export function OrganizerPanel({ view, onChanged }: { view: GroupViewData; onChanged: () => void }) {
  const router = useRouter();
  const g = view.group;
  const id = g.id;
  const preview = view.drawPreview as Preview | undefined;
  const people = view.participants as Array<PersonLite & { isOrganizer: boolean; email?: string | null; inviteToken?: string | null }>;
  const open = g.status === "OPEN" || g.status === "READY_TO_DRAW";
  const [addOpen, setAddOpen] = useState(false);
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [dupOpen, setDupOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmPending, setConfirmPending] = useState(false);
  const [results, setResults] = useState<Array<{ giverName: string; receiverName: string }> | null>(null);

  async function act<T>(label: string, fn: () => Promise<{ data?: T; error?: string }>, after?: (d: T) => void) {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    const result = await fn();
    setBusy(false);
    if (result.error) return setMessage(result.error);
    after?.(result.data as T);
    onChanged();
    void label;
  }

  const draw = () =>
    act("draw", () => call("POST", `/api/secret-santa/groups/${id}/draw`, { confirmPending }), () => {
      setConfirmPending(false);
      setMessage("Sorteio realizado! Cada participante já pode ver quem tirou.");
    });

  return (
    <div className="space-y-4">
      {message ? (
        <p role="status" className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {message}
        </p>
      ) : null}

      <section className={`${cardClass} space-y-3`} aria-label="Sorteio">
        <h3 className="font-semibold text-zinc-900">Sorteio</h3>
        {preview ? <p className="text-sm text-zinc-600">{preview.summary}</p> : null}
        {preview?.message ? <p className="text-sm text-amber-800">{preview.message}</p> : null}
        {g.status === "DRAWN" ? (
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={draw} disabled={busy || !g.allowRedraw}>
              Refazer sorteio
            </Button>
            <Button type="button" variant="secondary" disabled={busy || !g.allowRedraw} onClick={() => act("inv", () => call("DELETE", `/api/secret-santa/groups/${id}/draw`))}>
              Invalidar para editar o grupo
            </Button>
            {!g.allowRedraw ? <p className="w-full text-xs text-zinc-500">Refazer o sorteio está desativado neste grupo.</p> : null}
          </div>
        ) : open ? (
          <>
            {preview?.needsPendingConfirmation ? (
              <label className="flex min-h-11 items-start gap-3 text-sm text-zinc-800">
                <input type="checkbox" checked={confirmPending} onChange={(e) => setConfirmPending(e.target.checked)} className="mt-0.5 h-5 w-5 accent-rose-700" />
                Sortear só com quem já confirmou (quem está aguardando fica de fora)
              </label>
            ) : null}
            <Button type="button" onClick={draw} disabled={busy || !preview?.canDraw || (preview?.needsPendingConfirmation && !confirmPending)}>
              Realizar sorteio
            </Button>
          </>
        ) : (
          <p className="text-sm text-zinc-500">O grupo não está aberto para sorteio.</p>
        )}
      </section>

      <section className={`${cardClass} space-y-3`} aria-label="Participantes">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-semibold text-zinc-900">Participantes ({view.counts.accepted} confirmados{view.counts.pending ? `, ${view.counts.pending} aguardando` : ""})</h3>
          {open ? (
            <Button type="button" variant="secondary" onClick={() => setAddOpen(true)}>
              + Adicionar
            </Button>
          ) : null}
        </div>
        <ul className="divide-y divide-zinc-100">
          {people.map((p) => (
            <li key={p.id} className="space-y-2 py-2 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span>
                  {p.name}
                  {p.isOrganizer ? " (organizador)" : ""}
                  <span className={`ml-2 rounded-full px-2 py-0.5 text-xs ${p.status === "ACCEPTED" ? "bg-emerald-50 text-emerald-800" : "bg-zinc-100 text-zinc-600"}`}>
                    {p.status === "ACCEPTED" ? "Confirmado" : p.status === "DECLINED" ? "Recusou" : "Aguardando"}
                  </span>
                </span>
                {open && !p.isOrganizer ? (
                  <button type="button" className="min-h-10 px-2 text-xs font-semibold text-red-700 underline" onClick={() => act("rm", () => call("DELETE", `/api/secret-santa/groups/${id}/participants/${p.id}`))}>
                    Remover
                  </button>
                ) : null}
              </div>
              {p.status === "INVITED" && p.inviteToken ? <ShareButtons token={p.inviteToken} groupName={g.name} compact /> : null}
            </li>
          ))}
        </ul>
        {view.inviteToken ? (
          <div className="border-t border-zinc-100 pt-3">
            <p className="mb-2 text-sm font-medium text-zinc-800">Link geral do grupo</p>
            <ShareButtons token={view.inviteToken} groupName={g.name} />
          </div>
        ) : null}
      </section>

      <RestrictionsEditor
        groupId={id}
        people={people.filter((p) => p.status !== "DECLINED")}
        restrictions={(view.restrictions ?? []) as RestrictionLite[]}
        onChanged={onChanged}
        locked={!open}
      />

      <section className={`${cardClass} space-y-3`} aria-label="Avisos e configurações">
        <h3 className="font-semibold text-zinc-900">Organização</h3>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={() => setNoticeOpen(true)}>
            Enviar aviso
          </Button>
          <Button type="button" variant="secondary" onClick={() => setSettingsOpen(true)}>
            Configurações
          </Button>
          {g.status === "DRAWN" && g.revealMode === "MANUAL" && !g.revealed ? (
            <Button type="button" variant="secondary" disabled={busy} onClick={() => act("reveal", () => call("POST", `/api/secret-santa/groups/${id}/reveal`))}>
              Revelar resultado
            </Button>
          ) : null}
          {g.status === "DRAWN" ? (
            <Button type="button" variant="secondary" disabled={busy} onClick={() => act("done", () => call("POST", `/api/secret-santa/groups/${id}/complete`))}>
              Concluir grupo
            </Button>
          ) : null}
          {g.status === "DRAWN" || g.status === "COMPLETED" ? (
            <Button type="button" variant="secondary" onClick={() => setDupOpen(true)}>
              Duplicar para o próximo ano
            </Button>
          ) : null}
          {(g.allowOwnerSeeDraw && g.drawn) || g.revealed ? (
            <Button
              type="button"
              variant="secondary"
              onClick={async () => {
                const r = await call<{ pairs: Array<{ giverName: string; receiverName: string }> }>("GET", `/api/secret-santa/groups/${id}/reveal`);
                if (r.error) setMessage(r.error);
                else setResults(r.data?.pairs ?? []);
              }}
            >
              Ver resultado completo
            </Button>
          ) : null}
          {g.status !== "COMPLETED" && g.status !== "CANCELLED" ? (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                if (window.confirm("Cancelar este amigo secreto? Essa ação não pode ser desfeita.")) void act("cancel", () => call("DELETE", `/api/secret-santa/groups/${id}`), () => router.push("/amigo-secreto"));
              }}
            >
              Cancelar grupo
            </Button>
          ) : null}
        </div>
        {results ? (
          <ul className="divide-y divide-zinc-100 text-sm">
            {results.map((p) => (
              <li key={p.giverName} className="py-1.5">
                {p.giverName} → {p.receiverName}
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <QuickForm
        open={addOpen}
        title="Adicionar participante"
        submitLabel="Adicionar"
        intro="A pessoa recebe um link de convite próprio para entrar com a conta dela."
        onClose={() => setAddOpen(false)}
        fields={[
          { name: "name", label: "Nome", type: "text", required: true, maxLength: 80 },
          { name: "email", label: "E-mail (opcional)", type: "text", maxLength: 200 },
          { name: "phone", label: "Telefone (opcional)", type: "text", maxLength: 30 },
        ]}
        onSubmit={async (v) => {
          const r = await call("POST", `/api/secret-santa/groups/${id}/participants`, v);
          if (r.error) return r.error;
          onChanged();
          return null;
        }}
      />
      <QuickForm
        open={noticeOpen}
        title="Aviso para o grupo"
        submitLabel="Enviar"
        onClose={() => setNoticeOpen(false)}
        fields={[{ name: "body", label: "Mensagem", type: "text", required: true, maxLength: 1000 }]}
        onSubmit={async (v) => {
          const r = await call("POST", `/api/secret-santa/groups/${id}/announcements`, v);
          if (r.error) return r.error;
          onChanged();
          return null;
        }}
      />
      <QuickForm
        open={settingsOpen}
        title="Configurações do grupo"
        submitLabel="Salvar"
        onClose={() => setSettingsOpen(false)}
        fields={[
          { name: "name", label: "Nome", type: "text", required: true, defaultValue: g.name, maxLength: 80 },
          { name: "description", label: "Descrição", type: "text", defaultValue: g.description ?? "", maxLength: 500 },
          { name: "eventDate", label: "Data da festa", type: "date", defaultValue: g.eventDate ?? "" },
          { name: "joinDeadline", label: "Prazo para entrar", type: "date", defaultValue: g.joinDeadline ?? "" },
          { name: "location", label: "Local", type: "text", defaultValue: g.location ?? "", maxLength: 200 },
          { name: "budgetMin", label: "Valor mínimo (R$)", type: "money", defaultValue: g.budgetMinCents ? String(g.budgetMinCents / 100).replace(".", ",") : "" },
          { name: "budgetMax", label: "Valor máximo (R$)", type: "money", defaultValue: g.budgetMaxCents ? String(g.budgetMaxCents / 100).replace(".", ",") : "" },
          { name: "rulesText", label: "Regras", type: "text", defaultValue: g.rulesText ?? "", maxLength: 1500 },
          { name: "allowWishList", label: "Lista de desejos", type: "checkbox", defaultValue: g.allowWishList },
          { name: "allowGiftPreferences", label: "Preferências de presente", type: "checkbox", defaultValue: g.allowGiftPreferences },
          { name: "allowAnonymousMessages", label: "Mensagens anônimas", type: "checkbox", defaultValue: g.allowAnonymousMessages },
          { name: "allowParticipantInvites", label: "Participantes podem convidar", type: "checkbox", defaultValue: g.allowParticipantInvites },
        ]}
        onSubmit={async (v) => {
          const min = String(v.budgetMin ?? "").trim();
          const max = String(v.budgetMax ?? "").trim();
          const r = await call("PATCH", `/api/secret-santa/groups/${id}`, {
            name: v.name,
            description: v.description || null,
            eventDate: v.eventDate || null,
            joinDeadline: v.joinDeadline || null,
            location: v.location || null,
            rulesText: v.rulesText || null,
            budgetMinCents: min ? parseMoneyToCents(min) : null,
            budgetMaxCents: max ? parseMoneyToCents(max) : null,
            allowWishList: v.allowWishList,
            allowGiftPreferences: v.allowGiftPreferences,
            allowAnonymousMessages: v.allowAnonymousMessages,
            allowParticipantInvites: v.allowParticipantInvites,
          });
          if (r.error) return r.error;
          onChanged();
          return null;
        }}
      />
      <QuickForm
        open={dupOpen}
        title="Duplicar para o próximo ano"
        intro="Copia participantes, regras e restrições (nunca o sorteio). O novo sorteio evita repetir quem cada um tirou."
        submitLabel="Duplicar"
        onClose={() => setDupOpen(false)}
        fields={[
          { name: "name", label: "Nome do novo grupo", type: "text", defaultValue: `${g.name} (próximo)`, maxLength: 80 },
          { name: "eventDate", label: "Nova data", type: "date" },
          { name: "copyBudget", label: "Copiar valor do presente", type: "checkbox", defaultValue: false },
          { name: "avoidPrevious", label: "Não repetir quem tirei neste grupo", type: "checkbox", defaultValue: true },
        ]}
        onSubmit={async (v) => {
          const r = await call<{ id: string }>("POST", `/api/secret-santa/groups/${id}/duplicate`, { ...v, eventDate: v.eventDate || null });
          if (r.error || !r.data) return r.error ?? "Não foi possível duplicar.";
          router.push(`/amigo-secreto/${r.data.id}`);
          return null;
        }}
      />
    </div>
  );
}
