"use client";

import { useMemo } from "react";
import {
  RADAR_INTERVAL_LABEL,
  RADAR_INTERVAL_OPTIONS,
  RADAR_MAX_POSTS_PER_DAY,
  RadarScheduleError,
  WEEKDAY_SHORT,
  crossesMidnight,
  describeDailyTimes,
  normalizeRadarSchedule,
  type RadarIntervalMinutes,
  type RadarScheduleConfig,
} from "@/lib/instagram-radar/schedule";

export const radarInputClass = "mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none";
export const radarLabelClass = "block text-sm font-medium text-zinc-800";
const TIMEZONES = ["America/Sao_Paulo", "America/Manaus", "America/Belem", "America/Fortaleza", "America/Recife", "America/Cuiaba", "America/Rio_Branco", "America/Noronha", "Europe/Lisbon", "UTC"];
const POSTS_OPTIONS = Array.from({ length: RADAR_MAX_POSTS_PER_DAY }, (_, index) => index + 1);

/** Validação local (mesma função do servidor): erro + sugestões, ou os horários do dia. */
export function useRadarScheduleCheck(value: RadarScheduleConfig): { ok: true; times: string } | { ok: false; message: string; suggestions: string[] } {
  return useMemo(() => {
    try {
      const normalized = normalizeRadarSchedule(value as unknown as Record<string, unknown>);
      return { ok: true as const, times: describeDailyTimes(normalized) };
    } catch (error) {
      if (error instanceof RadarScheduleError) return { ok: false as const, message: error.message, suggestions: error.suggestions };
      return { ok: false as const, message: "Configuração inválida.", suggestions: [] };
    }
  }, [value]);
}

/**
 * Programação do radar: quantas publicações por dia (1–10), intervalo mínimo
 * (lista fechada), janela (início/fim), dias da semana, fuso e data de início.
 * Configuração incompatível mostra o motivo e sugestões — nunca é "ajustada" sozinha.
 */
export function RadarScheduleFields({ value, onChange }: { value: RadarScheduleConfig; onChange: (next: RadarScheduleConfig) => void }) {
  const set = <K extends keyof RadarScheduleConfig>(key: K, next: RadarScheduleConfig[K]) => onChange({ ...value, [key]: next });
  const check = useRadarScheduleCheck(value);
  const toggleDay = (day: number) => set("weekdays", value.weekdays.includes(day) ? value.weekdays.filter((item) => item !== day) : [...value.weekdays, day].sort());

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={radarLabelClass}>
          Quantas publicações por dia?
          <select className={radarInputClass} value={value.postsPerDay} onChange={(event) => set("postsPerDay", Number(event.target.value))} required>
            {POSTS_OPTIONS.map((count) => (
              <option key={count} value={count}>
                {count} {count === 1 ? "publicação" : "publicações"}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-xs font-normal text-zinc-500">Limite do Radar (1 a 10). Os limites reais da Meta também são respeitados.</span>
        </label>
        <label className={radarLabelClass}>
          Qual o intervalo mínimo entre as publicações?
          <select className={radarInputClass} value={value.intervalMinutes} onChange={(event) => set("intervalMinutes", Number(event.target.value) as RadarIntervalMinutes)} required>
            {RADAR_INTERVAL_OPTIONS.map((minutes) => (
              <option key={minutes} value={minutes}>
                {RADAR_INTERVAL_LABEL[minutes]}
              </option>
            ))}
          </select>
        </label>
        <label className={radarLabelClass}>
          Horário inicial
          <input type="time" className={radarInputClass} value={value.windowStart} onChange={(event) => set("windowStart", event.target.value)} required />
        </label>
        <label className={radarLabelClass}>
          Horário final
          <input type="time" className={radarInputClass} value={value.windowEnd} onChange={(event) => set("windowEnd", event.target.value)} required />
          {crossesMidnight(value.windowStart, value.windowEnd) ? (
            <span className="mt-1 block text-xs font-normal text-zinc-500">A janela atravessa a meia-noite (termina no dia seguinte).</span>
          ) : null}
        </label>
        <label className={radarLabelClass}>
          Fuso horário
          <select className={radarInputClass} value={value.timezone} onChange={(event) => set("timezone", event.target.value)}>
            {[...new Set([value.timezone, ...TIMEZONES])].map((zone) => (
              <option key={zone} value={zone}>
                {zone}
              </option>
            ))}
          </select>
        </label>
        <label className={radarLabelClass}>
          Data de início
          <input type="date" className={radarInputClass} value={value.startDate ?? ""} onChange={(event) => set("startDate", event.target.value || null)} />
          <span className="mt-1 block text-xs font-normal text-zinc-500">Vazio = a partir de hoje.</span>
        </label>
      </div>
      <div>
        <span className={radarLabelClass}>Dias da semana</span>
        <div className="mt-2 flex flex-wrap gap-2">
          {WEEKDAY_SHORT.map((label, day) => (
            <button
              key={label}
              type="button"
              aria-pressed={value.weekdays.includes(day)}
              onClick={() => toggleDay(day)}
              className={`min-h-9 rounded-md px-3 py-1.5 text-sm font-medium ring-1 ring-inset ${value.weekdays.includes(day) ? "bg-zinc-900 text-white ring-zinc-900" : "bg-white text-zinc-700 ring-zinc-300"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {check.ok ? (
        <p className="rounded-md bg-teal-50 p-3 text-sm text-teal-900" role="status">
          Horários de cada dia: <strong>{check.times}</strong>.
        </p>
      ) : (
        <div className="rounded-md bg-amber-50 p-3 text-sm text-amber-900" role="alert">
          <p className="font-medium">{check.message}</p>
          {check.suggestions.length > 0 ? (
            <ul className="mt-1 list-disc pl-5">
              {check.suggestions.map((suggestion) => (
                <li key={suggestion}>{suggestion}</li>
              ))}
            </ul>
          ) : null}
        </div>
      )}
    </div>
  );
}
