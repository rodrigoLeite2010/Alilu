"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { defaultCaptionTemplate } from "@/lib/video-queue/catalog";
import { DEFAULT_SCHEDULE, type QueueScheduleConfig } from "@/lib/video-queue/schedule";
import { defaultSettings } from "@/lib/viral-radar/config";
import { SOURCE_TYPE_LABEL, LICENSE_LABEL } from "@/lib/viral-radar/types";
import { FacebookPagesChooser, QueueScheduleEditor, inputClass, labelClass, readApiError, useConnectedTargets } from "@/components/video-queue/QueueSettingsFields";
import { RadarSettingsFields, toRequestBody, type RadarFormState } from "./RadarSettingsFields";
import { SourceEditor, emptySource, type ConnectorMap, type SourceDraft } from "./SourceEditor";

function initialState(category: string, theme: string): RadarFormState {
  const settings = defaultSettings(category, theme);
  return {
    ...settings,
    keywords: settings.keywords.join("\n"),
    hashtags: settings.hashtags.join(" "),
    reframeMode: "NONE",
    maxDurationSeconds: "",
  };
}

/**
 * "Novo radar": tema e critérios → fontes (com direitos) → publicação
 * (conta Instagram, Páginas, horários — a MESMA Fila de vídeos de sempre)
 * → declaração. Padrões do "Radar GTA 6 Brasil".
 */
export function RadarCreateForm({ initialCategory = "games", initialTheme = "gta-6" }: { initialCategory?: string; initialTheme?: string }) {
  const router = useRouter();
  const { accounts, pages } = useConnectedTargets();
  const [state, setState] = useState<RadarFormState>(() => initialState(initialCategory, initialTheme));
  const [sources, setSources] = useState<SourceDraft[]>([emptySource("YOUTUBE_SEARCH")]);
  const [addingSource, setAddingSource] = useState(false);
  const [connectors, setConnectors] = useState<ConnectorMap>({});
  const [instagramAccountId, setInstagramAccountId] = useState("");
  const [publishToInstagram, setPublishToInstagram] = useState(true);
  const [facebookPageIds, setFacebookPageIds] = useState<string[]>([]);
  const [schedule, setSchedule] = useState<QueueScheduleConfig>({ ...DEFAULT_SCHEDULE, publishTimes: ["09:00", "15:00", "20:00"], postsPerDay: 3, timezone: "America/Sao_Paulo" });
  const [captionTemplate, setCaptionTemplate] = useState(() => defaultCaptionTemplate(initialCategory, initialTheme));
  const [activatePublishing, setActivatePublishing] = useState(false);
  const [rightsConfirmed, setRightsConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch("/api/viral-radars")
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { connectors?: ConnectorMap } | null) => data?.connectors && setConnectors(data.connectors))
      .catch(() => undefined);
  }, []);

  const connectedAccounts = (accounts ?? []).filter((account) => account.status === "connected");

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!instagramAccountId) return setError("Escolha a conta do Instagram de destino.");
    if (!rightsConfirmed) return setError("Confirme a declaração de direitos.");
    setSubmitting(true);
    try {
      const response = await fetch("/api/viral-radars", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...toRequestBody(state),
          sources,
          rightsConfirmed,
          activatePublishing,
          publication: { instagramAccountId, publishToInstagram, facebookPageIds, schedule, captionTemplate },
        }),
      });
      if (!response.ok) return setError(await readApiError(response, "Não foi possível criar o radar."));
      const data = (await response.json()) as { radarId: string };
      router.push(`/radar-viral/${data.radarId}?criado=1`);
    } catch {
      setError("Não foi possível criar o radar. Confira a conexão e tente de novo.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900">Novo Radar Viral</h1>
        <p className="mt-1 max-w-3xl text-sm text-zinc-600">
          O radar pesquisa conteúdos em alta, calcula o Viral Score e alimenta a fila de publicação só com vídeos próprios ou licenciados. Vídeos de terceiros ficam como referência ou aguardando a sua autorização.
        </p>
      </div>

      <RadarSettingsFields value={state} onChange={setState} />

      <section className="space-y-3 rounded-lg border border-zinc-200 bg-white p-4">
        <h2 className="font-semibold text-zinc-900">Fontes de pesquisa</h2>
        <ul className="space-y-2">
          {sources.map((source, index) => (
            <li key={`${source.type}-${index}`} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-zinc-50 px-3 py-2 text-sm">
              <span>
                <strong>{SOURCE_TYPE_LABEL[source.type]}</strong>
                {source.config.url ? ` · ${source.config.url}` : ""}
                {source.config.channelId ? ` · ${source.config.channelId}` : ""}
                <span className="ml-2 text-xs text-zinc-600">{LICENSE_LABEL[source.license]}</span>
                {connectors[source.type] && !connectors[source.type]!.available ? <span className="ml-2 text-xs text-amber-700">(pendente)</span> : null}
              </span>
              <button type="button" className="text-xs font-medium text-red-700" onClick={() => setSources(sources.filter((_, i) => i !== index))}>
                Remover
              </button>
            </li>
          ))}
        </ul>
        {addingSource ? (
          <SourceEditor
            connectors={connectors}
            submitLabel="Adicionar fonte"
            onCancel={() => setAddingSource(false)}
            onSubmit={(draft) => {
              if (draft.type === "RSS" && !draft.config.url) return "Informe o endereço do feed.";
              if (draft.type === "YOUTUBE_CHANNEL" && !draft.config.channelId) return "Informe o ID do canal.";
              if (draft.license !== "NONE" && !draft.rightsConfirmed) return "Confirme a declaração de direitos desta fonte.";
              setSources([...sources, draft]);
              setAddingSource(false);
              return null;
            }}
          />
        ) : (
          <button type="button" className="min-h-10 rounded-md px-3 py-2 text-sm font-medium ring-1 ring-zinc-300" onClick={() => setAddingSource(true)}>
            + Adicionar fonte (canal próprio, feed licenciado, RSS…)
          </button>
        )}
      </section>

      <section className="space-y-4 rounded-lg border border-zinc-200 bg-white p-4">
        <div>
          <h2 className="font-semibold text-zinc-900">Publicação</h2>
          <p className="text-xs text-zinc-600">Usa a Fila de vídeos e o agendador já existentes. Nada é publicado em outra conta além da escolhida.</p>
        </div>
        <label className={labelClass}>
          Conta do Instagram
          <select className={inputClass} value={instagramAccountId} onChange={(event) => setInstagramAccountId(event.target.value)}>
            <option value="">Escolha…</option>
            {connectedAccounts.map((account) => (
              <option key={account.id} value={account.id}>
                @{account.igUsername ?? "?"}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-zinc-800">
          <input type="checkbox" checked={publishToInstagram} onChange={(event) => setPublishToInstagram(event.target.checked)} />
          Publicar no Instagram
        </label>
        <div>
          <span className={labelClass}>Páginas do Facebook (opcional)</span>
          <div className="mt-2">
            <FacebookPagesChooser pages={pages} selected={facebookPageIds} onChange={setFacebookPageIds} />
          </div>
        </div>
        <QueueScheduleEditor value={schedule} onChange={setSchedule} />
        <label className={labelClass}>
          Modelo de legenda (usado quando a legenda não é gerada por IA)
          <textarea className={`${inputClass} h-24`} value={captionTemplate} onChange={(event) => setCaptionTemplate(event.target.value)} />
        </label>
        <label className="flex items-start gap-2 text-sm text-zinc-800">
          <input type="checkbox" className="mt-1" checked={activatePublishing} onChange={(event) => setActivatePublishing(event.target.checked)} />
          Ativar a publicação automática agora (senão a fila fica em rascunho até você ativar no painel)
        </label>
      </section>

      <label className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <input type="checkbox" className="mt-1" checked={rightsConfirmed} onChange={(event) => setRightsConfirmed(event.target.checked)} />
        Entendo que o radar só publica automaticamente vídeos próprios ou licenciados (com declaração registrada) e vídeos de terceiros que eu aprovar declarando a autorização do dono. Vídeos públicos não são considerados autorizados.
      </label>

      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <button type="submit" disabled={submitting} className="min-h-11 rounded-md bg-zinc-900 px-5 py-2 text-sm font-semibold text-white disabled:opacity-60">
        {submitting ? "Criando…" : "Criar radar"}
      </button>
    </form>
  );
}
