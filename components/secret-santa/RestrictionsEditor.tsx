"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { call, cardClass, inputClass } from "./api";

export interface PersonLite {
  id: string;
  name: string;
  status: string;
}
export interface RestrictionLite {
  id: string;
  participantId: string;
  cannotDrawParticipantId: string;
  reason: string | null;
}

type Mode = "COUPLE" | "FAMILY" | "PARENTS_CHILDREN" | "SPECIFIC";
const MODES: Array<{ id: Mode; label: string; help: string }> = [
  { id: "COUPLE", label: "Casal / dupla", help: "Escolha duas pessoas: uma não tira a outra." },
  { id: "FAMILY", label: "Mesma família (irmãos, etc.)", help: "Escolha várias pessoas: nenhuma tira as outras do grupo." },
  { id: "PARENTS_CHILDREN", label: "Pais e filhos", help: "Escolha quem são os pais e quem são os filhos: não se tiram." },
  { id: "SPECIFIC", label: "Pessoa específica", help: "A pessoa não tira outra pessoa (pode valer só em uma direção)." },
];

/** Restrições do sorteio. Sem supor parentesco: o organizador escolhe o tipo de regra que quiser. */
export function RestrictionsEditor({
  groupId,
  people,
  restrictions,
  onChanged,
  locked,
}: {
  groupId: string;
  people: PersonLite[];
  restrictions: RestrictionLite[];
  onChanged: () => void;
  locked: boolean;
}) {
  const [mode, setMode] = useState<Mode>("COUPLE");
  const [a, setA] = useState<string[]>([]);
  const [b, setB] = useState<string[]>([]);
  const [both, setBoth] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const name = (id: string) => people.find((p) => p.id === id)?.name ?? "?";
  const toggle = (list: string[], set: (v: string[]) => void, id: string) => set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  async function save() {
    setError(null);
    let fromIds = a;
    let toIds = b;
    let bothWays = true;
    if (mode === "COUPLE") {
      if (a.length !== 2) return setError("Escolha exatamente duas pessoas.");
      fromIds = [a[0]];
      toIds = [a[1]];
    } else if (mode === "FAMILY") {
      if (a.length < 2) return setError("Escolha pelo menos duas pessoas.");
      toIds = a;
    } else if (mode === "PARENTS_CHILDREN") {
      if (a.length < 1 || b.length < 1) return setError("Escolha ao menos um dos dois lados.");
    } else {
      if (a.length !== 1 || b.length !== 1) return setError("Escolha uma pessoa em cada lista.");
      bothWays = both;
    }
    setBusy(true);
    const result = await call("POST", `/api/secret-santa/groups/${groupId}/restrictions`, { fromIds, toIds, bothWays });
    setBusy(false);
    if (result.error) return setError(result.error);
    setA([]);
    setB([]);
    onChanged();
  }
  async function remove(id: string) {
    const result = await call("DELETE", `/api/secret-santa/groups/${groupId}/restrictions/${id}`);
    if (result.error) setError(result.error);
    else onChanged();
  }

  const list = (title: string, selected: string[], set: (v: string[]) => void) => (
    <fieldset className="min-w-0">
      <legend className="text-sm font-medium text-zinc-800">{title}</legend>
      <div className="mt-1 flex flex-wrap gap-2">
        {people.map((p) => (
          <label key={p.id} className={`flex min-h-10 cursor-pointer items-center gap-2 rounded-full border px-3 text-sm ${selected.includes(p.id) ? "border-rose-600 bg-rose-50 text-rose-900" : "border-zinc-300"}`}>
            <input type="checkbox" className="sr-only" checked={selected.includes(p.id)} onChange={() => toggle(selected, set, p.id)} />
            {p.name}
          </label>
        ))}
      </div>
    </fieldset>
  );

  return (
    <section className={`${cardClass} space-y-4`} aria-label="Restrições do sorteio">
      <div>
        <h3 className="font-semibold text-zinc-900">Quem não pode tirar quem</h3>
        <p className="text-sm text-zinc-600">As restrições valem só no sorteio e ficam visíveis apenas para você.</p>
      </div>
      {locked ? <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">Invalide o sorteio para alterar restrições.</p> : null}
      {!locked ? (
        <div className="space-y-3">
          <label className="block text-sm font-medium text-zinc-800">
            Tipo de regra
            <select
              value={mode}
              onChange={(e) => {
                setMode(e.target.value as Mode);
                setA([]);
                setB([]);
              }}
              className={inputClass}
            >
              {MODES.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
          <p className="text-xs text-zinc-500">{MODES.find((m) => m.id === mode)?.help}</p>
          {mode === "COUPLE" || mode === "FAMILY" ? list("Pessoas", a, setA) : null}
          {mode === "PARENTS_CHILDREN" ? (
            <>
              {list("Pais / responsáveis", a, setA)}
              {list("Filhos", b, setB)}
            </>
          ) : null}
          {mode === "SPECIFIC" ? (
            <>
              {list("Esta pessoa…", a, setA)}
              {list("…não pode tirar", b, setB)}
              <label className="flex min-h-10 items-center gap-2 text-sm">
                <input type="checkbox" checked={both} onChange={(e) => setBoth(e.target.checked)} className="h-5 w-5 accent-rose-700" /> Vale também no sentido contrário
              </label>
            </>
          ) : null}
          {error ? (
            <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}
          <Button type="button" onClick={save} disabled={busy}>
            Adicionar restrição
          </Button>
        </div>
      ) : null}
      {restrictions.length > 0 ? (
        <ul className="divide-y divide-zinc-100 text-sm">
          {restrictions.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-3 py-2">
              <span>
                {name(r.participantId)} <span className="text-zinc-500">não tira</span> {name(r.cannotDrawParticipantId)}
              </span>
              {!locked ? (
                <button type="button" onClick={() => remove(r.id)} className="min-h-10 px-2 text-xs font-semibold text-red-700 underline" aria-label={`Remover restrição de ${name(r.participantId)}`}>
                  Remover
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-zinc-500">Nenhuma restrição.</p>
      )}
    </section>
  );
}
