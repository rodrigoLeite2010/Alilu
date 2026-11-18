"use client";

import type { RadarPreview } from "@/lib/instagram-radar/backend/radar-service";
import { formatInTimeZone } from "@/lib/instagram/schedule-time";
import { WEEKDAY_SHORT, intervalLabel } from "@/lib/instagram-radar/schedule";

/**
 * Prévia da programação: conta, quantidades, frequência, janela, próximos
 * horários e estimativa de duração. É PREVISÃO: considera os agendamentos já
 * existentes na conta, mas não garante que cada publicação terá sucesso.
 */
export function RadarPreviewCard({ preview, title = "Prévia do agendamento" }: { preview: RadarPreview; title?: string }) {
  const s = preview.schedule;
  const days = s.weekdays.length === 7 ? "Todos os dias" : s.weekdays.map((day) => WEEKDAY_SHORT[day]).join(", ");
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4" aria-label={title}>
      <h3 className="font-semibold text-zinc-900">{title}</h3>
      <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
        <Row label="Conta Instagram" value={`@${preview.account.username ?? "?"}${preview.account.status === "connected" ? "" : " (desconectada)"}`} />
        <Row label="Links" value={String(preview.linksCount)} />
        <Row label="Arquivos prontos" value={String(preview.readyCount)} />
        <Row label="Aguardando arquivo autorizado" value={String(preview.awaitingFileCount)} />
        <Row label="Publicações por dia" value={String(s.postsPerDay)} />
        <Row label="Intervalo mínimo" value={intervalLabel(s.intervalMinutes)} />
        <Row label="Dias" value={days} />
        <Row label="Janela" value={`${s.windowStart} às ${s.windowEnd} (${s.timezone})`} />
        <Row label="Horários" value={preview.dailyTimesLabel} />
        <Row label="Limite combinado da conta" value={`${preview.accountDailyCap} por dia`} />
      </dl>
      {preview.nextSlots.length > 0 ? (
        <div className="mt-3">
          <p className="text-sm font-medium text-zinc-800">Próximos horários</p>
          <ul className="mt-1 grid grid-cols-2 gap-1 text-xs text-zinc-700 sm:grid-cols-3">
            {preview.nextSlots.map((at) => (
              <li key={at} className="rounded bg-zinc-50 px-2 py-1">
                {formatInTimeZone(at, s.timezone)}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="mt-3 text-sm text-amber-800">Nenhum horário disponível com esta configuração.</p>
      )}
      <p className="mt-3 text-sm text-zinc-700">
        {preview.readyCount > 0
          ? `Duração estimada para publicar os ${preview.readyCount} vídeo(s) prontos: ${preview.estimatedDaysForReady} dia(s)`
          : preview.linksCount > 0
            ? `Duração estimada para os ${preview.linksCount} link(s), quando estiverem prontos: ${preview.estimatedDaysForAll} dia(s)`
            : "Adicione links para ver a previsão de distribuição"}
        {preview.linksCount > 0 ? ", desde que todos os vídeos permaneçam elegíveis e as publicações sejam concluídas." : "."}
      </p>
      {preview.projected.length > 0 ? (
        <details className="mt-2 text-xs text-zinc-700">
          <summary className="cursor-pointer font-medium">Previsão de distribuição dos vídeos</summary>
          <ol className="mt-1 space-y-0.5">
            {preview.projected.slice(0, 60).map((entry) => (
              <li key={`${entry.position}-${entry.at}`}>
                Vídeo {entry.position} — {formatInTimeZone(entry.at, s.timezone)}
              </li>
            ))}
          </ol>
        </details>
      ) : null}
      {preview.warnings.length > 0 ? (
        <ul className="mt-3 space-y-1 rounded-md bg-amber-50 p-3 text-xs text-amber-900">
          {preview.warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      ) : null}
      <p className="mt-2 text-xs text-zinc-500">Previsão: considera os agendamentos já existentes nesta conta, mas não garante que todas as publicações terão sucesso.</p>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 border-b border-zinc-100 py-1">
      <dt className="text-zinc-600">{label}</dt>
      <dd className="text-right font-medium text-zinc-900">{value}</dd>
    </div>
  );
}
