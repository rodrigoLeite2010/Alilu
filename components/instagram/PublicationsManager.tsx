"use client";

import { useMemo, useState } from "react";
import type { InstagramPostStatus } from "@/lib/instagram/backend/instagram-post-repository";
import { getBrowserTimeZone, utcToZonedInputs } from "@/lib/instagram/schedule-time";
import { CalendarPostCard, type CalendarPostCardData } from "./CalendarPostCard";

type FilterId = "ALL" | "DRAFT" | "SCHEDULED" | "PUBLISHED" | "FAILED" | "CANCELLED";

const FILTERS: Array<{ id: FilterId; label: string; statuses: InstagramPostStatus[] | null }> = [
  { id: "ALL", label: "Todas", statuses: null },
  { id: "DRAFT", label: "Rascunhos", statuses: ["DRAFT"] },
  { id: "SCHEDULED", label: "Agendadas", statuses: ["SCHEDULED", "PROCESSING"] },
  { id: "PUBLISHED", label: "Publicadas", statuses: ["PUBLISHED"] },
  { id: "FAILED", label: "Falharam", statuses: ["FAILED", "NEEDS_REVIEW"] },
  { id: "CANCELLED", label: "Canceladas", statuses: ["CANCELLED"] },
];

const WEEKDAYS = ["D", "S", "T", "Q", "Q", "S", "S"];
const MONTHS = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

/** Dia (YYYY-MM-DD) em que a publicação aparece no calendário, no fuso em que foi agendada. */
export function publicationDayKey(post: CalendarPostCardData): string {
  const reference = post.scheduledAtUtc ?? post.publishedAt ?? post.createdAt;
  return utcToZonedInputs(reference, post.timezone ?? "America/Sao_Paulo").date;
}

function matchesFilter(post: CalendarPostCardData, filter: FilterId): boolean {
  const statuses = FILTERS.find((item) => item.id === filter)?.statuses;
  return !statuses || statuses.includes(post.status);
}

/**
 * "Minhas publicações": filtros por status, lista e calendário mensal.
 * Tudo client-side sobre a lista já carregada pelo servidor (até 200
 * publicações por usuário) — sem polling: o scheduler roda no servidor.
 */
export function PublicationsManager({
  initialPosts,
  userId,
}: {
  initialPosts: CalendarPostCardData[];
  userId: string;
}) {
  const [posts, setPosts] = useState(initialPosts);
  const [filter, setFilter] = useState<FilterId>("ALL");
  const [view, setView] = useState<"list" | "calendar">("list");
  const [month, setMonth] = useState<{ year: number; month: number } | null>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const counts = useMemo(() => {
    const result = {} as Record<FilterId, number>;
    for (const item of FILTERS) result[item.id] = posts.filter((post) => matchesFilter(post, item.id)).length;
    return result;
  }, [posts]);

  const filtered = posts.filter((post) => matchesFilter(post, filter));
  const byDay = useMemo(() => {
    const map = new Map<string, CalendarPostCardData[]>();
    for (const post of filtered) {
      const key = publicationDayKey(post);
      map.set(key, [...(map.get(key) ?? []), post]);
    }
    return map;
  }, [filtered]);

  const visible = view === "calendar" && selectedDay ? byDay.get(selectedDay) ?? [] : filtered;

  function openCalendar() {
    setView("calendar");
    if (!month) {
      const today = utcToZonedInputs(new Date(), getBrowserTimeZone()).date;
      setMonth({ year: Number(today.slice(0, 4)), month: Number(today.slice(5, 7)) });
    }
  }

  function shiftMonth(delta: number) {
    if (!month) return;
    const index = month.year * 12 + (month.month - 1) + delta;
    setMonth({ year: Math.floor(index / 12), month: (index % 12) + 1 });
    setSelectedDay(null);
  }

  function updatePost(next: CalendarPostCardData) {
    setPosts((list) => list.map((post) => (post.id === next.id ? next : post)));
  }

  function removePost(postId: string) {
    setPosts((list) => list.filter((post) => post.id !== postId));
  }

  const monthCells = (() => {
    if (!month) return [];
    const first = new Date(Date.UTC(month.year, month.month - 1, 1));
    const daysInMonth = new Date(Date.UTC(month.year, month.month, 0)).getUTCDate();
    const cells: Array<string | null> = Array.from({ length: first.getUTCDay() }, () => null);
    for (let day = 1; day <= daysInMonth; day += 1) {
      cells.push(`${month.year}-${String(month.month).padStart(2, "0")}-${String(day).padStart(2, "0")}`);
    }
    return cells;
  })();

  return (
    <div className="space-y-4">
      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <div role="tablist" aria-label="Filtrar publicações" className="flex min-w-max gap-1.5">
          {FILTERS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={filter === item.id}
              onClick={() => {
                setFilter(item.id);
                setSelectedDay(null);
              }}
              className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-700 ${
                filter === item.id ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
              }`}
            >
              {item.label} <span className="opacity-70">{counts[item.id]}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-1 rounded-lg bg-zinc-100 p-1 text-sm sm:w-fit">
        <button
          type="button"
          aria-pressed={view === "list"}
          onClick={() => setView("list")}
          className={`flex-1 rounded-md px-3 py-1.5 font-medium sm:flex-none ${view === "list" ? "bg-white shadow-sm" : "text-zinc-600"}`}
        >
          Lista
        </button>
        <button
          type="button"
          aria-pressed={view === "calendar"}
          onClick={openCalendar}
          className={`flex-1 rounded-md px-3 py-1.5 font-medium sm:flex-none ${view === "calendar" ? "bg-white shadow-sm" : "text-zinc-600"}`}
        >
          Calendário
        </button>
      </div>

      {view === "calendar" && month ? (
        <section aria-label="Calendário de publicações" className="rounded-lg border border-zinc-200 p-3">
          <div className="mb-3 flex items-center justify-between">
            <button type="button" onClick={() => shiftMonth(-1)} aria-label="Mês anterior" className="rounded-md px-3 py-1.5 text-lg hover:bg-zinc-100">
              ‹
            </button>
            <p className="text-sm font-semibold text-zinc-900">
              {MONTHS[month.month - 1].charAt(0).toUpperCase() + MONTHS[month.month - 1].slice(1)} de {month.year}
            </p>
            <button type="button" onClick={() => shiftMonth(1)} aria-label="Próximo mês" className="rounded-md px-3 py-1.5 text-lg hover:bg-zinc-100">
              ›
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-xs text-zinc-500">
            {WEEKDAYS.map((day, index) => (
              <span key={index} aria-hidden>
                {day}
              </span>
            ))}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-1">
            {monthCells.map((key, index) => {
              if (!key) return <span key={`empty-${index}`} />;
              const dayPosts = byDay.get(key) ?? [];
              const selected = selectedDay === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelectedDay(selected ? null : key)}
                  aria-pressed={selected}
                  aria-label={`Dia ${Number(key.slice(8))}: ${dayPosts.length} publicação(ões)`}
                  className={`flex aspect-square flex-col items-center justify-center gap-0.5 rounded-md text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-700 ${
                    selected ? "bg-zinc-900 text-white" : dayPosts.length ? "bg-teal-50 text-zinc-900 hover:bg-teal-100" : "text-zinc-700 hover:bg-zinc-100"
                  }`}
                >
                  {Number(key.slice(8))}
                  {dayPosts.length ? (
                    <span className="flex gap-0.5" aria-hidden>
                      {dayPosts.slice(0, 3).map((post) => (
                        <span
                          key={post.id}
                          className={`h-1.5 w-1.5 rounded-full ${
                            post.status === "PUBLISHED" ? "bg-teal-600" : post.status === "FAILED" ? "bg-red-500" : post.status === "SCHEDULED" || post.status === "PROCESSING" ? "bg-blue-500" : "bg-zinc-400"
                          } ${selected ? "ring-1 ring-white" : ""}`}
                        />
                      ))}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-zinc-500">
            {selectedDay
              ? `Mostrando ${visible.length} publicação(ões) de ${selectedDay.split("-").reverse().join("/")}.`
              : "Toque em um dia para ver as publicações."}
          </p>
        </section>
      ) : null}

      {visible.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-300 px-4 py-10 text-center">
          <p className="text-sm text-zinc-600">
            {posts.length === 0 ? "Nenhuma publicação ainda." : "Nenhuma publicação neste filtro."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((post) => (
            <CalendarPostCard key={post.id} post={post} userId={userId} onChange={updatePost} onRemove={removePost} />
          ))}
        </div>
      )}
    </div>
  );
}
