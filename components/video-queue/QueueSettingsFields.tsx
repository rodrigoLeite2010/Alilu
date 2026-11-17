"use client";

import { useEffect, useState } from "react";
import type { QueueScheduleConfig } from "@/lib/video-queue/schedule";

/**
 * Campos compartilhados entre "Nova fila" e "Configurações": programação
 * (data de início, publicações/dia, horários, dias, fuso, intervalo,
 * ordem, regra de vídeo não pronto) e destinos (conta Instagram + Páginas).
 */

export const WEEKDAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const TIMEZONES = ["America/Sao_Paulo", "America/Manaus", "America/Belem", "America/Fortaleza", "America/Recife", "America/Cuiaba", "America/Rio_Branco", "America/Noronha", "Europe/Lisbon", "UTC"];

export const inputClass = "mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none";
export const labelClass = "block text-sm font-medium text-zinc-800";

export function QueueScheduleEditor({ value, onChange }: { value: QueueScheduleConfig; onChange: (next: QueueScheduleConfig) => void }) {
  const [newTime, setNewTime] = useState("12:00");
  const set = <K extends keyof QueueScheduleConfig>(key: K, next: QueueScheduleConfig[K]) => onChange({ ...value, [key]: next });
  const addTime = () => {
    if (!/^\d{2}:\d{2}$/.test(newTime) || value.publishTimes.includes(newTime)) return;
    const times = [...value.publishTimes, newTime].sort();
    onChange({ ...value, publishTimes: times, postsPerDay: Math.max(value.postsPerDay, Math.min(times.length, value.postsPerDay + 1)) });
  };
  const removeTime = (time: string) => {
    const times = value.publishTimes.filter((item) => item !== time);
    onChange({ ...value, publishTimes: times, postsPerDay: Math.min(value.postsPerDay, Math.max(times.length, 1)) });
  };
  const toggleDay = (day: number) =>
    set("weekdays", value.weekdays.includes(day) ? value.weekdays.filter((item) => item !== day) : [...value.weekdays, day].sort());

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <label className={labelClass}>
        Data de início
        <input type="date" className={inputClass} value={value.startDate ?? ""} onChange={(event) => set("startDate", event.target.value || null)} />
        <span className="mt-1 block text-xs font-normal text-zinc-500">Vazio = a partir de hoje.</span>
      </label>
      <label className={labelClass}>
        Publicações por dia
        <input
          type="number"
          min={1}
          max={Math.max(value.publishTimes.length, 1)}
          className={inputClass}
          value={value.postsPerDay}
          onChange={(event) => set("postsPerDay", Number(event.target.value))}
        />
      </label>
      <div className="sm:col-span-2">
        <span className={labelClass}>Horários permitidos</span>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {value.publishTimes.map((time) => (
            <span key={time} className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-3 py-1 text-sm">
              {time}
              <button type="button" className="text-zinc-500 hover:text-red-600" aria-label={`Remover ${time}`} onClick={() => removeTime(time)}>
                ×
              </button>
            </span>
          ))}
          <input type="time" className="rounded-md border border-zinc-300 px-2 py-1 text-sm" value={newTime} onChange={(event) => setNewTime(event.target.value)} />
          <button type="button" className="rounded-md bg-white px-3 py-1 text-sm font-medium ring-1 ring-zinc-300 hover:bg-zinc-50" onClick={addTime}>
            Adicionar horário
          </button>
        </div>
      </div>
      <div className="sm:col-span-2">
        <span className={labelClass}>Dias da semana</span>
        <div className="mt-2 flex flex-wrap gap-2">
          {WEEKDAY_LABELS.map((label, day) => (
            <button
              key={label}
              type="button"
              aria-pressed={value.weekdays.includes(day)}
              onClick={() => toggleDay(day)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ring-1 ring-inset ${value.weekdays.includes(day) ? "bg-zinc-900 text-white ring-zinc-900" : "bg-white text-zinc-700 ring-zinc-300"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <label className={labelClass}>
        Fuso horário
        <select className={inputClass} value={value.timezone} onChange={(event) => set("timezone", event.target.value)}>
          {[...new Set([value.timezone, ...TIMEZONES])].map((zone) => (
            <option key={zone} value={zone}>
              {zone}
            </option>
          ))}
        </select>
      </label>
      <label className={labelClass}>
        Intervalo mínimo entre publicações (min)
        <input type="number" min={0} max={1440} className={inputClass} value={value.minIntervalMinutes} onChange={(event) => set("minIntervalMinutes", Number(event.target.value))} />
      </label>
      <label className={labelClass}>
        Ordem de publicação
        <select className={inputClass} value={value.orderMode} onChange={(event) => set("orderMode", event.target.value as QueueScheduleConfig["orderMode"])}>
          <option value="POSITION">Na ordem da fila</option>
          <option value="REVERSE">Do último para o primeiro</option>
        </select>
      </label>
      <label className={labelClass}>
        Se o próximo vídeo ainda não estiver pronto
        <select className={inputClass} value={value.notReadyPolicy} onChange={(event) => set("notReadyPolicy", event.target.value as QueueScheduleConfig["notReadyPolicy"])}>
          <option value="NEXT_READY">Usar o próximo vídeo pronto</option>
          <option value="WAIT">Aguardar o processamento (mantém a ordem)</option>
        </select>
      </label>
      <label className={labelClass}>
        Agendar com antecedência de (horas)
        <input
          type="number"
          min={1}
          max={720}
          className={inputClass}
          value={value.materializeAheadHours}
          onChange={(event) => set("materializeAheadHours", Number(event.target.value))}
        />
        <span className="mt-1 block text-xs font-normal text-zinc-500">As publicações aparecem em Minhas publicações com esta antecedência.</span>
      </label>
      <label className="flex items-start gap-2 text-sm text-zinc-700 sm:col-span-2">
        <input type="checkbox" className="mt-1" checked={value.allowSameSlot} onChange={(event) => set("allowSameSlot", event.target.checked)} />
        Permitir publicar no mesmo horário de outras publicações já agendadas nestas contas
      </label>
    </div>
  );
}

export interface AccountOption {
  id: string;
  igUsername: string | null;
  status: string;
}

export interface PageOption {
  id: string;
  pageName: string;
  status: string;
  linkedIgUsername: string | null;
}

/** Contas Instagram e Páginas do Facebook conectadas do usuário (nunca devolve tokens). */
export function useConnectedTargets() {
  const [accounts, setAccounts] = useState<AccountOption[] | null>(null);
  const [pages, setPages] = useState<PageOption[] | null>(null);
  const [facebookConfigured, setFacebookConfigured] = useState(true);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/content-automation/accounts")
      .then((response) => (response.ok ? response.json() : { accounts: [] }))
      .then((data: { accounts?: AccountOption[] }) => !cancelled && setAccounts(data.accounts ?? []))
      .catch(() => !cancelled && setAccounts([]));
    fetch("/api/facebook/pages")
      .then((response) => (response.ok ? response.json() : { pages: [] }))
      .then((data: { pages?: PageOption[]; configured?: boolean }) => {
        if (cancelled) return;
        setPages(data.pages ?? []);
        setFacebookConfigured(data.configured !== false);
      })
      .catch(() => !cancelled && setPages([]));
    return () => {
      cancelled = true;
    };
  }, []);
  return { accounts, pages, facebookConfigured };
}

export function FacebookPagesChooser({
  pages,
  selected,
  onChange,
}: {
  pages: PageOption[] | null;
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  if (pages === null) return <p className="text-sm text-zinc-500">Carregando Páginas…</p>;
  if (pages.length === 0) {
    return (
      <p className="text-sm text-zinc-600">
        Nenhuma Página do Facebook conectada.{" "}
        <a className="font-medium text-teal-700 underline" href="/instagram/painel">
          Conectar Página
        </a>
      </p>
    );
  }
  return (
    <div className="space-y-2">
      {pages.map((page) => {
        const usable = page.status === "connected";
        return (
          <label key={page.id} className={`flex items-start gap-2 text-sm ${usable ? "text-zinc-800" : "text-zinc-400"}`}>
            <input
              type="checkbox"
              className="mt-1"
              disabled={!usable && !selected.includes(page.id)}
              checked={selected.includes(page.id)}
              onChange={(event) => onChange(event.target.checked ? [...selected, page.id] : selected.filter((id) => id !== page.id))}
            />
            <span>
              {page.pageName}
              {page.linkedIgUsername ? <span className="text-zinc-500"> (vinculada a @{page.linkedIgUsername})</span> : null}
              {!usable ? <span className="ml-1 text-amber-700">— precisa reconectar</span> : null}
            </span>
          </label>
        );
      })}
    </div>
  );
}

export async function readApiError(response: Response, fallback: string): Promise<string> {
  try {
    const data = (await response.json()) as { error?: string };
    return data.error || fallback;
  } catch {
    return fallback;
  }
}
