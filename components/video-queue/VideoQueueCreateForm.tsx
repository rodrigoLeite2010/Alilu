"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { VIDEO_QUEUE_CATEGORIES, defaultCaptionTemplate, findCategory } from "@/lib/video-queue/catalog";
import { parseQueueLinks } from "@/lib/video-queue/links";
import { DEFAULT_SCHEDULE, type QueueScheduleConfig } from "@/lib/video-queue/schedule";
import { MAX_LINKS_PER_SUBMISSION, VIDEO_QUEUE_SOURCE_LABEL } from "@/lib/video-queue/types";
import { getBrowserTimeZone } from "@/lib/instagram/schedule-time";
import { FacebookPagesChooser, QueueScheduleEditor, inputClass, labelClass, readApiError, useConnectedTargets } from "./QueueSettingsFields";

interface Props {
  initialCategory: string;
  initialTheme: string;
  initialCaptionTemplate: string;
}

/**
 * "Nova fila": links (um por linha) → categoria/tema → conta Instagram e
 * Páginas do Facebook (escolha EXPLÍCITA, nada pré-selecionado entre
 * várias) → horários → legenda → declaração de direitos. A fila nasce em
 * rascunho: a pessoa confere a programação gerada e só então ativa.
 */
export function VideoQueueCreateForm({ initialCategory, initialTheme, initialCaptionTemplate }: Props) {
  const router = useRouter();
  const { accounts, pages, facebookConfigured } = useConnectedTargets();
  const [category, setCategory] = useState(initialCategory);
  const [theme, setTheme] = useState(initialTheme);
  const [name, setName] = useState(() => `${findCategory(initialCategory)?.themes.find((item) => item.id === initialTheme)?.name ?? "Fila"} — vídeos`);
  const [linksText, setLinksText] = useState("");
  const [instagramAccountId, setInstagramAccountId] = useState("");
  const [publishToInstagram, setPublishToInstagram] = useState(true);
  const [facebookPageIds, setFacebookPageIds] = useState<string[]>([]);
  const [schedule, setSchedule] = useState<QueueScheduleConfig>(() => ({ ...DEFAULT_SCHEDULE, timezone: getBrowserTimeZone() || DEFAULT_SCHEDULE.timezone }));
  const [captionTemplate, setCaptionTemplate] = useState(initialCaptionTemplate);
  const [facebookCaptionTemplate, setFacebookCaptionTemplate] = useState("");
  const [rightsConfirmed, setRightsConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsed = useMemo(() => parseQueueLinks(linksText, MAX_LINKS_PER_SUBMISSION), [linksText]);
  const categoryRecord = findCategory(category);
  const connectedAccounts = (accounts ?? []).filter((account) => account.status === "connected" || account.id === instagramAccountId);

  const changeTheme = (nextCategory: string, nextTheme: string) => {
    const previousDefault = defaultCaptionTemplate(category, theme);
    setCategory(nextCategory);
    setTheme(nextTheme);
    if (captionTemplate === previousDefault) setCaptionTemplate(defaultCaptionTemplate(nextCategory, nextTheme));
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!instagramAccountId) return setError("Escolha a conta do Instagram desta fila.");
    if (!publishToInstagram && facebookPageIds.length === 0) return setError("Escolha pelo menos uma rede: Instagram e/ou uma Página do Facebook.");
    if (!rightsConfirmed) return setError("Confirme que você tem os direitos ou a autorização para republicar estes vídeos.");
    setSubmitting(true);
    try {
      const response = await fetch("/api/video-queues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          category,
          theme,
          links: linksText,
          instagramAccountId,
          publishToInstagram,
          facebookPageIds,
          schedule,
          captionTemplate,
          facebookCaptionTemplate,
          rightsConfirmed,
        }),
      });
      if (!response.ok) {
        setError(await readApiError(response, "Não foi possível criar a fila."));
        return;
      }
      const data = (await response.json()) as { queueId: string };
      router.push(`/instagram/filas/${data.queueId}?criada=1`);
    } catch {
      setError("Não foi possível criar a fila. Confira a conexão e tente de novo.");
    } finally {
      setSubmitting(false);
    }
  };

  const kinds = parsed.accepted.reduce<Record<string, number>>((acc, link) => ({ ...acc, [link.kind]: (acc[link.kind] ?? 0) + 1 }), {});

  return (
    <form onSubmit={submit} className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900">Nova fila de vídeos</h1>
        <p className="mt-1 text-sm text-zinc-600">Os vídeos são importados em fila e publicados um por horário, nas contas escolhidas, sem você precisar entrar a cada publicação.</p>
      </div>

      <section className="space-y-3">
        <h2 className="font-semibold text-zinc-900">1. Categoria e tema</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className={labelClass}>
            Categoria
            <select className={inputClass} value={category} onChange={(event) => changeTheme(event.target.value, findCategory(event.target.value)?.themes[0]?.id ?? "")}>
              {VIDEO_QUEUE_CATEGORIES.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label className={labelClass}>
            Tema
            <select className={inputClass} value={theme} onChange={(event) => changeTheme(category, event.target.value)}>
              {categoryRecord?.themes.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label className={labelClass}>
            Nome da fila
            <input className={inputClass} value={name} maxLength={80} onChange={(event) => setName(event.target.value)} required />
          </label>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold text-zinc-900">2. Links dos vídeos</h2>
        <label className={labelClass}>
          Cole os links dos vídeos, um por linha
          <textarea
            className={`${inputClass} h-40 font-mono text-xs`}
            placeholder={"https://exemplo.com/video1.mp4\nhttps://exemplo.com/video2.mp4"}
            value={linksText}
            onChange={(event) => setLinksText(event.target.value)}
          />
        </label>
        <p className="text-xs text-zinc-600">
          {parsed.accepted.length} link(s) válido(s)
          {Object.entries(kinds).length > 0 ? ` (${Object.entries(kinds).map(([kind, count]) => `${count} ${VIDEO_QUEUE_SOURCE_LABEL[kind as keyof typeof VIDEO_QUEUE_SOURCE_LABEL]}`).join(", ")})` : ""}
          {parsed.duplicates.length > 0 ? ` · ${parsed.duplicates.length} repetido(s) ignorado(s)` : ""}
          {parsed.rejected.length > 0 ? ` · ${parsed.rejected.length} recusado(s)` : ""}
          {parsed.overLimit ? ` · máximo de ${MAX_LINKS_PER_SUBMISSION} por envio (adicione o resto depois)` : ""}
        </p>
        {parsed.rejected.length > 0 ? (
          <ul className="max-h-24 overflow-auto text-xs text-red-700">
            {parsed.rejected.slice(0, 10).map((item) => (
              <li key={item.sourceUrl}>
                {item.sourceUrl} — {item.reason}
              </li>
            ))}
          </ul>
        ) : null}
        <p className="text-xs text-zinc-500">
          Arquivos diretos (MP4/MOV) são baixados com segurança. Links do Instagram usam o importador do Alilu (planos pagos). YouTube, TikTok e
          outras plataformas não são baixados: o vídeo fica aguardando você enviar o arquivo autorizado.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold text-zinc-900">3. Onde publicar</h2>
        <label className={labelClass}>
          Conta do Instagram
          <select className={inputClass} value={instagramAccountId} onChange={(event) => setInstagramAccountId(event.target.value)}>
            <option value="">{accounts === null ? "Carregando…" : "Escolha a conta"}</option>
            {connectedAccounts.map((account) => (
              <option key={account.id} value={account.id}>
                @{account.igUsername ?? "conta"}
              </option>
            ))}
          </select>
        </label>
        {accounts !== null && connectedAccounts.length === 0 ? (
          <p className="text-sm text-amber-700">
            Nenhuma conta do Instagram conectada.{" "}
            <a className="underline" href="/api/instagram/oauth/start?returnTo=%2Finstagram%2Ffilas%2Fnova">
              Conectar Instagram
            </a>
          </p>
        ) : null}
        <label className="flex items-center gap-2 text-sm text-zinc-800">
          <input type="checkbox" checked={publishToInstagram} onChange={(event) => setPublishToInstagram(event.target.checked)} />
          Publicar no Instagram
        </label>
        {facebookConfigured ? (
          <div>
            <p className={labelClass}>Páginas do Facebook (opcional)</p>
            <div className="mt-2">
              <FacebookPagesChooser pages={pages} selected={facebookPageIds} onChange={setFacebookPageIds} />
            </div>
          </div>
        ) : null}
        <p className="text-xs text-zinc-500">Os vídeos desta fila só vão para as contas marcadas aqui — nunca para outra conta conectada.</p>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold text-zinc-900">4. Horários e frequência</h2>
        <QueueScheduleEditor value={schedule} onChange={setSchedule} />
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold text-zinc-900">5. Legenda</h2>
        <label className={labelClass}>
          Template de legenda (Instagram)
          <textarea className={`${inputClass} h-28`} value={captionTemplate} maxLength={2200} onChange={(event) => setCaptionTemplate(event.target.value)} />
        </label>
        <p className="text-xs text-zinc-500">
          Variáveis: {"{titulo}"}, {"{tema}"}, {"{categoria}"}, {"{numero}"}, {"{total}"}. Sem variáveis = mesma legenda para todos. No painel da fila
          você pode escrever (ou gerar com IA e revisar) a legenda de cada vídeo. Descreva o conteúdo real: não chame vídeo de fã de trailer oficial.
        </p>
        <label className={labelClass}>
          Template de legenda do Facebook (opcional — vazio usa a do Instagram)
          <textarea className={`${inputClass} h-20`} value={facebookCaptionTemplate} onChange={(event) => setFacebookCaptionTemplate(event.target.value)} />
        </label>
      </section>

      <section className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
        <label className="flex items-start gap-2 text-sm text-zinc-800">
          <input type="checkbox" className="mt-1" checked={rightsConfirmed} onChange={(event) => setRightsConfirmed(event.target.checked)} />
          Declaro que os vídeos são meus ou que tenho os direitos/autorização para republicá-los nessas contas. Vídeo público não significa vídeo liberado para
          republicação.
        </label>
      </section>

      {error ? <p className="text-sm font-medium text-red-700">{error}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={submitting}>
          {submitting ? "Criando…" : "Criar fila e ver a programação"}
        </Button>
        <Link href="/instagram/filas" className="inline-flex min-h-11 items-center px-3 text-sm text-zinc-600 hover:underline">
          Cancelar
        </Link>
      </div>
    </form>
  );
}
