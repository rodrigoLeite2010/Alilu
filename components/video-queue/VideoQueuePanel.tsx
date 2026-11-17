"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { VideoQueueDashboardDto } from "@/lib/video-queue/backend/queue-dto";
import { formatInTimeZone } from "@/lib/instagram/schedule-time";
import { parseQueueLinks } from "@/lib/video-queue/links";
import type { QueueScheduleConfig } from "@/lib/video-queue/schedule";
import { VIDEO_QUEUE_STATUS_LABEL } from "@/lib/video-queue/types";
import { FacebookPagesChooser, QueueScheduleEditor, inputClass, labelClass, readApiError, useConnectedTargets } from "./QueueSettingsFields";
import { VideoQueueItemRow } from "./VideoQueueItemRow";

const EVENT_LABEL: Record<string, string> = {
  created: "Fila criada",
  links_added: "Links adicionados",
  activated: "Fila ativada",
  resumed: "Fila retomada",
  paused: "Fila pausada",
  paused_by_system: "Fila pausada automaticamente",
  settings_updated: "Configurações alteradas",
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
  publication_cancelled: "Publicação cancelada fora da fila",
  publication_removed: "Publicação excluída fora da fila",
  archived: "Fila arquivada",
};

async function fetchDashboard(queueId: string): Promise<{ data: VideoQueueDashboardDto | null; error: string | null }> {
  try {
    const response = await fetch(`/api/video-queues/${queueId}`, { cache: "no-store" });
    if (!response.ok) return { data: null, error: await readApiError(response, "Não foi possível carregar a fila.") };
    return { data: (await response.json()) as VideoQueueDashboardDto, error: null };
  } catch {
    return { data: null, error: "Não foi possível carregar a fila." };
  }
}

type Tab = "videos" | "programacao" | "adicionar" | "configuracoes" | "historico";

export function VideoQueuePanel({ queueId, userId, justCreated = false, isAdmin = false }: { queueId: string; userId: string; justCreated?: boolean; isAdmin?: boolean }) {
  const router = useRouter();
  const [data, setData] = useState<VideoQueueDashboardDto | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(justCreated ? "Escolha “Publicar agora” em um vídeo ou use “Agendar fila” para publicar nos horários configurados." : null);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<Tab>("videos");

  const apply = useCallback((result: { data: VideoQueueDashboardDto | null; error: string | null }) => {
    if (result.data) setData(result.data);
    setLoadError(result.error);
  }, []);
  const load = useCallback(async () => apply(await fetchDashboard(queueId)), [apply, queueId]);

  useEffect(() => {
    let cancelled = false;
    fetchDashboard(queueId).then((result) => {
      if (!cancelled) apply(result);
    });
    return () => {
      cancelled = true;
    };
  }, [apply, queueId]);

  // Atualiza sozinho enquanto há vídeos em importação/agendados (a operação continua mesmo com a tela fechada).
  const live = Boolean(data && (data.counts.pending > 0 || data.counts.scheduled > 0));
  useEffect(() => {
    if (!live) return;
    const timer = setInterval(() => {
      fetchDashboard(queueId).then(apply);
    }, 20_000);
    return () => clearInterval(timer);
  }, [live, apply, queueId]);

  const action = async (body: Record<string, unknown>, fallback: string, success?: string) => {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/video-queues/${queueId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!response.ok) setMessage(await readApiError(response, fallback));
      else if (success) setMessage(success);
      await load();
      return response.ok;
    } finally {
      setBusy(false);
    }
  };

  const post = async (path: string, body: Record<string, unknown>, fallback: string) => {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/video-queues/${queueId}${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!response.ok) {
        setMessage(await readApiError(response, fallback));
        return null;
      }
      return (await response.json()) as Record<string, unknown>;
    } finally {
      setBusy(false);
      await load();
    }
  };

  const items = useMemo(() => data?.items ?? [], [data]);
  const visibleItems = items.filter((item) => item.status !== "CANCELLED");

  const move = async (itemId: string, direction: -1 | 1) => {
    const ids = items.map((item) => item.id);
    const index = ids.indexOf(itemId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    await action({ action: "reorder", order: ids }, "Não foi possível reordenar.");
  };

  if (loadError && !data) return <p className="text-sm text-red-700">{loadError}</p>;
  if (!data) return <p className="text-sm text-zinc-500">Carregando fila…</p>;

  const { queue, counts } = data;
  const tz = queue.schedule.timezone;
  const itemNumber = new Map(items.map((item, index) => [item.id, index + 1]));

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <a href={`/instagram/filas?categoria=${queue.category}`} className="text-xs text-zinc-500 hover:underline">
          ← {queue.categoryName}
        </a>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold text-zinc-900">{queue.name}</h1>
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700">
            {queue.categoryName} › {queue.themeName}
          </span>
          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${queue.status === "ACTIVE" ? "bg-emerald-100 text-emerald-800" : queue.status === "PAUSED" ? "bg-amber-100 text-amber-800" : "bg-zinc-100 text-zinc-700"}`}>
            {VIDEO_QUEUE_STATUS_LABEL[queue.status]}
          </span>
        </div>
        {queue.status === "PAUSED" && queue.pauseReason ? <p className="text-sm text-amber-800">{queue.pauseReason}</p> : null}
        <p className="text-sm text-zinc-600">
          Destinos:{" "}
          {queue.publishToInstagram ? (
            <strong>
              Instagram @{data.account?.username ?? "?"}
              {data.account && data.account.status !== "connected" ? " (desconectada)" : ""}
            </strong>
          ) : (
            <span>Instagram desligado</span>
          )}
          {data.pages.map((page) => (
            <span key={page.id}>
              {" · "}
              <strong>
                Facebook {page.name}
                {page.status !== "connected" ? " (precisa reconectar)" : ""}
              </strong>
            </span>
          ))}
        </p>
      </header>

      <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          ["Links", counts.total],
          ["Importados", counts.imported],
          ["Pendentes", counts.pending],
          ["Prontos", counts.ready],
          ["Agendados", counts.scheduled],
          ["Publicados", counts.published],
          ["Com erro", counts.errors],
        ].map(([label, value]) => (
          <div key={label as string} className="rounded-lg border border-zinc-200 bg-white p-3">
            <p className="text-xs text-zinc-500">{label}</p>
            <p className={`text-lg font-semibold ${label === "Com erro" && Number(value) > 0 ? "text-red-700" : "text-zinc-900"}`}>{value}</p>
          </div>
        ))}
        <div className="rounded-lg border border-zinc-200 bg-white p-3">
          <p className="text-xs text-zinc-500">Próxima publicação</p>
          <p className="text-sm font-semibold text-zinc-900">{data.nextPublicationAt ? formatInTimeZone(data.nextPublicationAt, tz) : "—"}</p>
        </div>
      </section>

      <section className="flex flex-wrap gap-2">
        {queue.status === "DRAFT" ? (
          <button type="button" disabled={busy} className="min-h-11 rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white" onClick={() => action({ action: "activate" }, "Não foi possível agendar a fila.", "Agendamento ativado. Os vídeos prontos serão publicados nos horários configurados.")}>
            Agendar fila
          </button>
        ) : null}
        {queue.status === "ACTIVE" ? (
          <button type="button" disabled={busy} className="rounded-md bg-white px-4 py-2 text-sm font-semibold ring-1 ring-zinc-300" onClick={() => action({ action: "pause" }, "Não foi possível pausar.", "Fila pausada. O que já foi publicado não é alterado.")}>
            Pausar fila
          </button>
        ) : null}
        {queue.status === "PAUSED" ? (
          <button type="button" disabled={busy} className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white" onClick={() => action({ action: "resume" }, "Não foi possível retomar.", "Fila retomada.")}>
            Retomar fila
          </button>
        ) : null}
        <button type="button" disabled={busy} className="rounded-md bg-white px-4 py-2 text-sm font-semibold ring-1 ring-zinc-300" onClick={async () => {
          const result = await post("/process", {}, "Não foi possível processar agora.");
          if (result) setMessage((result.imports as unknown[]).length > 0 ? "Um vídeo foi processado." : "Nenhum vídeo pendente para processar agora.");
        }}>
          Processar agora
        </button>
        {counts.errors > 0 ? (
          <button type="button" disabled={busy} className="rounded-md bg-white px-4 py-2 text-sm font-semibold ring-1 ring-zinc-300" onClick={async () => {
            const result = await post("/retry", {}, "Não foi possível reprocessar.");
            if (result) setMessage(`${result.retried} vídeo(s) com erro de importação voltaram para a fila. Falhas de publicação são refeitas em cada vídeo.`);
          }}>
            Reprocessar erros
          </button>
        ) : null}
        <button type="button" disabled={busy} className="ml-auto rounded-md px-3 py-2 text-sm text-red-700 hover:underline" onClick={async () => {
          if (!window.confirm("Arquivar esta fila? As publicações futuras que ainda não começaram serão desfeitas; o histórico continua em Minhas publicações.")) return;
          if (await action({ action: "archive" }, "Não foi possível arquivar.")) router.push(`/instagram/filas?categoria=${queue.category}`);
        }}>
          Arquivar
        </button>
      </section>

      {message ? <p className="rounded-md bg-zinc-50 p-3 text-sm text-zinc-800 ring-1 ring-zinc-200">{message}</p> : null}

      <nav className="flex flex-wrap gap-1 border-b border-zinc-200" aria-label="Seções da fila">
        {(
          [
            ["videos", `Vídeos (${visibleItems.length})`],
            ["programacao", "Programação"],
            ["adicionar", "Adicionar links"],
            ["configuracoes", "Configurações"],
            ["historico", "Histórico"],
          ] as Array<[Tab, string]>
        ).map(([id, label]) => (
          <button key={id} type="button" onClick={() => setTab(id)} className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${tab === id ? "border-zinc-900 text-zinc-900" : "border-transparent text-zinc-500"}`}>
            {label}
          </button>
        ))}
      </nav>

      {tab === "videos" ? (
        items.length === 0 ? (
          <p className="text-sm text-zinc-600">Nenhum vídeo nesta fila. Use “Adicionar links”.</p>
        ) : (
          <ul className="space-y-2">
            {items.map((item, index) => (
              <VideoQueueItemRow
                key={`${item.id}-${item.status}-${item.caption ?? ""}`}
                item={item}
                index={index}
                total={items.length}
                userId={userId}
                timezone={tz}
                themeName={queue.themeName}
                categoryName={queue.categoryName}
                onChanged={() => void load()}
                onMove={(id, direction) => void move(id, direction)}
                onRetry={async (id) => {
                  const result = await post("/retry", { itemIds: [id] }, "Não foi possível reprocessar.");
                  if (result) setMessage("O vídeo voltou para a fila de importação.");
                }}
                setMessage={setMessage}
              />
            ))}
          </ul>
        )
      ) : null}

      {tab === "programacao" ? (
        <section className="space-y-2">
          <p className="text-sm text-zinc-600">
            Horários já agendados e a previsão para os vídeos restantes (fuso {tz}). A previsão considera os horários livres das contas escolhidas e
            pode mudar conforme os vídeos ficam prontos.
            {queue.status === "DRAFT" ? " Use “Agendar fila” para ativar a programação automática." : ""}
          </p>
          {data.preview.length === 0 ? (
            <p className="text-sm text-zinc-500">Nenhum vídeo para programar.</p>
          ) : (
            <ol className="divide-y divide-zinc-100 rounded-lg border border-zinc-200 bg-white">
              {data.preview.map((entry) => {
                const item = items.find((candidate) => candidate.id === entry.itemId);
                return (
                  <li key={`${entry.itemId}-${entry.at}`} className="flex flex-wrap items-center gap-3 px-3 py-2 text-sm">
                    <span className="w-40 font-medium text-zinc-900">{formatInTimeZone(entry.at, tz)}</span>
                    <span className="text-zinc-500">#{itemNumber.get(entry.itemId)}</span>
                    <span className="min-w-0 flex-1 truncate text-zinc-700">{item?.title || item?.sourceUrl}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs ${entry.projected ? "bg-zinc-100 text-zinc-600" : "bg-indigo-100 text-indigo-800"}`}>
                      {entry.projected ? "previsto" : item?.status === "PUBLISHED" ? "publicado" : "agendado"}
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      ) : null}

      {tab === "adicionar" ? <AddLinksForm queueId={queueId} isAdmin={isAdmin} onDone={(text) => { setMessage(text); void load(); setTab("videos"); }} /> : null}

      {tab === "configuracoes" ? <QueueSettingsForm data={data} onSaved={(text) => { setMessage(text); void load(); }} /> : null}

      {tab === "historico" ? (
        <ol className="space-y-1 text-sm">
          {data.events.map((event) => (
            <li key={event.id} className="flex flex-wrap gap-2">
              <span className="w-40 text-zinc-500">{formatInTimeZone(event.createdAt, tz)}</span>
              <span className="font-medium text-zinc-800">{EVENT_LABEL[event.event] ?? event.event}</span>
              {event.itemId && itemNumber.get(event.itemId) ? <span className="text-zinc-500">#{itemNumber.get(event.itemId)}</span> : null}
              {event.message ? <span className="text-zinc-600">{event.message}</span> : null}
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}

function AddLinksForm({ queueId, isAdmin, onDone }: { queueId: string; isAdmin: boolean; onDone: (message: string) => void }) {
  const [text, setText] = useState("");
  const [authorized, setAuthorized] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const parsed = useMemo(() => parseQueueLinks(text, isAdmin ? Infinity : undefined), [text, isAdmin]);
  const submit = async () => {
    setError(null);
    if (!authorized) return setError("Confirme que você tem os direitos ou a autorização para republicar estes vídeos.");
    setBusy(true);
    try {
      const response = await fetch(`/api/video-queues/${queueId}/items`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ links: text, authorized: true }) });
      if (!response.ok) return setError(await readApiError(response, "Não foi possível adicionar os links."));
      const result = (await response.json()) as { added: number; duplicates: string[]; rejected: unknown[]; inOtherQueues: string[]; waitingFile: number };
      onDone(
        [
          `${result.added} link(s) adicionado(s).`,
          result.duplicates.length ? `${result.duplicates.length} repetido(s) ignorado(s).` : "",
          result.rejected.length ? `${result.rejected.length} recusado(s).` : "",
          result.inOtherQueues.length ? `${result.inOtherQueues.length} já estão em outra fila.` : "",
          result.waitingFile ? `${result.waitingFile} aguardando o arquivo autorizado.` : "",
        ]
          .filter(Boolean)
          .join(" "),
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="space-y-3">
      <label className={labelClass}>
        Cole os links dos vídeos, um por linha
        <textarea className={`${inputClass} h-40 font-mono text-base sm:text-sm`} value={text} onChange={(event) => setText(event.target.value)} />
      </label>
      <p className="text-xs text-zinc-600">
        {parsed.accepted.length} válido(s){parsed.duplicates.length ? ` · ${parsed.duplicates.length} repetido(s)` : ""}
        {parsed.rejected.length ? ` · ${parsed.rejected.length} recusado(s)` : ""}
      </p>
      <label className="flex items-start gap-2 text-sm text-zinc-800">
        <input type="checkbox" className="mt-1" checked={authorized} onChange={(event) => setAuthorized(event.target.checked)} />
        Tenho os direitos ou a autorização para republicar estes vídeos.
      </label>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <button type="button" disabled={busy || parsed.accepted.length === 0} className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" onClick={submit}>
        Adicionar à fila
      </button>
    </section>
  );
}

function QueueSettingsForm({ data, onSaved }: { data: VideoQueueDashboardDto; onSaved: (message: string) => void }) {
  const { pages } = useConnectedTargets();
  const [name, setName] = useState(data.queue.name);
  const [publishToInstagram, setPublishToInstagram] = useState(data.queue.publishToInstagram);
  const [facebookPageIds, setFacebookPageIds] = useState<string[]>(data.queue.facebookPageIds);
  const [schedule, setSchedule] = useState<QueueScheduleConfig>(data.queue.schedule);
  const [captionTemplate, setCaptionTemplate] = useState(data.queue.captionTemplate);
  const [facebookCaptionTemplate, setFacebookCaptionTemplate] = useState(data.queue.facebookCaptionTemplate ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/video-queues/${data.queue.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update", name, publishToInstagram, facebookPageIds, schedule, captionTemplate, facebookCaptionTemplate }),
      });
      if (!response.ok) return setError(await readApiError(response, "Não foi possível salvar."));
      onSaved("Configurações salvas. As publicações futuras que ainda não começaram foram replanejadas.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="space-y-5">
      <label className={labelClass}>
        Nome da fila
        <input className={inputClass} value={name} maxLength={80} onChange={(event) => setName(event.target.value)} />
      </label>
      <div className="space-y-2">
        <p className={labelClass}>Destinos</p>
        <p className="text-xs text-zinc-500">A conta do Instagram de uma fila não muda (para nunca misturar contas). Para outra conta, crie outra fila.</p>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={publishToInstagram} onChange={(event) => setPublishToInstagram(event.target.checked)} />
          Publicar no Instagram @{data.account?.username ?? "?"}
        </label>
        <FacebookPagesChooser pages={pages} selected={facebookPageIds} onChange={setFacebookPageIds} />
      </div>
      <QueueScheduleEditor value={schedule} onChange={setSchedule} />
      <label className={labelClass}>
        Template de legenda (Instagram)
        <textarea className={`${inputClass} h-28`} value={captionTemplate} maxLength={2200} onChange={(event) => setCaptionTemplate(event.target.value)} />
      </label>
      <label className={labelClass}>
        Template de legenda do Facebook (opcional)
        <textarea className={`${inputClass} h-20`} value={facebookCaptionTemplate} onChange={(event) => setFacebookCaptionTemplate(event.target.value)} />
      </label>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <button type="button" disabled={busy} className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white" onClick={save}>
        Salvar e replanejar horários futuros
      </button>
    </section>
  );
}
