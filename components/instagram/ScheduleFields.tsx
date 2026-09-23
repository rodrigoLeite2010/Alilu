"use client";

import { useId } from "react";
import { zonedDateTimeToUtc } from "@/lib/instagram/schedule-time";

export interface ScheduleValue {
  date: string; // YYYY-MM-DD, no fuso do usuário
  time: string; // HH:mm, no fuso do usuário
}

/** Converte a escolha da tela para ISO UTC; `null` com mensagem quando inválida/no passado. */
export function scheduleValueToIso(
  value: ScheduleValue,
  timeZone: string,
  now: number = Date.now(),
): { iso: string } | { error: string } {
  if (!value.date || !value.time) return { error: "Escolha a data e o horário do agendamento." };
  let instant: Date;
  try {
    instant = zonedDateTimeToUtc(value.date, value.time, timeZone);
  } catch {
    return { error: "Data ou horário inválido." };
  }
  if (instant.getTime() <= now + 60_000) {
    return { error: "Escolha um horário pelo menos 1 minuto no futuro." };
  }
  return { iso: instant.toISOString() };
}

/** Data e hora separadas (inputs nativos — bons no celular), sempre no fuso do usuário. */
export function ScheduleFields({
  value,
  onChange,
  timeZone,
  disabled,
}: {
  value: ScheduleValue;
  onChange: (value: ScheduleValue) => void;
  timeZone: string;
  disabled?: boolean;
}) {
  const dateId = useId();
  const timeId = useId();
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor={dateId} className="text-xs font-medium text-zinc-700">
            Data
          </label>
          <input
            id={dateId}
            type="date"
            value={value.date}
            disabled={disabled}
            onChange={(event) => onChange({ ...value, date: event.target.value })}
            className="h-11 rounded-md border border-zinc-300 px-2 text-sm text-zinc-900"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={timeId} className="text-xs font-medium text-zinc-700">
            Hora
          </label>
          <input
            id={timeId}
            type="time"
            value={value.time}
            disabled={disabled}
            onChange={(event) => onChange({ ...value, time: event.target.value })}
            className="h-11 rounded-md border border-zinc-300 px-2 text-sm text-zinc-900"
          />
        </div>
      </div>
      <p className="text-xs text-zinc-500">Horário de {timeZone.replace(/_/g, " ")}.</p>
    </div>
  );
}
