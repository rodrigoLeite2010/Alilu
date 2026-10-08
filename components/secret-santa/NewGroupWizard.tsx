"use client";

import Link from "next/link";
import { useState } from "react";
import { Button, LinkButton } from "@/components/ui/Button";
import { parseMoneyToCents } from "@/lib/allowance/money";
import { call, cardClass, inputClass } from "./api";
import { RestrictionsEditor, type PersonLite, type RestrictionLite } from "./RestrictionsEditor";
import { ShareButtons } from "./ShareButtons";

const STEPS = ["Nome", "Data e local", "Valor", "Regras", "Participantes", "Restrições", "Pronto"];

interface Draft {
  name: string;
  description: string;
  eventDate: string;
  joinDeadline: string;
  location: string;
  budgetMin: string;
  budgetMax: string;
  rulesText: string;
  allowWishList: boolean;
  allowAnonymousMessages: boolean;
  allowGiftPreferences: boolean;
  allowParticipantInvites: boolean;
  allowRedraw: boolean;
  allowOwnerSeeDraw: boolean;
  revealMode: "MANUAL" | "AUTOMATIC" | "NEVER";
  participants: Array<{ name: string; email: string; phone: string }>;
}

const INITIAL: Draft = {
  name: "",
  description: "",
  eventDate: "",
  joinDeadline: "",
  location: "",
  budgetMin: "",
  budgetMax: "",
  rulesText: "",
  allowWishList: true,
  allowAnonymousMessages: true,
  allowGiftPreferences: true,
  allowParticipantInvites: false,
  allowRedraw: true,
  allowOwnerSeeDraw: false,
  revealMode: "MANUAL",
  participants: [],
};

function Check({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex min-h-11 items-start gap-3 text-sm text-zinc-800">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 h-5 w-5 accent-rose-700" />
      <span>
        {label}
        {hint ? <span className="block text-xs text-zinc-500">{hint}</span> : null}
      </span>
    </label>
  );
}

export function NewGroupWizard() {
  const [step, setStep] = useState(0);
  const [d, setD] = useState<Draft>(INITIAL);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<{ id: string; token: string; people: PersonLite[]; restrictions: RestrictionLite[] } | null>(null);
  const [pName, setPName] = useState("");
  const [pEmail, setPEmail] = useState("");
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setD((prev) => ({ ...prev, [key]: value }));

  function addPerson() {
    if (!pName.trim()) return setError("Informe o nome da pessoa.");
    set("participants", [...d.participants, { name: pName.trim(), email: pEmail.trim(), phone: "" }]);
    setPName("");
    setPEmail("");
    setError(null);
  }

  function validate(): string | null {
    if (step === 0 && !d.name.trim()) return "Dê um nome ao grupo.";
    if (step === 2) {
      const min = d.budgetMin.trim() ? parseMoneyToCents(d.budgetMin) : null;
      const max = d.budgetMax.trim() ? parseMoneyToCents(d.budgetMax) : null;
      if ((d.budgetMin.trim() && min === null) || (d.budgetMax.trim() && max === null)) return "Valor inválido.";
      if (min !== null && max !== null && max < min) return "O máximo precisa ser maior ou igual ao mínimo.";
    }
    return null;
  }

  async function createGroup() {
    setBusy(true);
    setError(null);
    const result = await call<{ id: string }>("POST", "/api/secret-santa/groups", {
      name: d.name,
      description: d.description || null,
      eventDate: d.eventDate || null,
      joinDeadline: d.joinDeadline || null,
      location: d.location || null,
      budgetMinCents: d.budgetMin.trim() ? parseMoneyToCents(d.budgetMin) : null,
      budgetMaxCents: d.budgetMax.trim() ? parseMoneyToCents(d.budgetMax) : null,
      rulesText: d.rulesText || null,
      allowWishList: d.allowWishList,
      allowAnonymousMessages: d.allowAnonymousMessages,
      allowGiftPreferences: d.allowGiftPreferences,
      allowParticipantInvites: d.allowParticipantInvites,
      allowRedraw: d.allowRedraw,
      allowOwnerSeeDraw: d.allowOwnerSeeDraw,
      revealMode: d.revealMode,
      participants: d.participants,
    });
    if (result.error || !result.data) {
      setBusy(false);
      return setError(result.error ?? "Não foi possível criar o grupo.");
    }
    await load(result.data.id);
    setBusy(false);
    setStep(5);
  }

  async function load(id: string) {
    const view = await call<{ inviteToken: string; participants: PersonLite[]; restrictions: RestrictionLite[] }>("GET", `/api/secret-santa/groups/${id}`);
    if (view.data) setCreated({ id, token: view.data.inviteToken, people: view.data.participants, restrictions: view.data.restrictions });
  }

  function next() {
    const problem = validate();
    if (problem) return setError(problem);
    setError(null);
    if (step === 4) void createGroup();
    else setStep(step + 1);
  }

  return (
    <div className="space-y-5">
      <ol className="flex gap-1" aria-label="Etapas">
        {STEPS.map((label, i) => (
          <li key={label} className={`h-1.5 flex-1 rounded-full ${i <= step ? "bg-rose-600" : "bg-zinc-200"}`} aria-current={i === step ? "step" : undefined} title={label} />
        ))}
      </ol>
      <p className="text-sm font-medium text-zinc-600">
        Etapa {step + 1} de {STEPS.length}: {STEPS[step]}
      </p>

      <div className={`${cardClass} space-y-4`}>
        {step === 0 ? (
          <>
            <label className="block text-sm font-medium text-zinc-800">
              Nome do grupo
              <input value={d.name} onChange={(e) => set("name", e.target.value)} maxLength={80} placeholder="Amigo Secreto Família" className={inputClass} />
            </label>
            <label className="block text-sm font-medium text-zinc-800">
              Descrição (opcional)
              <textarea value={d.description} onChange={(e) => set("description", e.target.value)} maxLength={500} rows={3} className={inputClass} />
            </label>
          </>
        ) : null}
        {step === 1 ? (
          <>
            <label className="block text-sm font-medium text-zinc-800">
              Data da festa / revelação
              <input type="date" value={d.eventDate} onChange={(e) => set("eventDate", e.target.value)} className={inputClass} />
            </label>
            <label className="block text-sm font-medium text-zinc-800">
              Prazo para entrar (opcional)
              <input type="date" value={d.joinDeadline} onChange={(e) => set("joinDeadline", e.target.value)} className={inputClass} />
            </label>
            <label className="block text-sm font-medium text-zinc-800">
              Local (opcional)
              <input value={d.location} onChange={(e) => set("location", e.target.value)} maxLength={200} className={inputClass} />
            </label>
          </>
        ) : null}
        {step === 2 ? (
          <>
            <p className="text-sm text-zinc-600">Deixe em branco o que não quiser limitar. Só o máximo também vale.</p>
            <label className="block text-sm font-medium text-zinc-800">
              Valor mínimo (R$)
              <input inputMode="decimal" value={d.budgetMin} onChange={(e) => set("budgetMin", e.target.value)} placeholder="50,00" className={inputClass} />
            </label>
            <label className="block text-sm font-medium text-zinc-800">
              Valor máximo (R$)
              <input inputMode="decimal" value={d.budgetMax} onChange={(e) => set("budgetMax", e.target.value)} placeholder="100,00" className={inputClass} />
            </label>
          </>
        ) : null}
        {step === 3 ? (
          <>
            <Check label="Lista de desejos" checked={d.allowWishList} onChange={(v) => set("allowWishList", v)} />
            <Check label="Preferências de presente (tamanho, cores, gostos)" checked={d.allowGiftPreferences} onChange={(v) => set("allowGiftPreferences", v)} />
            <Check label="Mensagens anônimas e perguntas" hint="Quem tirou pode escrever sem se identificar." checked={d.allowAnonymousMessages} onChange={(v) => set("allowAnonymousMessages", v)} />
            <Check label="Participantes podem convidar outras pessoas" checked={d.allowParticipantInvites} onChange={(v) => set("allowParticipantInvites", v)} />
            <Check label="Permitir refazer o sorteio" checked={d.allowRedraw} onChange={(v) => set("allowRedraw", v)} />
            <Check label="Eu (organizador) posso ver o resultado do sorteio" hint="Desmarcado, você participa como todo mundo e não vê quem tirou quem. Não dá para mudar depois do sorteio." checked={d.allowOwnerSeeDraw} onChange={(v) => set("allowOwnerSeeDraw", v)} />
            <label className="block text-sm font-medium text-zinc-800">
              Revelação do resultado
              <select value={d.revealMode} onChange={(e) => set("revealMode", e.target.value as Draft["revealMode"])} className={inputClass}>
                <option value="MANUAL">Quando o organizador liberar</option>
                <option value="AUTOMATIC">Automática, na data da festa</option>
                <option value="NEVER">Nunca revelar</option>
              </select>
            </label>
            <label className="block text-sm font-medium text-zinc-800">
              Regras do grupo (texto livre)
              <textarea value={d.rulesText} onChange={(e) => set("rulesText", e.target.value)} maxLength={1500} rows={3} className={inputClass} />
            </label>
          </>
        ) : null}
        {step === 4 ? (
          <>
            <p className="text-sm text-zinc-600">Adicione quem vai participar. Cada pessoa recebe um link de convite próprio; depois você também pode compartilhar o link do grupo.</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <input aria-label="Nome" value={pName} onChange={(e) => setPName(e.target.value)} placeholder="Nome" maxLength={80} className={inputClass} />
              <input aria-label="E-mail (opcional)" value={pEmail} onChange={(e) => setPEmail(e.target.value)} placeholder="E-mail (opcional)" className={inputClass} />
            </div>
            <Button type="button" variant="secondary" onClick={addPerson}>
              Adicionar pessoa
            </Button>
            {d.participants.length > 0 ? (
              <ul className="divide-y divide-zinc-100 text-sm">
                {d.participants.map((p, i) => (
                  <li key={`${p.name}-${i}`} className="flex items-center justify-between py-2">
                    <span>{p.name}</span>
                    <button type="button" className="min-h-10 px-2 text-xs font-semibold text-red-700 underline" onClick={() => set("participants", d.participants.filter((_, j) => j !== i))}>
                      Remover
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            <p className="text-xs text-zinc-500">Você já está no grupo como organizador.</p>
          </>
        ) : null}
        {step === 5 && created ? (
          <RestrictionsEditor groupId={created.id} people={created.people} restrictions={created.restrictions} onChanged={() => void load(created.id)} locked={false} />
        ) : null}
        {step === 6 && created ? (
          <>
            <h2 className="text-lg font-semibold text-zinc-900">Grupo criado! 🎁</h2>
            <p className="text-sm text-zinc-600">Compartilhe o link para as pessoas entrarem. Quando todos confirmarem, faça o sorteio na página do grupo.</p>
            <ShareButtons token={created.token} groupName={d.name} />
            <LinkButton href={`/amigo-secreto/${created.id}`} className="w-full">
              Ir para o grupo
            </LinkButton>
          </>
        ) : null}

        {error ? (
          <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        ) : null}
      </div>

      {step < 6 ? (
        <div className="flex gap-3">
          {step > 0 && step < 5 ? (
            <Button type="button" variant="secondary" onClick={() => setStep(step - 1)} className="flex-1">
              Voltar
            </Button>
          ) : (
            <Link href="/amigo-secreto" className="flex min-h-11 flex-1 items-center justify-center rounded-md text-sm font-semibold text-zinc-600 underline">
              {step === 0 ? "Cancelar" : ""}
            </Link>
          )}
          {step === 5 ? (
            <Button type="button" onClick={() => setStep(6)} className="flex-1">
              Continuar
            </Button>
          ) : (
            <Button type="button" onClick={next} disabled={busy} className="flex-1">
              {step === 4 ? (busy ? "Criando…" : "Criar grupo") : "Continuar"}
            </Button>
          )}
        </div>
      ) : null}
    </div>
  );
}
