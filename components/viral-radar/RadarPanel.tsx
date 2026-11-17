"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { CandidateDto, RadarDashboardDto } from "@/lib/viral-radar/backend/radar-dto";
import { AUTHORIZATION_LABEL, LICENSE_LABEL, PIPELINE_STAGE_LABEL, ROUTE_LABEL, SOURCE_TYPE_LABEL, type PipelineStage } from "@/lib/viral-radar/types";
import { VIDEO_QUEUE_STATUS_LABEL } from "@/lib/video-queue/types";
import { readApiError } from "@/components/video-queue/QueueSettingsFields";
import { RadarSettingsFields, toRequestBody, type RadarFormState } from "./RadarSettingsFields";
import { SourceEditor, type ConnectorMap, type SourceDraft } from "./SourceEditor";

type Tab = "overview" | "candidates" | "sources" | "settings" | "history" | "performance";
const TABS: Array<[Tab, string]> = [
  ["overview", "Visão geral"],
  ["candidates", "Candidatos"],
  ["sources", "Fontes"],
  ["settings", "Configurações"],
  ["history", "Histórico"],
  ["performance", "Desempenho"],
];

const fmt = (value: number | null | undefined) => (value === null || value === undefined ? "—" : value.toLocaleString("pt-BR"));
const when = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—");

const STAGE_TONE: Partial<Record<PipelineStage, string>> = {
  PUBLISHED: "bg-emerald-100 text-emerald-800",
  READY: "bg-teal-100 text-teal-800",
  SCHEDULED: "bg-sky-100 text-sky-800",
  PUBLISHING: "bg-sky-100 text-sky-800",
  FAILED: "bg-red-100 text-red-800",
  AWAITING_AUTHORIZATION: "bg-amber-100 text-amber-800",
  WAITING_FILE: "bg-amber-100 text-amber-800",
  REFERENCE: "bg-violet-100 text-violet-800",
};

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-3">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-zinc-900">{value}</p>
    </div>
  );
}

function ApproveForm({ onSubmit, onCancel }: { onSubmit: (body: Record<string, unknown>) => Promise<void>; onCancel: () => void }) {
  const [scope, setScope] = useState({ edit: false, republish: false, commercial: false });
  const [note, setNote] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  return (
    <div className="mt-2 space-y-2 rounded-md bg-amber-50 p-3 text-sm ring-1 ring-amber-200">
      <p className="font-medium text-amber-900">Aprovar exige a autorização do dono do vídeo.</p>
      <div className="flex flex-wrap gap-3">
        {(
          [
            ["edit", "Edição"],
            ["republish", "Republicação"],
            ["commercial", "Uso comercial"],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="flex items-center gap-1">
            <input type="checkbox" checked={scope[key]} onChange={(event) => setScope({ ...scope, [key]: event.target.checked })} />
            {label}
          </label>
        ))}
      </div>
      <textarea className="w-full rounded-md border border-zinc-300 px-2 py-1" placeholder="Quem autorizou, quando, link/documento" value={note} onChange={(event) => setNote(event.target.value)} />
      <label className="flex items-start gap-2">
        <input type="checkbox" className="mt-1" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />
        Declaro que obtive essa autorização do titular do vídeo.
      </label>
      <div className="flex gap-2">
        <button type="button" className="rounded-md bg-zinc-900 px-3 py-1.5 font-semibold text-white" onClick={() => onSubmit({ licenseScope: scope, licenseNote: note, rightsConfirmed: confirmed })}>
          Aprovar e enviar à fila
        </button>
        <button type="button" className="rounded-md px-3 py-1.5 ring-1 ring-zinc-300" onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </div>
  );
}

function CandidateDetails({ candidate }: { candidate: CandidateDto }) {
  const brief = candidate.brief as null | {
    angle?: string;
    hook?: string;
    script?: string[];
    claims?: Array<{ text: string; status: string; sourceLink: string | null }>;
    visuals?: string[];
    title?: string;
    caption?: string;
    warnings?: string[];
  };
  const analysis = candidate.aiAnalysis as null | { topic?: string; contentType?: string; claimStatus?: string; adaptationIdea?: string };
  return (
    <div className="space-y-2 bg-zinc-50 p-3 text-xs text-zinc-700">
      <p>
        <strong>Viral Score ({candidate.scoreVersion ?? "—"}):</strong> {candidate.scoreReason ?? "ainda não calculado"}
      </p>
      {candidate.filterReason ? <p className="text-amber-800">Motivo: {candidate.filterReason}</p> : null}
      <p>
        <strong>Autorização:</strong> {AUTHORIZATION_LABEL[candidate.authorizationStatus]}
        {candidate.authorizationType ? ` (${candidate.authorizationType})` : ""} {candidate.authorizationNote ? `— ${candidate.authorizationNote}` : ""}
      </p>
      {candidate.route ? <p>
          <strong>Destino:</strong> {ROUTE_LABEL[candidate.route]}
        </p> : null}
      {candidate.itemMessage ? <p>
          <strong>Fila:</strong> {candidate.itemMessage}
        </p> : null}
      {analysis ? (
        <p>
          <strong>IA (metadados):</strong> {analysis.topic} · {analysis.contentType} · {analysis.claimStatus}
          {analysis.adaptationIdea ? ` · ideia: ${analysis.adaptationIdea}` : ""}
        </p>
      ) : null}
      {brief ? (
        <div className="space-y-1 rounded-md bg-white p-2 ring-1 ring-violet-200">
          <p className="font-semibold text-violet-900">Roteiro original {brief.title ? `— ${brief.title}` : ""}</p>
          {brief.hook ? <p>Gancho: {brief.hook}</p> : null}
          {brief.angle ? <p>Abordagem: {brief.angle}</p> : null}
          {brief.script?.length ? (
            <ol className="ml-4 list-decimal">
              {brief.script.map((line, index) => (
                <li key={index}>{line}</li>
              ))}
            </ol>
          ) : null}
          {brief.claims?.length ? (
            <ul className="ml-4 list-disc">
              {brief.claims.map((claim, index) => (
                <li key={index}>
                  [{claim.status}] {claim.text} {claim.sourceLink ? <a className="underline" href={claim.sourceLink} target="_blank" rel="noreferrer">fonte</a> : null}
                </li>
              ))}
            </ul>
          ) : null}
          {brief.visuals?.length ? <p>Material próprio a usar: {brief.visuals.join("; ")}</p> : null}
          {brief.warnings?.map((warning, index) => (
            <p key={index} className="text-amber-800">
              ⚠ {warning}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function CandidatesTab({ radarId, onChanged }: { radarId: string; onChanged: () => void }) {
  const [filter, setFilter] = useState<string>("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ total: number; pageSize: number; candidates: CandidateDto[] } | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [approving, setApproving] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const fetchPage = useCallback(async () => {
    const params = new URLSearchParams({ page: String(page) });
    if (filter.startsWith("route:")) params.set("route", filter.slice(6));
    else if (filter) params.set("status", filter);
    const response = await fetch(`/api/viral-radars/${radarId}/candidates?${params.toString()}`);
    return response.ok ? ((await response.json()) as { total: number; pageSize: number; candidates: CandidateDto[] }) : null;
  }, [radarId, filter, page]);
  const load = useCallback(async () => {
    const result = await fetchPage();
    if (result) setData(result);
  }, [fetchPage]);

  useEffect(() => {
    let cancelled = false;
    fetchPage().then((result) => {
      if (!cancelled && result) setData(result);
    });
    return () => {
      cancelled = true;
    };
  }, [fetchPage]);

  const act = async (id: string, action: string, extra: Record<string, unknown> = {}) => {
    setMessage(null);
    const response = await fetch(`/api/viral-radars/candidates/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, ...extra }) });
    if (!response.ok) return setMessage(await readApiError(response, "Não foi possível concluir."));
    const result = (await response.json()) as { message?: string };
    setMessage(result.message ?? "Feito.");
    setApproving(null);
    await load();
    onChanged();
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <select className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm" value={filter} onChange={(event) => { setFilter(event.target.value); setPage(1); }}>
          <option value="">Todos</option>
          <option value="AWAITING_AUTHORIZATION">Aguardando autorização</option>
          <option value="QUEUED">Na fila</option>
          <option value="REFERENCE">Referências</option>
          <option value="CLASSIFIED">Classificados</option>
          <option value="FILTERED">Fora dos critérios</option>
          <option value="IGNORED">Ignorados</option>
          <option value="route:A">Destino A (importação autorizada)</option>
          <option value="route:B">Destino B (conteúdo original)</option>
          <option value="route:C">Destino C (autorização/revisão)</option>
        </select>
        {data ? <span className="text-xs text-zinc-500">{data.total} candidato(s)</span> : null}
      </div>
      {message ? <p className="rounded-md bg-zinc-100 p-2 text-sm text-zinc-800">{message}</p> : null}
      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
        <table className="min-w-[960px] w-full text-left text-sm">
          <thead className="bg-zinc-50 text-xs uppercase text-zinc-500">
            <tr>
              <th className="p-2"> </th>
              <th className="p-2">Título</th>
              <th className="p-2">Plataforma</th>
              <th className="p-2">Autor</th>
              <th className="p-2 text-right">Views</th>
              <th className="p-2 text-right">Curtidas</th>
              <th className="p-2 text-right">Coment.</th>
              <th className="p-2">Data</th>
              <th className="p-2 text-right">Score</th>
              <th className="p-2">Autorização</th>
              <th className="p-2">Status</th>
              <th className="p-2">Ações</th>
            </tr>
          </thead>
          <tbody>
            {(data?.candidates ?? []).map((candidate) => (
              <Fragment key={candidate.id}>
                <tr className="border-t border-zinc-100 align-top">
                  <td className="p-2">
                    {candidate.thumbnailUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={candidate.thumbnailUrl} alt="" className="h-12 w-20 rounded object-cover" loading="lazy" />
                    ) : (
                      <div className="h-12 w-20 rounded bg-zinc-100" />
                    )}
                  </td>
                  <td className="max-w-xs p-2 font-medium text-zinc-900">{candidate.title ?? candidate.url}</td>
                  <td className="p-2">{candidate.platform}</td>
                  <td className="p-2">{candidate.authorName ?? "—"}</td>
                  <td className="p-2 text-right">{fmt(candidate.views)}</td>
                  <td className="p-2 text-right">{fmt(candidate.likes)}</td>
                  <td className="p-2 text-right">{fmt(candidate.comments)}</td>
                  <td className="p-2 text-xs">{when(candidate.publishedAt)}</td>
                  <td className="p-2 text-right font-semibold">{candidate.score === null ? "—" : candidate.score.toLocaleString("pt-BR")}</td>
                  <td className="p-2 text-xs">{AUTHORIZATION_LABEL[candidate.authorizationStatus]}</td>
                  <td className="p-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STAGE_TONE[candidate.stage] ?? "bg-zinc-100 text-zinc-700"}`}>{candidate.stageLabel}</span>
                  </td>
                  <td className="space-y-1 p-2 text-xs">
                    <div className="flex flex-wrap gap-x-2 gap-y-1">
                      <button type="button" className="font-medium text-teal-700" onClick={() => setOpen(open === candidate.id ? null : candidate.id)}>
                        Detalhes
                      </button>
                      <a className="font-medium text-teal-700" href={candidate.url} target="_blank" rel="noreferrer">
                        Ver fonte
                      </a>
                      {["AWAITING_AUTHORIZATION", "REFERENCE", "CLASSIFIED", "FILTERED"].includes(candidate.status) ? (
                        <button type="button" className="font-medium text-zinc-900" onClick={() => setApproving(candidate.id)}>
                          Aprovar
                        </button>
                      ) : null}
                      {candidate.status !== "QUEUED" && candidate.status !== "IGNORED" ? (
                        <button type="button" className="font-medium text-violet-700" onClick={() => act(candidate.id, "brief")}>
                          Criar conteúdo original
                        </button>
                      ) : null}
                      {candidate.status === "IGNORED" ? (
                        <button type="button" className="font-medium text-zinc-700" onClick={() => act(candidate.id, "restore")}>
                          Restaurar
                        </button>
                      ) : candidate.status !== "QUEUED" ? (
                        <button type="button" className="font-medium text-zinc-500" onClick={() => act(candidate.id, "ignore")}>
                          Ignorar
                        </button>
                      ) : null}
                      {candidate.stage === "FAILED" ? (
                        <button type="button" className="font-medium text-red-700" onClick={() => act(candidate.id, "reprocess")}>
                          Reprocessar
                        </button>
                      ) : null}
                    </div>
                    {approving === candidate.id ? <ApproveForm onCancel={() => setApproving(null)} onSubmit={(body) => act(candidate.id, "approve", body)} /> : null}
                  </td>
                </tr>
                {open === candidate.id ? (
                  <tr>
                    <td colSpan={12}>
                      <CandidateDetails candidate={candidate} />
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            ))}
            {data && data.candidates.length === 0 ? (
              <tr>
                <td colSpan={12} className="p-6 text-center text-sm text-zinc-500">
                  Nenhum candidato neste filtro.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      {data && data.total > data.pageSize ? (
        <div className="flex items-center gap-2 text-sm">
          <button type="button" disabled={page <= 1} className="rounded-md px-3 py-1 ring-1 ring-zinc-300 disabled:opacity-50" onClick={() => setPage(page - 1)}>
            Anterior
          </button>
          <span>Página {page}</span>
          <button type="button" disabled={page * data.pageSize >= data.total} className="rounded-md px-3 py-1 ring-1 ring-zinc-300 disabled:opacity-50" onClick={() => setPage(page + 1)}>
            Próxima
          </button>
        </div>
      ) : null}
    </div>
  );
}

function SourcesTab({ dashboard, onChanged }: { dashboard: RadarDashboardDto; onChanged: () => void }) {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const connectors: ConnectorMap = Object.fromEntries(dashboard.sources.map((source) => [source.type, source.availability]));
  const save = async (url: string, method: string, draft: SourceDraft) => {
    const response = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(draft) });
    if (!response.ok) return readApiError(response, "Não foi possível salvar a fonte.");
    setAdding(false);
    setEditing(null);
    onChanged();
    return null;
  };
  const remove = async (id: string) => {
    await fetch(`/api/viral-radars/sources/${id}`, { method: "DELETE" });
    onChanged();
  };
  return (
    <div className="space-y-3">
      {dashboard.sources.map((source) =>
        editing === source.id ? (
          <SourceEditor
            key={source.id}
            connectors={connectors}
            submitLabel="Salvar fonte"
            onCancel={() => setEditing(null)}
            initial={{
              type: source.type,
              label: source.label,
              enabled: source.enabled,
              config: source.config,
              license: source.license,
              licenseScope: source.licenseScope,
              licenseNote: source.licenseNote ?? "",
              licenseEvidenceUrl: source.licenseEvidenceUrl ?? "",
              trustedForFacts: source.trustedForFacts,
              rightsConfirmed: false,
            }}
            onSubmit={(draft) => save(`/api/viral-radars/sources/${source.id}`, "PATCH", draft)}
          />
        ) : (
          <div key={source.id} className="rounded-lg border border-zinc-200 bg-white p-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold text-zinc-900">
                {source.label || SOURCE_TYPE_LABEL[source.type]} {source.enabled ? "" : <span className="text-xs text-zinc-500">(desligada)</span>}
              </p>
              <div className="flex gap-3 text-xs">
                <button type="button" className="font-medium text-teal-700" onClick={() => setEditing(source.id)}>
                  Editar
                </button>
                <button type="button" className="font-medium text-red-700" onClick={() => remove(source.id)}>
                  Remover
                </button>
              </div>
            </div>
            <p className="text-xs text-zinc-600">
              {SOURCE_TYPE_LABEL[source.type]} · {LICENSE_LABEL[source.license]}
              {source.licenseDeclaredAt ? ` · declarada em ${when(source.licenseDeclaredAt)}` : ""}
              {source.trustedForFacts ? " · fonte oficial para checagem" : ""}
            </p>
            {source.config.url || source.config.channelId ? <p className="break-all text-xs text-zinc-500">{source.config.url ?? source.config.channelId}</p> : null}
            {!source.availability.available ? <p className="mt-1 text-xs text-amber-800">{source.availability.reason}</p> : null}
            <p className="mt-1 text-xs text-zinc-500">
              Última leitura: {when(source.lastFetchedAt)} {source.lastError ? <span className="text-red-700">— {source.lastError}</span> : null}
            </p>
          </div>
        ),
      )}
      {adding ? (
        <SourceEditor connectors={connectors} submitLabel="Adicionar fonte" onCancel={() => setAdding(false)} onSubmit={(draft) => save(`/api/viral-radars/${dashboard.radar.id}/sources`, "POST", draft)} />
      ) : (
        <button type="button" className="min-h-10 rounded-md px-3 py-2 text-sm font-medium ring-1 ring-zinc-300" onClick={() => setAdding(true)}>
          + Adicionar fonte
        </button>
      )}
    </div>
  );
}

function SettingsTab({ dashboard, onChanged }: { dashboard: RadarDashboardDto; onChanged: () => void }) {
  const radar = dashboard.radar;
  const [state, setState] = useState<RadarFormState>({
    name: radar.name,
    category: radar.category,
    theme: radar.theme,
    keywords: radar.keywords.join("\n"),
    hashtags: radar.hashtags.join(" "),
    language: radar.language,
    region: radar.region,
    frequencyMinutes: radar.frequencyMinutes,
    criteria: radar.criteria,
    scoreWeights: radar.scoreWeights,
    autoMode: radar.autoMode,
    supervisedMode: radar.supervisedMode,
    queueMin: radar.queueMin,
    queueTarget: radar.queueTarget,
    priorityMode: radar.priorityMode,
    captionMode: radar.captionMode,
    captionStyle: radar.captionStyle,
    aiClassification: radar.aiClassification,
    aiDailyCap: radar.aiDailyCap,
    reframeMode: "NONE",
    maxDurationSeconds: "",
  });
  const [message, setMessage] = useState<string | null>(null);
  const save = async () => {
    setMessage(null);
    const response = await fetch(`/api/viral-radars/${radar.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "update", ...toRequestBody(state) }) });
    setMessage(response.ok ? "Configurações salvas." : await readApiError(response, "Não foi possível salvar."));
    if (response.ok) onChanged();
  };
  return (
    <div className="space-y-4">
      <RadarSettingsFields value={state} onChange={setState} lockTheme />
      {dashboard.queue ? (
        <p className="text-sm text-zinc-600">
          Conta, Páginas, horários e modelo de legenda ficam na fila do radar:{" "}
          <Link className="font-medium text-teal-700 underline" href={`/instagram/filas/${dashboard.queue.id}`}>
            abrir configurações da fila
          </Link>
          .
        </p>
      ) : null}
      {message ? <p className="text-sm text-zinc-800">{message}</p> : null}
      <button type="button" onClick={save} className="min-h-11 rounded-md bg-zinc-900 px-5 py-2 text-sm font-semibold text-white">
        Salvar configurações
      </button>
    </div>
  );
}

export function RadarPanel({ radarId, justCreated = false }: { radarId: string; justCreated?: boolean }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("overview");
  const [dashboard, setDashboard] = useState<RadarDashboardDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(justCreated ? "Radar criado. A primeira pesquisa acontece na próxima execução do cron — ou clique em \"Executar radar agora\"." : null);
  const [busy, setBusy] = useState(false);

  const fetchDashboard = useCallback(async (): Promise<{ data: RadarDashboardDto } | { error: string }> => {
    const response = await fetch(`/api/viral-radars/${radarId}`);
    if (!response.ok) return { error: await readApiError(response, "Radar não encontrado.") };
    return { data: (await response.json()) as RadarDashboardDto };
  }, [radarId]);
  const apply = useCallback((result: { data: RadarDashboardDto } | { error: string }) => {
    if ("error" in result) setError(result.error);
    else setDashboard(result.data);
  }, []);
  const load = useCallback(async () => apply(await fetchDashboard()), [apply, fetchDashboard]);

  useEffect(() => {
    let cancelled = false;
    fetchDashboard().then((result) => {
      if (!cancelled) apply(result);
    });
    return () => {
      cancelled = true;
    };
  }, [apply, fetchDashboard]);

  const action = async (name: string) => {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/viral-radars/${radarId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: name }) });
      if (!response.ok) return setMessage(await readApiError(response, "Não foi possível concluir."));
      const data = (await response.json()) as { message?: string };
      setMessage(data.message ?? "Feito.");
      if (name === "archive") return router.push("/radar-viral");
      await load();
    } finally {
      setBusy(false);
    }
  };

  if (error) return <p className="text-sm text-red-700">{error}</p>;
  if (!dashboard) return <p className="text-sm text-zinc-500">Carregando radar…</p>;
  const { radar, counters, queue, stock } = dashboard;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/radar-viral" className="text-xs text-zinc-500 hover:underline">
            ← Radar Viral
          </Link>
          <h1 className="text-xl font-semibold text-zinc-900">{radar.name}</h1>
          <p className="text-sm text-zinc-600">
            {radar.status === "ACTIVE" ? "Ativo" : radar.status === "PAUSED" ? `Pausado${radar.pauseReason ? ` — ${radar.pauseReason}` : ""}` : "Arquivado"} · próxima execução {when(radar.nextRunAt)}
            {radar.backoffUntil ? ` · aguardando até ${when(radar.backoffUntil)} após falha` : ""}
          </p>
          {radar.lastStatusMessage ? <p className="mt-1 text-xs text-zinc-500">Última execução: {radar.lastStatusMessage}</p> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={busy} onClick={() => action("run")} className="min-h-10 rounded-md bg-zinc-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60">
            {busy ? "Executando…" : "Executar radar agora"}
          </button>
          {radar.status === "ACTIVE" ? (
            <button type="button" disabled={busy} onClick={() => action("pause")} className="min-h-10 rounded-md px-3 py-2 text-sm font-medium ring-1 ring-zinc-300">
              Pausar
            </button>
          ) : (
            <button type="button" disabled={busy} onClick={() => action("resume")} className="min-h-10 rounded-md px-3 py-2 text-sm font-medium ring-1 ring-zinc-300">
              Retomar
            </button>
          )}
          {queue && queue.status === "DRAFT" ? (
            <button type="button" disabled={busy} onClick={() => action("activate_publishing")} className="min-h-10 rounded-md bg-teal-700 px-3 py-2 text-sm font-semibold text-white">
              Ativar publicação
            </button>
          ) : null}
          {queue ? (
            <Link href={`/instagram/filas/${queue.id}`} className="inline-flex min-h-10 items-center rounded-md px-3 py-2 text-sm font-medium ring-1 ring-zinc-300">
              Visualizar fila
            </Link>
          ) : null}
        </div>
      </div>

      {message ? <p className="rounded-md bg-zinc-100 p-3 text-sm text-zinc-800">{message}</p> : null}
      {dashboard.pending.length > 0 ? (
        <ul className="space-y-1 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          {dashboard.pending.map((item) => (
            <li key={item}>• {item}</li>
          ))}
        </ul>
      ) : null}

      <nav className="flex flex-wrap gap-2" aria-label="Seções do radar">
        {TABS.map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold ring-1 ring-inset ${tab === id ? "bg-zinc-900 text-white ring-zinc-900" : "bg-white text-zinc-800 ring-zinc-300"}`}
          >
            {label}
          </button>
        ))}
      </nav>

      {tab === "overview" ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Descobertos hoje" value={counters.discoveredToday} />
            <Stat label="Classificados" value={counters.classified} />
            <Stat label="Autorizados" value={counters.authorized} />
            <Stat label="Aguardando autorização" value={counters.awaiting} />
            <Stat label="Importados" value={counters.imported} />
            <Stat label="Prontos" value={stock.ready} />
            <Stat label="Agendados" value={counters.scheduled} />
            <Stat label="Publicados" value={counters.published} />
            <Stat label="Com erro" value={counters.errors} />
            <Stat label="Referências (original)" value={counters.references} />
            <Stat label="Próxima execução" value={when(radar.nextRunAt)} />
            <Stat label="Próxima publicação" value={when(queue?.counts.nextPublicationAt)} />
          </div>
          {queue ? (
            <div className="rounded-lg border border-zinc-200 bg-white p-4 text-sm text-zinc-700">
              <p>
                <strong>Fila:</strong> {queue.name} · {VIDEO_QUEUE_STATUS_LABEL[queue.status]} · @{queue.instagramUsername ?? "?"}
                {queue.facebookPages ? ` + ${queue.facebookPages} Página(s)` : ""} · {queue.schedule.postsPerDay}/dia ({queue.schedule.publishTimes.join(", ")}) · {queue.schedule.timezone}
              </p>
              <p className="mt-1">
                Estoque: {stock.ready} prontos, {stock.inPipeline} em processamento, {stock.scheduled} agendados, {stock.waitingFile} aguardando arquivo · ideal {radar.queueTarget}, reabastece abaixo de {radar.queueMin}
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                Consumo hoje: {dashboard.usage.quotaUnits} unidades do YouTube neste radar ({dashboard.usage.youtubeUnitsToday}/{dashboard.usage.youtubeDailyCap} no total) · {dashboard.usage.aiCalls} chamadas de IA
              </p>
            </div>
          ) : null}
        </div>
      ) : null}
      {tab === "candidates" ? <CandidatesTab radarId={radar.id} onChanged={load} /> : null}
      {tab === "sources" ? <SourcesTab dashboard={dashboard} onChanged={load} /> : null}
      {tab === "settings" ? <SettingsTab dashboard={dashboard} onChanged={load} /> : null}
      {tab === "history" ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-500">Execuções</h2>
            <ul className="space-y-2">
              {dashboard.executions.map((execution) => (
                <li key={execution.id} className="rounded-md border border-zinc-200 bg-white p-3 text-xs text-zinc-700">
                  <p className="font-semibold text-zinc-900">
                    {when(execution.startedAt)} · {execution.trigger} · {execution.status}
                  </p>
                  <p>{execution.message}</p>
                  {execution.errors.length ? <p className="text-amber-800">{execution.errors.map((item) => `${item.source}: ${item.message}`).join(" | ")}</p> : null}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-500">Eventos</h2>
            <ul className="space-y-1">
              {dashboard.events.map((event) => (
                <li key={event.id} className="text-xs text-zinc-700">
                  {when(event.createdAt)} · <strong>{event.event}</strong> {event.candidateTitle ? `· ${event.candidateTitle}` : ""} {event.message ? `— ${event.message}` : ""}
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
      {tab === "performance" ? (
        <div className="space-y-4 text-sm">
          <ul className="space-y-1 rounded-lg border border-zinc-200 bg-white p-4">
            {dashboard.performance.recommendations.map((item) => (
              <li key={item}>• {item}</li>
            ))}
          </ul>
          {(
            [
              ["Por plataforma", dashboard.performance.byPlatform],
              ["Por horário", dashboard.performance.byHour],
              ["Por estilo de legenda", dashboard.performance.byStyle],
              ["Por tipo de conteúdo", dashboard.performance.byContentType],
            ] as const
          ).map(([title, groups]) => (
            <div key={title}>
              <h3 className="font-semibold text-zinc-900">{title}</h3>
              {groups.length === 0 ? (
                <p className="text-xs text-zinc-500">Sem dados ainda.</p>
              ) : (
                <table className="mt-1 text-xs">
                  <tbody>
                    {groups.map((group) => (
                      <tr key={group.key}>
                        <td className="pr-4">{group.key}</td>
                        <td className="pr-4">{group.samples} publ.</td>
                        <td className="pr-4">curtidas {fmt(group.avgLikes)}</td>
                        <td className="pr-4">coment. {fmt(group.avgComments)}</td>
                        <td>views {fmt(group.avgViews)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ))}
          <p className="text-xs text-zinc-500">Métricas que a API não fornece (sem permissão de insights) aparecem como &quot;—&quot; e não entram nas médias.</p>
        </div>
      ) : null}
      <p className="text-xs text-zinc-400">
        Etapas: {Object.values(PIPELINE_STAGE_LABEL).slice(0, 12).join(" → ")}
      </p>
    </div>
  );
}
