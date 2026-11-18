"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { RadarDashboardDto } from "@/lib/instagram-radar/backend/radar-dto";
import type { RadarScheduleConfig } from "@/lib/instagram-radar/schedule";
import { VIDEO_QUEUE_STATUS_LABEL } from "@/lib/video-queue/types";
import { formatInTimeZone } from "@/lib/instagram/schedule-time";
import { RadarCaptionFields, type RadarCaptionValue } from "./RadarCaptionFields";
import { readRadarApiError } from "./RadarCreateForm";
import { RadarItemRow } from "./RadarItemRow";
import { RadarLinksInput, useParsedLinks, type RadarLinksMode } from "./RadarLinksInput";
import { RadarPreviewCard } from "./RadarPreviewCard";
import { RadarScheduleFields, useRadarScheduleCheck } from "./RadarScheduleFields";

const EVENT_LABEL: Record<string, string> = {
  created: "Radar criado",
  links_added: "Links adicionados",
  activated: "Radar ativado",
  resumed: "Radar retomado",
  paused: "Radar pausado",
  paused_by_system: "Radar pausado automaticamente",
  settings_updated: "Frequência/legendas alteradas",
  reordered: "Ordem alterada",
  released: "Publicações futuras replanejadas",
  retry: "Reprocessamento",
  imported: "Vídeo importado",
  import_retry: "Nova tentativa agendada",
  import_failed: "Falha na importação",
  waiting_file: "Aguardando arquivo",
  file_uploaded: "Arquivo enviado",
  scheduled: "Publicação agendada",
  published: "Publicado",
  planning_failed: "Não agendado",
  cancelled: "Cancelado",
  removed: "Link removido",
  publication_cancelled: "Publicação cancelada fora do radar",
  publication_removed: "Publicação excluída fora do radar",
  archived: "Radar cancelado",
};

async function fetchRadarDashboard(radarId: string): Promise<{ data: RadarDashboardDto | null; error: string | null }> {
  try {
    const response = await fetch(`/api/instagram-radars/${radarId}`, { cache: "no-store" });
    if (!response.ok) return { data: null, error: await readRadarApiError(response, "Não foi possível carregar o radar.") };
    return { data: (await response.json()) as RadarDashboardDto, error: null };
  } catch {
    return { data: null, error: "Não foi possível carregar o radar." };
  }
}

type Tab = "videos" | "programacao" | "adicionar" | "configuracoes" | "historico";

export function RadarPanel({ radarId, userId, justCreated = false, isAdmin = false }: { radarId: string; userId: string; justCreated?: boolean; isAdmin?: boolean }) {
  const router = useRouter();
  const [data, setData] = useState<RadarDashboardDto | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(justCreated ? "Radar criado como rascunho. Confira a programação e clique em “Ativar radar” para começar a publicar." : null);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<Tab>(justCreated ? "programacao" : "videos");

  const apply = useCallback((result: { data: RadarDashboardDto | null; error: string | null }) => {
    if (result.data) {
      setData(result.data);
      setLoadError(null);
    } else setLoadError(result.error);
  }, []);
  const load = useCallback(async () => apply(await fetchRadarDashboard(radarId)), [apply, radarId]);

  useEffect(() => {
    let cancelled = false;
    const refresh = () =>
      fetchRadarDashboard(radarId).then((result) => {
        if (!cancelled) apply(result);
      });
    void refresh();
    // Só para manter a tela atualizada: o radar roda no servidor mesmo com o navegador fechado.
    const timer = setInterval(() => void refresh(), 30_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [apply, radarId]);

  const patch = async (body: Record<string, unknown>, fallback: string, success?: string) => {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/instagram-radars/${radarId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!response.ok) {
        setMessage(await readRadarApiError(response, fallback));
        return false;
      }
      setData((await response.json()) as RadarDashboardDto);
      if (success) setMessage(success);
      return true;
    } catch {
      setMessage(fallback);
      return false;
    } finally {
      setBusy(false);
    }
  };

  if (loadError && !data) return <p className="rounded-md bg-red-50 p-3 text-sm text-red-800">{loadError}</p>;
  if (!data) return <p className="text-sm text-zinc-500">Carregando radar…</p>;

  const { radar, counts, account, preview } = data;
  const tz = radar.schedule.timezone;
  const visibleItems = data.items.filter((item) => item.status !== "CANCELLED");

  const move = async (itemId: string, direction: -1 | 1) => {
    const ids = visibleItems.map((item) => item.id);
    const index = ids.indexOf(itemId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    await patch({ action: "reorder", order: ids }, "Não foi possível reordenar.");
  };

  const retry = async (itemIds: string[] | null) => {
    setBusy(true);
    try {
      const response = await fetch(`/api/video-queues/${radarId}/retry`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ itemIds }) });
      setMessage(response.ok ? "Itens com erro voltaram para a fila." : await readRadarApiError(response, "Não foi possível reprocessar."));
      await load();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-teal-800">Radar Instagram</p>
          <h1 className="text-xl font-semibold text-zinc-900">{radar.name}</h1>
          <p className="mt-1 text-sm text-zinc-600">
            Destino: <strong>@{account?.username ?? "conta removida"}</strong>
            {account && account.status !== "connected" ? <span className="text-amber-700"> (desconectada — reconecte a MESMA conta)</span> : null} · Status:{" "}
            <strong>{VIDEO_QUEUE_STATUS_LABEL[radar.status]}</strong>
          </p>
          {radar.pauseReason ? <p className="mt-1 text-sm text-amber-800">{radar.pauseReason}</p> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {radar.status === "DRAFT" ? (
            <button type="button" disabled={busy} className="min-h-11 rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" onClick={() => patch({ action: "activate" }, "Não foi possível ativar.", "Radar ativado. As publicações seguem a programação, mesmo com o navegador fechado.")}>
              Ativar radar
            </button>
          ) : null}
          {radar.status === "ACTIVE" ? (
            <button type="button" disabled={busy} className="min-h-11 rounded-md px-4 py-2 text-sm font-semibold ring-1 ring-zinc-300" onClick={() => patch({ action: "pause" }, "Não foi possível pausar.", "Radar pausado. Nada novo será publicado; o histórico foi mantido.")}>
              Pausar
            </button>
          ) : null}
          {radar.status === "PAUSED" ? (
            <button type="button" disabled={busy} className="min-h-11 rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white" onClick={() => patch({ action: "resume" }, "Não foi possível retomar.", "Radar retomado.")}>
              Retomar
            </button>
          ) : null}
          <button
            type="button"
            disabled={busy}
            className="min-h-11 rounded-md px-4 py-2 text-sm font-semibold text-red-700 ring-1 ring-red-200"
            onClick={async () => {
              if (!window.confirm("Cancelar este radar? As publicações futuras que ainda não começaram serão desfeitas. O que já foi publicado continua no Instagram e no histórico.")) return;
              if (await patch({ action: "archive" }, "Não foi possível cancelar o radar.")) router.push("/instagram/radar");
            }}
          >
            Cancelar radar
          </button>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
        {[
          ["Links", counts.total],
          ["Importados", counts.imported],
          ["Aguardando", counts.pending],
          ["Prontos", counts.ready],
          ["Agendados", counts.scheduled],
          ["Publicados", counts.published],
          ["Erros", counts.errors],
        ].map(([label, value]) => (
          <div key={label as string} className="rounded-md bg-zinc-50 p-3">
            <dt className="text-xs text-zinc-600">{label}</dt>
            <dd className="text-lg font-semibold text-zinc-900">{value}</dd>
          </div>
        ))}
        <div className="rounded-md bg-zinc-50 p-3">
          <dt className="text-xs text-zinc-600">Próxima publicação</dt>
          <dd className="text-sm font-semibold text-zinc-900">{data.nextPublicationAt ? formatInTimeZone(data.nextPublicationAt, tz) : "—"}</dd>
        </div>
      </dl>

      {message ? (
        <p className="rounded-md bg-sky-50 p-3 text-sm text-sky-900" role="status">
          {message}
        </p>
      ) : null}

      <nav className="flex flex-wrap gap-2 border-b border-zinc-200 pb-2" aria-label="Seções do radar">
        {(
          [
            ["videos", "Vídeos"],
            ["programacao", "Programação"],
            ["adicionar", "Adicionar links"],
            ["configuracoes", "Frequência e legendas"],
            ["historico", "Histórico"],
          ] as Array<[Tab, string]>
        ).map(([id, label]) => (
          <button key={id} type="button" onClick={() => setTab(id)} className={`rounded-md px-3 py-1.5 text-sm font-medium ${tab === id ? "bg-zinc-900 text-white" : "text-zinc-700 hover:bg-zinc-100"}`}>
            {label}
          </button>
        ))}
      </nav>

      {tab === "videos" ? (
        <div className="space-y-3">
          {counts.errors > 0 ? (
            <button type="button" disabled={busy} className="rounded-md px-3 py-1.5 text-sm font-semibold ring-1 ring-zinc-300" onClick={() => retry(null)}>
              Reprocessar todos os erros
            </button>
          ) : null}
          {visibleItems.length === 0 ? <p className="text-sm text-zinc-600">Nenhum vídeo ainda. Use “Adicionar links”.</p> : null}
          <ul className="space-y-2">
            {visibleItems.map((item, index) => (
              <RadarItemRow
                key={item.id}
                item={item}
                index={index}
                total={visibleItems.length}
                userId={userId}
                timezone={tz}
                radarName={radar.name}
                onChanged={load}
                onMove={move}
                onRetry={(id) => retry([id])}
                setMessage={setMessage}
              />
            ))}
          </ul>
        </div>
      ) : null}

      {tab === "programacao" ? <RadarPreviewCard preview={preview} title={radar.status === "DRAFT" ? "Prévia antes de ativar" : "Programação"} /> : null}

      {tab === "adicionar" ? <AddLinksSection radarId={radarId} isAdmin={isAdmin} onAdded={load} setMessage={setMessage} /> : null}

      {tab === "configuracoes" ? <SettingsSection data={data} busy={busy} onSave={(body) => patch({ action: "update", ...body }, "Não foi possível salvar.", "Configurações salvas. As publicações futuras foram replanejadas.")} /> : null}

      {tab === "historico" ? (
        <ul className="space-y-1 text-sm">
          {data.events.map((event) => (
            <li key={event.id} className="flex flex-wrap gap-2 border-b border-zinc-100 py-1">
              <span className="text-xs text-zinc-500">{formatInTimeZone(event.createdAt, tz)}</span>
              <span className="font-medium text-zinc-800">{EVENT_LABEL[event.event] ?? event.event}</span>
              {event.message ? <span className="text-zinc-600">{event.message}</span> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function AddLinksSection({ radarId, isAdmin, onAdded, setMessage }: { radarId: string; isAdmin: boolean; onAdded: () => void; setMessage: (message: string | null) => void }) {
  const [text, setText] = useState("");
  const [mode, setMode] = useState<RadarLinksMode>("AUTHORIZED");
  const [authorized, setAuthorized] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const parsed = useParsedLinks(text, isAdmin);

  const submit = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/instagram-radars/${radarId}/links`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ links: text, mode, authorized }),
      });
      if (!response.ok) return setMessage(await readRadarApiError(response, "Não foi possível adicionar os links."));
      const result = (await response.json()) as { added: number; waitingFile: number; duplicates: string[]; rejected: unknown[]; alreadyOnAccount: string[] };
      setMessage(
        `${result.added} link(s) adicionado(s)` +
          (result.waitingFile ? ` · ${result.waitingFile} aguardando arquivo autorizado` : "") +
          (result.duplicates.length ? ` · ${result.duplicates.length} repetido(s) ignorado(s)` : "") +
          (result.alreadyOnAccount.length ? ` · ${result.alreadyOnAccount.length} já usado(s) nesta conta` : "") +
          (result.rejected.length ? ` · ${result.rejected.length} inválido(s)` : "") +
          ".",
      );
      setText("");
      setConfirming(false);
      onAdded();
    } catch {
      setMessage("Não foi possível adicionar os links.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <RadarLinksInput text={text} onTextChange={setText} mode={mode} onModeChange={setMode} authorized={authorized} onAuthorizedChange={setAuthorized} isAdmin={isAdmin} />
      {confirming ? (
        <div className="rounded-md bg-zinc-50 p-3 text-sm">
          <p>
            Adicionar {parsed.accepted.length} link(s) ao fim da fila{mode === "REFERENCE" ? " como referência (nada será baixado)" : ""}?
          </p>
          <div className="mt-2 flex gap-2">
            <button type="button" disabled={busy} className="min-h-11 rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white" onClick={submit}>
              Adicionar à fila
            </button>
            <button type="button" disabled={busy} className="min-h-11 rounded-md px-4 py-2 text-sm font-semibold ring-1 ring-zinc-300" onClick={() => setConfirming(false)}>
              Voltar
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          disabled={busy || parsed.accepted.length === 0 || (mode === "AUTHORIZED" && !authorized)}
          className="min-h-11 rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          onClick={() => setConfirming(true)}
        >
          Adicionar à fila
        </button>
      )}
    </div>
  );
}

function SettingsSection({ data, busy, onSave }: { data: RadarDashboardDto; busy: boolean; onSave: (body: Record<string, unknown>) => Promise<boolean> }) {
  const [name, setName] = useState(data.radar.name);
  const [schedule, setSchedule] = useState<RadarScheduleConfig>(data.radar.schedule);
  const [captions, setCaptions] = useState<RadarCaptionValue>({
    captionTemplate: data.radar.captionTemplate,
    hashtags: data.radar.hashtags,
    missingCaptionPolicy: data.radar.missingCaptionPolicy,
    notReadyPolicy: data.radar.notReadyPolicy,
  });
  const check = useRadarScheduleCheck(schedule);
  return (
    <div className="space-y-6">
      <label className="block text-sm font-medium text-zinc-800">
        Nome
        <input className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm" value={name} maxLength={80} onChange={(event) => setName(event.target.value)} />
      </label>
      <p className="text-xs text-zinc-600">A conta de destino (@{data.account?.username ?? "?"}) não pode ser trocada. Para outra conta, crie outro radar.</p>
      <RadarScheduleFields value={schedule} onChange={setSchedule} />
      <RadarCaptionFields value={captions} onChange={setCaptions} radarName={name} />
      <button type="button" disabled={busy || !check.ok} className="min-h-11 rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" onClick={() => onSave({ name, schedule, ...captions })}>
        Salvar (vale para as publicações futuras)
      </button>
    </div>
  );
}
