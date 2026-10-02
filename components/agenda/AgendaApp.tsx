"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, MapPin, Plus, Repeat, Search, Settings, X } from "lucide-react";
import {
  RECURRENCES,
  RECURRENCE_LABEL,
  localDateKey,
  localTimeKey,
  localToUtc,
  nextOccurrence,
  whenLabel,
  type Recurrence,
} from "@/lib/agenda/time";
import {
  AGENDA_CATEGORIES,
  AGENDA_CATEGORY_COLOR,
  AGENDA_CATEGORY_LABEL,
  REMINDER_OPTIONS,
  reminderLabel,
  type AgendaCategory,
  type AgendaEventDto,
  type AgendaPreferencesDto,
} from "@/lib/agenda/types";

type View = "month" | "week" | "list";
type ListTab = "today" | "tomorrow" | "week" | "all";

interface Item {
  event: AgendaEventDto;
  startAt: string;
  dayKey: string;
}

interface Editor {
  mode: "new" | "edit";
  eventId?: string;
  title: string;
  date: string;
  time: string;
  endTime: string;
  location: string;
  description: string;
  category: AgendaCategory;
  recurrence: Recurrence;
  reminders: number[];
  more: boolean;
}

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const LIST_TABS: Array<{ id: ListTab; label: string }> = [
  { id: "today", label: "Hoje" },
  { id: "tomorrow", label: "Amanhã" },
  { id: "week", label: "7 dias" },
  { id: "all", label: "Todos" },
];

// ---- aritmética de datas "YYYY-MM-DD" (sem fuso; o fuso entra só na conversão para UTC) ----
function keyToUtcDate(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}
function addDays(key: string, days: number): string {
  const date = keyToUtcDate(key);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
function weekday(key: string): number {
  return keyToUtcDate(key).getUTCDay();
}
function keyStartUtc(key: string, tz: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return localToUtc(y, m, d, 0, 0, tz);
}
function dayTitle(key: string): string {
  const date = keyToUtcDate(key);
  return `${WEEKDAYS[date.getUTCDay()]}, ${date.getUTCDate()} de ${MONTHS[date.getUTCMonth()]}`;
}

function rangeFor(view: View, tab: ListTab, cursor: string, today: string): { start: string; end: string } {
  if (view === "month") {
    const first = `${cursor.slice(0, 7)}-01`;
    const start = addDays(first, -weekday(first));
    return { start, end: addDays(start, 42) };
  }
  if (view === "week") {
    const start = addDays(cursor, -weekday(cursor));
    return { start, end: addDays(start, 7) };
  }
  if (tab === "today") return { start: today, end: addDays(today, 1) };
  if (tab === "tomorrow") return { start: addDays(today, 1), end: addDays(today, 2) };
  if (tab === "week") return { start: today, end: addDays(today, 7) };
  return { start: today, end: addDays(today, 365) };
}

function blankEditor(date: string, defaultReminder: number | null): Editor {
  return {
    mode: "new",
    title: "",
    date,
    time: "",
    endTime: "",
    location: "",
    description: "",
    category: "PESSOAL",
    recurrence: "NONE",
    reminders: defaultReminder === null ? [] : [defaultReminder],
    more: false,
  };
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: "no-store", ...init, headers: { "content-type": "application/json", ...(init?.headers ?? {}) } });
  const body = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(body.error ?? "Não foi possível concluir. Tente de novo.");
  return body;
}

function browserTimezone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
}

function timezoneOptions(current: string): string[] {
  let zones: string[] = [];
  try {
    const intl = Intl as unknown as { supportedValuesOf?: (key: string) => string[] };
    zones = intl.supportedValuesOf?.("timeZone") ?? [];
  } catch {
    zones = [];
  }
  if (!zones.length) zones = ["America/Sao_Paulo", "America/Manaus", "America/Fortaleza", "America/Recife", "America/Belem", "America/Cuiaba", "America/Rio_Branco", "America/Noronha", "Europe/Lisbon", "UTC"];
  return zones.includes(current) ? zones : [current, ...zones];
}

export function AgendaApp({
  initialPreferences,
  hasSavedPreferences,
  initialEventId,
  openNew,
  userFirstName,
}: {
  initialPreferences: AgendaPreferencesDto;
  hasSavedPreferences: boolean;
  initialEventId: string | null;
  openNew: boolean;
  userFirstName: string | null;
}) {
  const [prefs, setPrefs] = useState(initialPreferences);
  const tz = prefs.timezone;
  const today = useMemo(() => localDateKey(new Date(), tz), [tz]);
  const [view, setView] = useState<View>("month");
  const [tab, setTab] = useState<ListTab>("week");
  const [cursor, setCursor] = useState(today);
  const [selectedDay, setSelectedDay] = useState(today);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [category, setCategory] = useState<AgendaCategory | "">("");
  const [items, setItems] = useState<Item[]>([]);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [editor, setEditor] = useState<Editor | null>(() =>
    openNew ? blankEditor(localDateKey(new Date(), initialPreferences.timezone), initialPreferences.defaultReminderMinutes) : null,
  );
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [detail, setDetail] = useState<Item | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showPrefs, setShowPrefs] = useState(false);

  // Primeira visita: guarda o fuso do navegador como preferência.
  useEffect(() => {
    if (hasSavedPreferences) return;
    const zone = browserTimezone();
    if (!zone) return;
    api<{ preferences: AgendaPreferencesDto }>("/api/agenda/preferences", { method: "PUT", body: JSON.stringify({ timezone: zone }) })
      .then((body) => setPrefs(body.preferences))
      .catch(() => undefined);
  }, [hasSavedPreferences]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const range = useMemo(() => rangeFor(view, tab, cursor, today), [view, tab, cursor, today]);

  const requestKey = useMemo(() => {
    const params = new URLSearchParams({ from: keyStartUtc(range.start, tz).toISOString(), to: keyStartUtc(range.end, tz).toISOString() });
    if (debouncedQuery) params.set("q", debouncedQuery);
    if (category) params.set("category", category);
    return `${params}#${reloadKey}`;
  }, [range, tz, debouncedQuery, category, reloadKey]);
  const loading = loadedKey !== requestKey;

  useEffect(() => {
    let cancelled = false;
    const params = requestKey.split("#")[0];
    api<{ events: AgendaEventDto[]; occurrences: Array<{ eventId: string; startAt: string }> }>(`/api/agenda/events?${params}`)
      .then((body) => {
        if (cancelled) return;
        const byId = new Map(body.events.map((event) => [event.id, event]));
        const next: Item[] = [];
        for (const occurrence of body.occurrences) {
          const event = byId.get(occurrence.eventId);
          if (!event) continue;
          // dia inteiro: a data vale no fuso do próprio compromisso
          const dayKey = localDateKey(new Date(occurrence.startAt), event.isAllDay ? event.timezone : tz);
          next.push({ event, startAt: occurrence.startAt, dayKey });
        }
        next.sort((a, b) => a.dayKey.localeCompare(b.dayKey) || Number(b.event.isAllDay) - Number(a.event.isAllDay) || a.startAt.localeCompare(b.startAt));
        setItems(next);
        setError(null);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoadedKey(requestKey);
      });
    return () => {
      cancelled = true;
    };
  }, [requestKey, tz]);

  const byDay = useMemo(() => {
    const map = new Map<string, Item[]>();
    for (const item of items) {
      const list = map.get(item.dayKey) ?? [];
      list.push(item);
      map.set(item.dayKey, list);
    }
    return map;
  }, [items]);

  const newEditor = useCallback((date: string): Editor => blankEditor(date, prefs.defaultReminderMinutes), [prefs.defaultReminderMinutes]);

  const editEditor = (event: AgendaEventDto): Editor => {
    const start = new Date(event.startAt);
    return {
      mode: "edit",
      eventId: event.id,
      title: event.title,
      date: localDateKey(start, event.timezone),
      time: event.isAllDay ? "" : localTimeKey(start, event.timezone),
      endTime: event.endAt && !event.isAllDay ? localTimeKey(new Date(event.endAt), event.timezone) : "",
      location: event.location ?? "",
      description: event.description ?? "",
      category: event.category,
      recurrence: event.recurrence,
      reminders: [...event.reminderOffsets],
      more: true,
    };
  };

  // Links diretos: ?novo=1 e ?evento=<id> (vindo do e-mail de lembrete).
  useEffect(() => {
    if (initialEventId) {
      api<{ event: AgendaEventDto }>(`/api/agenda/events/${initialEventId}`)
        .then(({ event }) => {
          // compromisso que se repete: mostra a próxima data (ou a original, se já acabou)
          const start = nextOccurrence(new Date(event.startAt), event.recurrence, new Date(Date.now() - 86_400_000), event.timezone) ?? new Date(event.startAt);
          setDetail({ event, startAt: start.toISOString(), dayKey: localDateKey(start, event.isAllDay ? event.timezone : tz) });
        })
        .catch(() => setError("Esse compromisso não foi encontrado."));
    }
    // só na montagem
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reload = () => setReloadKey((value) => value + 1);

  const saveEditor = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editor || saving) return;
    setSaving(true);
    setFormError(null);
    const payload = {
      title: editor.title,
      date: editor.date,
      time: editor.time || null,
      endTime: editor.time ? editor.endTime || null : null,
      location: editor.location,
      description: editor.description,
      category: editor.category,
      recurrence: editor.recurrence,
      reminders: editor.reminders,
      ...(editor.mode === "new" ? { timezone: tz } : {}),
    };
    try {
      if (editor.mode === "new") {
        await api("/api/agenda/events", { method: "POST", body: JSON.stringify(payload) });
        setSelectedDay(editor.date);
        if (view !== "list") setCursor(editor.date);
      } else {
        await api(`/api/agenda/events/${editor.eventId}`, { method: "PUT", body: JSON.stringify(payload) });
      }
      setEditor(null);
      setDetail(null);
      reload();
    } catch (err) {
      setFormError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const runAction = async (item: Item, action: "complete" | "cancel" | "reopen" | "delete") => {
    try {
      if (action === "delete") await api(`/api/agenda/events/${item.event.id}`, { method: "DELETE" });
      else await api(`/api/agenda/events/${item.event.id}/${action}`, { method: "POST" });
      setDetail(null);
      setConfirmDelete(false);
      reload();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const savePrefs = async (patch: Partial<AgendaPreferencesDto>) => {
    try {
      const body = await api<{ preferences: AgendaPreferencesDto }>("/api/agenda/preferences", { method: "PUT", body: JSON.stringify(patch) });
      setPrefs(body.preferences);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const move = (direction: 1 | -1) => {
    if (view === "month") {
      const [y, m] = cursor.split("-").map(Number);
      const date = new Date(Date.UTC(y, m - 1 + direction, 1));
      setCursor(date.toISOString().slice(0, 10));
    } else if (view === "week") {
      setCursor(addDays(cursor, 7 * direction));
    }
  };

  const periodTitle = (() => {
    if (view === "month") {
      const [y, m] = cursor.split("-").map(Number);
      return `${MONTHS[m - 1]} de ${y}`;
    }
    if (view === "week") {
      const start = addDays(cursor, -weekday(cursor));
      const end = addDays(start, 6);
      return `${keyToUtcDate(start).getUTCDate()}/${start.slice(5, 7)} – ${keyToUtcDate(end).getUTCDate()}/${end.slice(5, 7)}`;
    }
    return "Próximos compromissos";
  })();

  const timeText = (item: Item) => (item.event.isAllDay ? "Dia inteiro" : localTimeKey(new Date(item.startAt), tz));

  const renderRow = (item: Item, showDate = false) => {
    const done = item.event.status !== "SCHEDULED";
    return (
      <li key={`${item.event.id}-${item.startAt}`}>
        <button
          type="button"
          onClick={() => {
            setConfirmDelete(false);
            setDetail(item);
          }}
          className="flex w-full items-start gap-3 rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-left hover:border-zinc-300 hover:bg-zinc-50"
        >
          <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: AGENDA_CATEGORY_COLOR[item.event.category] }} aria-hidden />
          <span className="min-w-0 flex-1">
            <span className={`block truncate font-medium ${done ? "text-zinc-400 line-through" : "text-zinc-900"}`}>{item.event.title}</span>
            <span className="block text-xs text-zinc-500">
              {showDate ? `${dayTitle(item.dayKey)} · ` : ""}
              {timeText(item)}
              {item.event.location ? ` · ${item.event.location}` : ""}
              {item.event.status === "COMPLETED" ? " · Concluído" : item.event.status === "CANCELLED" ? " · Cancelado" : ""}
            </span>
          </span>
          {item.event.recurrence !== "NONE" ? <Repeat className="mt-1 h-3.5 w-3.5 shrink-0 text-zinc-400" aria-label="Repete" /> : null}
        </button>
      </li>
    );
  };

  const monthGrid = () => {
    const days = Array.from({ length: 42 }, (_, index) => addDays(range.start, index));
    const month = cursor.slice(0, 7);
    const selectedItems = byDay.get(selectedDay) ?? [];
    return (
      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div>
          <div className="grid grid-cols-7 text-center text-xs font-semibold text-zinc-500">
            {WEEKDAYS.map((day) => (
              <div key={day} className="py-1">
                {day}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {days.map((key) => {
              const dayItems = byDay.get(key) ?? [];
              const isToday = key === today;
              const isSelected = key === selectedDay;
              return (
                <button
                  type="button"
                  key={key}
                  onClick={() => setSelectedDay(key)}
                  onDoubleClick={() => setEditor(newEditor(key))}
                  aria-label={`${dayTitle(key)}: ${dayItems.length} compromisso(s)`}
                  className={`flex min-h-16 flex-col items-start rounded-md border p-1.5 text-left sm:min-h-20 ${
                    isSelected ? "border-[var(--brand-primary)] ring-1 ring-[var(--brand-primary)]" : "border-zinc-200"
                  } ${key.startsWith(month) ? "bg-white" : "bg-zinc-50 text-zinc-400"}`}
                >
                  <span
                    className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                      isToday ? "bg-[var(--brand-primary)] text-white" : ""
                    }`}
                  >
                    {Number(key.slice(8))}
                  </span>
                  <span className="mt-1 hidden w-full space-y-0.5 sm:block">
                    {dayItems.slice(0, 2).map((item) => (
                      <span
                        key={`${item.event.id}-${item.startAt}`}
                        className={`block truncate rounded px-1 text-[11px] leading-4 text-white ${item.event.status !== "SCHEDULED" ? "opacity-50 line-through" : ""}`}
                        style={{ background: AGENDA_CATEGORY_COLOR[item.event.category] }}
                      >
                        {item.event.title}
                      </span>
                    ))}
                    {dayItems.length > 2 ? <span className="block text-[11px] text-zinc-500">+{dayItems.length - 2}</span> : null}
                  </span>
                  <span className="mt-1 flex flex-wrap gap-0.5 sm:hidden">
                    {dayItems.slice(0, 4).map((item) => (
                      <span key={`${item.event.id}-${item.startAt}`} className="h-1.5 w-1.5 rounded-full" style={{ background: AGENDA_CATEGORY_COLOR[item.event.category] }} />
                    ))}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        <aside>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-zinc-900">{dayTitle(selectedDay)}</h3>
            <button type="button" onClick={() => setEditor(newEditor(selectedDay))} className="text-sm font-semibold text-[var(--brand-primary)] hover:underline">
              + Adicionar
            </button>
          </div>
          {selectedItems.length ? (
            <ul className="mt-3 space-y-2">{selectedItems.map((item) => renderRow(item))}</ul>
          ) : (
            <p className="mt-3 text-sm text-zinc-500">Nada marcado neste dia.</p>
          )}
        </aside>
      </div>
    );
  };

  const weekColumns = () => {
    const days = Array.from({ length: 7 }, (_, index) => addDays(range.start, index));
    return (
      <div className="grid gap-3 sm:grid-cols-7">
        {days.map((key) => (
          <div key={key} className={`rounded-lg border p-2 ${key === today ? "border-[var(--brand-primary)]" : "border-zinc-200"}`}>
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-zinc-600">
                {WEEKDAYS[weekday(key)]} {Number(key.slice(8))}
              </p>
              <button type="button" onClick={() => setEditor(newEditor(key))} aria-label={`Adicionar em ${dayTitle(key)}`} className="text-zinc-400 hover:text-zinc-700">
                <Plus className="h-4 w-4" />
              </button>
            </div>
            <ul className="mt-2 space-y-1.5">{(byDay.get(key) ?? []).map((item) => renderRow(item))}</ul>
          </div>
        ))}
      </div>
    );
  };

  const listView = () => (
    <div>
      <div className="mb-4 flex flex-wrap gap-2" role="tablist">
        {LIST_TABS.map((option) => (
          <button
            type="button"
            role="tab"
            aria-selected={tab === option.id}
            key={option.id}
            onClick={() => setTab(option.id)}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold ${tab === option.id ? "bg-[var(--brand-primary)] text-white" : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"}`}
          >
            {option.label}
          </button>
        ))}
      </div>
      {items.length ? (
        <ul className="space-y-2">{items.map((item) => renderRow(item, tab !== "today" && tab !== "tomorrow"))}</ul>
      ) : loading ? null : (
        <p className="rounded-lg border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500">Nenhum compromisso por aqui.</p>
      )}
    </div>
  );

  const toggleReminder = (minutes: number) => {
    if (!editor) return;
    const has = editor.reminders.includes(minutes);
    setEditor({ ...editor, reminders: has ? editor.reminders.filter((value) => value !== minutes) : [...editor.reminders, minutes] });
  };

  const input = "mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-[var(--brand-primary)] focus:outline-none";

  return (
    <div>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">{userFirstName ? `Agenda de ${userFirstName}` : "Agenda"}</h1>
          <p className="mt-1 text-sm text-zinc-600">
            Lembretes por e-mail {prefs.emailRemindersEnabled ? "ativados" : "desativados"} · fuso {tz}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setShowPrefs((value) => !value)}
            className="inline-flex items-center gap-1.5 rounded-md border border-zinc-300 px-3 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
          >
            <Settings className="h-4 w-4" aria-hidden /> Preferências
          </button>
          <button
            type="button"
            onClick={() => setEditor(newEditor(view === "month" ? selectedDay : today))}
            className="inline-flex items-center gap-1.5 rounded-md bg-[var(--brand-primary)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
          >
            <Plus className="h-4 w-4" aria-hidden /> Novo
          </button>
        </div>
      </header>

      {showPrefs ? (
        <section className="mt-4 grid gap-4 rounded-lg border border-zinc-200 bg-zinc-50 p-4 sm:grid-cols-3">
          <label className="flex items-center gap-2 text-sm text-zinc-800">
            <input type="checkbox" checked={prefs.emailRemindersEnabled} onChange={(event) => void savePrefs({ emailRemindersEnabled: event.target.checked })} />
            Receber lembretes por e-mail
          </label>
          <label className="text-sm text-zinc-700">
            Lembrete padrão
            <select
              className={input}
              value={prefs.defaultReminderMinutes === null ? "" : String(prefs.defaultReminderMinutes)}
              onChange={(event) => void savePrefs({ defaultReminderMinutes: event.target.value === "" ? null : Number(event.target.value) })}
            >
              <option value="">Sem lembrete</option>
              {REMINDER_OPTIONS.map((option) => (
                <option key={option.minutes} value={option.minutes}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-zinc-700">
            Fuso horário
            <select className={input} value={tz} onChange={(event) => void savePrefs({ timezone: event.target.value })}>
              {timezoneOptions(tz).map((zone) => (
                <option key={zone} value={zone}>
                  {zone}
                </option>
              ))}
            </select>
          </label>
        </section>
      ) : null}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-md border border-zinc-300 p-0.5" role="tablist" aria-label="Visualização">
          {(
            [
              ["month", "Mês"],
              ["week", "Semana"],
              ["list", "Lista"],
            ] as Array<[View, string]>
          ).map(([id, label]) => (
            <button
              type="button"
              role="tab"
              aria-selected={view === id}
              key={id}
              onClick={() => setView(id)}
              className={`rounded px-3 py-1.5 text-sm font-semibold ${view === id ? "bg-[var(--brand-primary)] text-white" : "text-zinc-700 hover:bg-zinc-100"}`}
            >
              {label}
            </button>
          ))}
        </div>
        {view !== "list" ? (
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => move(-1)} aria-label="Anterior" className="rounded p-1.5 hover:bg-zinc-100">
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => {
                setCursor(today);
                setSelectedDay(today);
              }}
              className="rounded border border-zinc-300 px-2.5 py-1 text-sm hover:bg-zinc-50"
            >
              Hoje
            </button>
            <button type="button" onClick={() => move(1)} aria-label="Próximo" className="rounded p-1.5 hover:bg-zinc-100">
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        ) : null}
        <h2 className="text-lg font-semibold capitalize text-zinc-900">{periodTitle}</h2>
        <div className="ml-auto flex flex-wrap gap-2">
          <label className="relative">
            <span className="sr-only">Buscar</span>
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-zinc-400" aria-hidden />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar"
              className="w-40 rounded-md border border-zinc-300 py-2 pl-8 pr-2 text-sm sm:w-52"
            />
          </label>
          <select
            aria-label="Categoria"
            value={category}
            onChange={(event) => setCategory(event.target.value as AgendaCategory | "")}
            className="rounded-md border border-zinc-300 px-2 py-2 text-sm"
          >
            <option value="">Todas as categorias</option>
            {AGENDA_CATEGORIES.map((value) => (
              <option key={value} value={value}>
                {AGENDA_CATEGORY_LABEL[value]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error ? <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      <div className={`mt-5 ${loading ? "opacity-60" : ""}`} aria-busy={loading}>
        {view === "month" ? monthGrid() : view === "week" ? weekColumns() : listView()}
      </div>

      {detail ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center" onClick={() => setDetail(null)}>
          <div role="dialog" aria-modal="true" aria-labelledby="agenda-detail-title" className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: AGENDA_CATEGORY_COLOR[detail.event.category] }}>
                  {AGENDA_CATEGORY_LABEL[detail.event.category]}
                </p>
                <h3 id="agenda-detail-title" className={`mt-1 text-lg font-semibold ${detail.event.status !== "SCHEDULED" ? "text-zinc-400 line-through" : "text-zinc-900"}`}>
                  {detail.event.title}
                </h3>
              </div>
              <button type="button" onClick={() => setDetail(null)} aria-label="Fechar" className="text-zinc-400 hover:text-zinc-700">
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mt-2 text-sm text-zinc-700">{whenLabel(new Date(detail.startAt), detail.event.isAllDay, detail.event.isAllDay ? detail.event.timezone : tz)}</p>
            {detail.event.location ? (
              <p className="mt-1 flex items-center gap-1 text-sm text-zinc-600">
                <MapPin className="h-4 w-4" aria-hidden /> {detail.event.location}
              </p>
            ) : null}
            {detail.event.recurrence !== "NONE" ? <p className="mt-1 text-sm text-zinc-600">Repete: {RECURRENCE_LABEL[detail.event.recurrence]}</p> : null}
            <p className="mt-1 text-sm text-zinc-600">
              Lembretes: {detail.event.reminderOffsets.length ? detail.event.reminderOffsets.map(reminderLabel).join(", ") : "nenhum"}
            </p>
            {detail.event.description ? <p className="mt-3 whitespace-pre-wrap text-sm text-zinc-700">{detail.event.description}</p> : null}
            {detail.event.status !== "SCHEDULED" ? (
              <p className="mt-3 text-sm font-semibold text-zinc-500">{detail.event.status === "COMPLETED" ? "Concluído" : "Cancelado"}</p>
            ) : null}
            <div className="mt-5 flex flex-wrap gap-2">
              {detail.event.status === "SCHEDULED" ? (
                <>
                  <button type="button" onClick={() => setEditor(editEditor(detail.event))} className="rounded-md bg-[var(--brand-primary)] px-3 py-2 text-sm font-semibold text-white">
                    Editar
                  </button>
                  <button type="button" onClick={() => void runAction(detail, "complete")} className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-50">
                    Concluir
                  </button>
                  <button type="button" onClick={() => void runAction(detail, "cancel")} className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-50">
                    Cancelar compromisso
                  </button>
                </>
              ) : (
                <button type="button" onClick={() => void runAction(detail, "reopen")} className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-50">
                  Reabrir
                </button>
              )}
              {confirmDelete ? (
                <button type="button" onClick={() => void runAction(detail, "delete")} className="rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white">
                  Confirmar exclusão
                </button>
              ) : (
                <button type="button" onClick={() => setConfirmDelete(true)} className="rounded-md px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50">
                  Excluir
                </button>
              )}
            </div>
            {detail.event.recurrence !== "NONE" ? <p className="mt-3 text-xs text-zinc-500">Ações em um compromisso que se repete valem para todas as datas.</p> : null}
          </div>
        </div>
      ) : null}

      {editor ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center" onClick={() => setEditor(null)}>
          <form
            role="dialog"
            aria-modal="true"
            aria-labelledby="agenda-editor-title"
            onSubmit={(event) => void saveEditor(event)}
            onClick={(event) => event.stopPropagation()}
            className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl bg-white p-5 shadow-xl"
          >
            <div className="flex items-center justify-between">
              <h3 id="agenda-editor-title" className="text-lg font-semibold text-zinc-900">
                {editor.mode === "new" ? "Novo compromisso" : "Editar compromisso"}
              </h3>
              <button type="button" onClick={() => setEditor(null)} aria-label="Fechar" className="text-zinc-400 hover:text-zinc-700">
                <X className="h-5 w-5" />
              </button>
            </div>
            <label className="mt-4 block text-sm font-medium text-zinc-700">
              Título
              <input
                autoFocus
                required
                maxLength={200}
                value={editor.title}
                onChange={(event) => setEditor({ ...editor, title: event.target.value })}
                placeholder="Ex.: Dentista, aniversário da Ana, pagar luz"
                className={input}
              />
            </label>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <label className="block text-sm font-medium text-zinc-700">
                Data
                <input type="date" required value={editor.date} onChange={(event) => setEditor({ ...editor, date: event.target.value })} className={input} />
              </label>
              <label className="block text-sm font-medium text-zinc-700">
                Hora <span className="font-normal text-zinc-400">(opcional)</span>
                <input type="time" value={editor.time} onChange={(event) => setEditor({ ...editor, time: event.target.value })} className={input} />
              </label>
            </div>
            {!editor.time ? <p className="mt-1 text-xs text-zinc-500">Sem hora, o compromisso vale o dia inteiro (lembretes contam a partir das 9h).</p> : null}

            {editor.more ? (
              <div className="mt-3 space-y-3">
                {editor.time ? (
                  <label className="block text-sm font-medium text-zinc-700">
                    Término <span className="font-normal text-zinc-400">(opcional)</span>
                    <input type="time" value={editor.endTime} onChange={(event) => setEditor({ ...editor, endTime: event.target.value })} className={input} />
                  </label>
                ) : null}
                <label className="block text-sm font-medium text-zinc-700">
                  Local
                  <input maxLength={300} value={editor.location} onChange={(event) => setEditor({ ...editor, location: event.target.value })} className={input} />
                </label>
                <label className="block text-sm font-medium text-zinc-700">
                  Descrição
                  <textarea maxLength={2000} rows={3} value={editor.description} onChange={(event) => setEditor({ ...editor, description: event.target.value })} className={input} />
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="block text-sm font-medium text-zinc-700">
                    Categoria
                    <select value={editor.category} onChange={(event) => setEditor({ ...editor, category: event.target.value as AgendaCategory })} className={input}>
                      {AGENDA_CATEGORIES.map((value) => (
                        <option key={value} value={value}>
                          {AGENDA_CATEGORY_LABEL[value]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-sm font-medium text-zinc-700">
                    Repetir
                    <select value={editor.recurrence} onChange={(event) => setEditor({ ...editor, recurrence: event.target.value as Recurrence })} className={input}>
                      {RECURRENCES.map((value) => (
                        <option key={value} value={value}>
                          {RECURRENCE_LABEL[value]}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <fieldset>
                  <legend className="text-sm font-medium text-zinc-700">Lembretes por e-mail</legend>
                  <div className="mt-1 grid grid-cols-2 gap-1">
                    {REMINDER_OPTIONS.map((option) => (
                      <label key={option.minutes} className="flex items-center gap-2 text-sm text-zinc-700">
                        <input type="checkbox" checked={editor.reminders.includes(option.minutes)} onChange={() => toggleReminder(option.minutes)} />
                        {option.label}
                      </label>
                    ))}
                  </div>
                  {!prefs.emailRemindersEnabled ? <p className="mt-1 text-xs text-amber-700">Os lembretes por e-mail estão desativados nas suas preferências.</p> : null}
                </fieldset>
              </div>
            ) : (
              <button type="button" onClick={() => setEditor({ ...editor, more: true })} className="mt-3 text-sm font-semibold text-[var(--brand-primary)] hover:underline">
                Mais opções (local, categoria, repetir, lembretes)
              </button>
            )}

            {formError ? <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</p> : null}
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setEditor(null)} className="rounded-md px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-100">
                Voltar
              </button>
              <button type="submit" disabled={saving} className="rounded-md bg-[var(--brand-primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
                {saving ? "Salvando…" : "Salvar"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
