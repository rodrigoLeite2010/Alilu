"use client";

import Link from "next/link";
import { useState } from "react";
import { uploadPresigned } from "@vercel/blob/client";
import { clearPickerMark, markPickerOpen, trackUpload } from "@/lib/client/upload-telemetry";
import { FileNotReadableError, ensureReadableFile, readFailureReason } from "@/lib/client/file-readability";
import { Button, LinkButton } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { YOUTUBE_KIND_LABEL, isValidYoutubeVideoId, parseYoutubeUrl, type YoutubeUrlKind } from "@/lib/youtube-import/url";
import {
  YOUTUBE_AVAILABILITY_HELP,
  YOUTUBE_AVAILABILITY_LABEL,
  YOUTUBE_IMPORT_MESSAGES,
  YOUTUBE_UPLOAD_CONTENT_TYPES,
  formatClockDuration,
  type YoutubeImportDto,
} from "@/lib/youtube-import/types";

type Stage = "idle" | "analyzing" | "analyzed" | "uploading" | "validating" | "done";

export interface YoutubeQuotaDto {
  used: number;
  limit: number;
  unlimited: boolean;
}

interface Failure {
  message: string;
  code: string | null;
}

async function readFailure(response: Response, fallback: string): Promise<Failure> {
  try {
    const body = (await response.json()) as { error?: string; code?: string };
    return { message: body.error || fallback, code: body.code ?? null };
  } catch {
    return { message: fallback, code: null };
  }
}

function formatBytes(bytes: number | null): string {
  if (!bytes) return "—";
  return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function inferVideoType(file: File): string {
  if (file.type) return file.type;
  const lower = file.name.toLowerCase();
  if (lower.endsWith(".mp4") || lower.endsWith(".m4v")) return "video/mp4";
  if (lower.endsWith(".mov")) return "video/quicktime";
  if (lower.endsWith(".webm")) return "video/webm";
  return "";
}

const EXTENSION: Record<string, string> = { "video/mp4": "mp4", "video/quicktime": "mov", "video/webm": "webm" };
const PREVIEWABLE = new Set(["AVAILABLE", "AGE_RESTRICTED"]);

function availabilityTone(availability: YoutubeImportDto["availability"]): "brand" | "neutral" {
  return availability === "AVAILABLE" ? "brand" : "neutral";
}

/** Saídas para o arquivo JÁ enviado e validado: editor Split-Screen, Reels e baixar o próprio arquivo. */
export function YoutubeImportActions({ item, onDelete }: { item: YoutubeImportDto; onDelete?: () => void }) {
  if (item.status !== "COMPLETED" || !item.fileUrl) return null;
  return (
    <div className="flex flex-wrap gap-2">
      <LinkButton href={`/videos/editor-split-screen?youtube=${item.id}`}>Editar no Split-Screen</LinkButton>
      {item.contentType !== "video/webm" ? (
        <LinkButton href={`/instagram/reels?youtube=${item.id}`} variant="secondary">
          Publicar no Reels
        </LinkButton>
      ) : null}
      <LinkButton href={`${item.fileUrl}?download=1`} variant="secondary">
        Baixar meu arquivo
      </LinkButton>
      {onDelete ? (
        <Button type="button" variant="ghost" onClick={onDelete}>
          Excluir
        </Button>
      ) : null}
    </div>
  );
}

/** Player OFICIAL incorporado (modo de privacidade aprimorada), carregado só quando a pessoa pede. */
function OfficialPreview({ item }: { item: YoutubeImportDto }) {
  const [playing, setPlaying] = useState(false);
  const canEmbed = item.embeddable && PREVIEWABLE.has(item.availability) && isValidYoutubeVideoId(item.videoId);
  const vertical = item.kind === "short";
  const frameClass = vertical ? "aspect-[9/16] w-full max-w-[280px]" : "aspect-video w-full";
  if (playing && canEmbed) {
    return (
      <div className={`${frameClass} overflow-hidden rounded-md bg-black`}>
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${item.videoId}?rel=0&modestbranding=1`}
          title={item.title ?? "Prévia do vídeo no YouTube"}
          className="h-full w-full"
          allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
          data-testid="youtube-embed"
        />
      </div>
    );
  }
  return (
    <div className={`relative ${frameClass} overflow-hidden rounded-md bg-zinc-100`}>
      {item.thumbnailUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- miniatura oficial (i.ytimg.com) devolvida pela API do YouTube.
        <img src={item.thumbnailUrl} alt={item.title ? `Miniatura: ${item.title}` : "Miniatura do vídeo"} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
      ) : (
        <div className="flex h-full w-full items-center justify-center p-4 text-center text-sm text-zinc-500">Miniatura indisponível</div>
      )}
      {canEmbed ? (
        <button
          type="button"
          onClick={() => setPlaying(true)}
          className="absolute inset-0 flex items-center justify-center bg-black/30 text-sm font-semibold text-white transition-colors hover:bg-black/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
        >
          <span className="rounded-full bg-black/70 px-4 py-2">▶ Ver prévia no player do YouTube</span>
        </button>
      ) : null}
    </div>
  );
}

/**
 * Vídeos > Importar do YouTube.
 *
 * 1) Cola o link → a Alilu consulta os dados públicos na API oficial.
 * 2) Mostra miniatura, título, canal, duração, disponibilidade e a prévia no player oficial.
 * 3) A Alilu NÃO baixa o vídeo do YouTube. Para editar, a pessoa envia o arquivo
 *    original que ela tem direito de usar; só depois que o servidor valida o
 *    arquivo a tela diz que está pronto e libera o editor.
 */
export function YoutubeImporter({
  userId,
  initialQuota = null,
  maxUploadMb,
  maxDurationMinutes,
  initialHistory = [],
}: {
  userId: string;
  initialQuota?: YoutubeQuotaDto | null;
  maxUploadMb: number;
  maxDurationMinutes: number;
  initialHistory?: YoutubeImportDto[];
}) {
  const [quota, setQuota] = useState<YoutubeQuotaDto | null>(initialQuota);
  const [url, setUrl] = useState("");
  const [authorized, setAuthorized] = useState(false);
  const [stage, setStage] = useState<Stage>("idle");
  const [error, setError] = useState<string | null>(null);
  const [planRequired, setPlanRequired] = useState(false);
  const [analysis, setAnalysis] = useState<YoutubeImportDto | null>(null);
  const [duplicate, setDuplicate] = useState<YoutubeImportDto | null>(null);
  const [result, setResult] = useState<YoutubeImportDto | null>(null);
  const [uploadPercent, setUploadPercent] = useState(0);
  const [history, setHistory] = useState<YoutubeImportDto[]>(initialHistory);

  const urlCheck = url.trim() ? parseYoutubeUrl(url) : null;
  const busy = stage === "analyzing" || stage === "uploading" || stage === "validating";

  function reset() {
    setUrl("");
    setStage("idle");
    setError(null);
    setPlanRequired(false);
    setAnalysis(null);
    setDuplicate(null);
    setResult(null);
    setUploadPercent(0);
  }

  async function analyze(force = false) {
    setError(null);
    setPlanRequired(false);
    setDuplicate(null);
    if (!authorized) {
      setError(YOUTUBE_IMPORT_MESSAGES.AUTHORIZATION_REQUIRED);
      return;
    }
    if (!urlCheck || !urlCheck.ok) {
      setError(urlCheck && !urlCheck.ok ? urlCheck.message : "Cole o link do vídeo do YouTube.");
      return;
    }
    setStage("analyzing");
    setAnalysis(null);
    try {
      const response = await fetch("/api/videos/youtube-import/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim(), authorized: true, force }),
      });
      if (!response.ok) {
        const failure = await readFailure(response, YOUTUBE_IMPORT_MESSAGES.CONNECTION);
        setError(response.status === 401 ? "Sua sessão expirou. Entre de novo na sua conta." : failure.message);
        setPlanRequired(failure.code === "PLAN_REQUIRED");
        setStage("idle");
        return;
      }
      const body = (await response.json()) as { import: YoutubeImportDto | null; duplicate: YoutubeImportDto | null; quota?: YoutubeQuotaDto };
      if (body.quota) setQuota(body.quota);
      if (body.duplicate) {
        setDuplicate(body.duplicate);
        setStage("idle");
        return;
      }
      setAnalysis(body.import);
      setStage("analyzed");
    } catch {
      setError(YOUTUBE_IMPORT_MESSAGES.CONNECTION);
      setStage("idle");
    }
  }

  async function uploadOriginal(picked: File | null) {
    clearPickerMark();
    if (!analysis) return;
    if (!picked) {
      trackUpload("youtube-import", "no_file");
      return;
    }
    setError(null);
    const type = inferVideoType(picked);
    const typed = !picked.type && type ? new File([picked], picked.name, { type, lastModified: picked.lastModified }) : picked;
    let file: File;
    try {
      file = await ensureReadableFile(typed);
    } catch (err) {
      trackUpload("youtube-import", "validation_error", { file: typed, message: `arquivo ilegível: ${readFailureReason(err)}` });
      setError(err instanceof FileNotReadableError ? err.message : "Não foi possível abrir esse arquivo.");
      return;
    }
    trackUpload("youtube-import", "file_selected", { file });
    if (!(YOUTUBE_UPLOAD_CONTENT_TYPES as readonly string[]).includes(file.type)) {
      trackUpload("youtube-import", "validation_error", { file, message: "formato" });
      setError(`Formato não suportado${file.type ? ` (${file.type})` : ""}. Envie o vídeo em MP4, MOV ou WEBM.`);
      return;
    }
    if (file.size > maxUploadMb * 1024 * 1024) {
      trackUpload("youtube-import", "validation_error", { file, message: "tamanho" });
      setError(`${YOUTUBE_IMPORT_MESSAGES.TOO_LARGE} O limite é ${maxUploadMb} MB (este tem ${formatBytes(file.size)}).`);
      return;
    }
    if (!authorized) {
      setError(YOUTUBE_IMPORT_MESSAGES.AUTHORIZATION_REQUIRED);
      return;
    }
    setStage("uploading");
    setUploadPercent(0);
    try {
      trackUpload("youtube-import", "upload_start", { file });
      const uploaded = await uploadPresigned(`videos/imports/${userId}/youtube/${analysis.id}/original.${EXTENSION[file.type] ?? "mp4"}`, file, {
        access: "public",
        handleUploadUrl: "/api/videos/youtube-import/upload",
        onUploadProgress: ({ percentage }) => setUploadPercent(Math.round(percentage)),
      }).catch((err: unknown) => {
        trackUpload("youtube-import", "upload_error", { file, message: err instanceof Error ? err.message : "erro" });
        throw new Error(YOUTUBE_IMPORT_MESSAGES.UPLOAD_FAILED);
      });
      trackUpload("youtube-import", "upload_done", { file });
      setStage("validating");
      const response = await fetch(`/api/videos/youtube-import/${analysis.id}/file`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blobUrl: uploaded.url, authorized: true }),
      });
      if (!response.ok) {
        setError((await readFailure(response, YOUTUBE_IMPORT_MESSAGES.INVALID_FILE)).message);
        setStage("analyzed");
        return;
      }
      const record = ((await response.json()) as { import: YoutubeImportDto }).import;
      // Só diz "pronto" quando o servidor confirmou o arquivo validado e disponível.
      if (record.status !== "COMPLETED" || !record.fileUrl) {
        setError("O arquivo ainda não está disponível para edição. Tente enviar de novo.");
        setStage("analyzed");
        return;
      }
      setResult(record);
      setHistory((previous) => [record, ...previous.filter((item) => item.id !== record.id)].slice(0, 20));
      setStage("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : YOUTUBE_IMPORT_MESSAGES.UPLOAD_FAILED);
      setStage("analyzed");
    }
  }

  async function remove(item: YoutubeImportDto) {
    if (!window.confirm("Excluir esta importação e o arquivo enviado? Essa ação não pode ser desfeita.")) return;
    const response = await fetch(`/api/videos/youtube-import/${item.id}`, { method: "DELETE" });
    if (!response.ok) {
      setError((await readFailure(response, "Não foi possível excluir agora.")).message);
      return;
    }
    setHistory((previous) => previous.filter((entry) => entry.id !== item.id));
    if (result?.id === item.id) reset();
  }

  const historySection =
    history.length > 0 ? (
      <section className="space-y-3 rounded-lg border border-zinc-200 p-4 sm:p-6" data-testid="youtube-history">
        <h2 className="text-base font-semibold text-zinc-900">Seus vídeos enviados</h2>
        <ul className="divide-y divide-zinc-100">
          {history.map((item) => (
            <li key={item.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-zinc-900">{item.title ?? `Vídeo ${item.videoId}`}</p>
                <p className="text-xs text-zinc-500">
                  {item.status === "EXPIRED"
                    ? "Arquivo apagado pela limpeza automática — envie de novo para editar."
                    : `${formatClockDuration(item.durationSeconds)} · ${formatBytes(item.fileSizeBytes)}`}
                </p>
              </div>
              {item.status === "COMPLETED" ? <YoutubeImportActions item={item} onDelete={() => void remove(item)} /> : null}
            </li>
          ))}
        </ul>
      </section>
    ) : null;

  if (stage === "done" && result) {
    return (
      <div className="space-y-6">
        <section className="space-y-4 rounded-lg border border-teal-200 bg-teal-50/40 p-4 sm:p-6" data-testid="youtube-import-done">
          <p className="text-base font-semibold text-teal-900">Importação concluída: seu vídeo está pronto para edição.</p>
          {result.fileUrl ? (
            <video src={result.fileUrl} controls playsInline className="max-h-[420px] w-full max-w-sm rounded-md border border-zinc-200 bg-black" />
          ) : null}
          <p className="text-sm text-zinc-600">
            {formatClockDuration(result.durationSeconds)} · {result.width && result.height ? `${result.width}×${result.height}` : "—"} ·{" "}
            {result.hasAudio ? "com áudio" : "sem áudio"} · {formatBytes(result.fileSizeBytes)}
          </p>
          {result.durationMismatch ? (
            <p role="status" className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
              A duração do arquivo ({formatClockDuration(result.durationSeconds)}) é diferente da do vídeo no YouTube (
              {formatClockDuration(result.youtubeDurationSeconds)}). Confira se você enviou o arquivo certo.
            </p>
          ) : null}
          <YoutubeImportActions item={result} />
          <div className="flex flex-wrap gap-2 border-t border-teal-100 pt-3">
            <Button type="button" variant="ghost" onClick={reset}>
              Importar outro vídeo
            </Button>
          </div>
        </section>
        {historySection}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="space-y-4 rounded-lg border border-zinc-200 p-4 sm:p-6">
        <div>
          <label htmlFor="youtube-import-url" className="mb-1 block text-sm font-medium text-zinc-800">
            Cole o link do vídeo, Short ou live do YouTube
          </label>
          {quota ? (
            <p className="mb-2 text-xs text-zinc-500" data-testid="youtube-quota">
              {quota.unlimited ? "Administrador — consultas ilimitadas" : `${Math.min(quota.used, quota.limit)} de ${quota.limit} consultas usadas hoje`}
            </p>
          ) : null}
          <input
            id="youtube-import-url"
            type="url"
            inputMode="url"
            autoComplete="off"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://www.youtube.com/watch?v=… ou https://youtu.be/…"
            disabled={busy}
            className="min-h-11 w-full rounded-md border border-zinc-300 px-3 text-sm"
          />
          {urlCheck && !urlCheck.ok ? <p className="mt-1 text-xs text-red-600">{urlCheck.message}</p> : null}
        </div>
        <label className="flex items-start gap-2 text-sm text-zinc-800">
          <input type="checkbox" checked={authorized} onChange={(event) => setAuthorized(event.target.checked)} className="mt-0.5 h-4 w-4" />
          Confirmo que este vídeo é meu ou que tenho autorização do titular para utilizá-lo.
        </label>
        {error ? (
          <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
            {planRequired ? (
              <>
                {" "}
                <Link href="/planos" className="font-medium underline">
                  Ver planos
                </Link>
              </>
            ) : null}
          </p>
        ) : null}
        {duplicate ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <p className="font-medium">Você já enviou o arquivo deste vídeo.</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setResult(duplicate);
                  setStage("done");
                }}
              >
                Abrir existente
              </Button>
              <Button type="button" variant="ghost" onClick={() => void analyze(true)}>
                Analisar de novo
              </Button>
            </div>
          </div>
        ) : null}
        {stage === "idle" || stage === "analyzing" ? (
          <Button type="button" onClick={() => void analyze(false)} disabled={!authorized || stage === "analyzing" || !url.trim()} className="w-full justify-center sm:w-auto">
            {stage === "analyzing" ? "Analisando o vídeo…" : "Analisar vídeo"}
          </Button>
        ) : null}
        <p className="text-xs text-zinc-500">
          A Alilu consulta só os dados públicos do vídeo pela API oficial do YouTube. Ela não baixa vídeos do YouTube: para editar, você envia o
          arquivo original que tem direito de usar. Ao usar a consulta, você concorda com os{" "}
          <a href="https://www.youtube.com/t/terms" target="_blank" rel="noopener noreferrer" className="underline">
            Termos de Serviço do YouTube
          </a>
          ; o uso de dados segue a{" "}
          <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="underline">
            Política de Privacidade do Google
          </a>{" "}
          e a{" "}
          <Link href="/privacidade" className="underline">
            Política de Privacidade da Alilu
          </Link>
          .
        </p>
      </section>

      {analysis && stage !== "idle" ? (
        <section className="space-y-4 rounded-lg border border-zinc-200 p-4 sm:p-6" data-testid="youtube-analysis">
          <h2 className="text-base font-semibold text-zinc-900">Dados do vídeo</h2>
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <OfficialPreview item={analysis} />
            <div className="min-w-0 space-y-2">
              <p className="break-words text-base font-semibold text-zinc-900" data-testid="youtube-title">
                {analysis.title ?? "Título indisponível"}
              </p>
              <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-sm">
                <dt className="text-zinc-500">Canal</dt>
                <dd className="truncate font-medium text-zinc-900">{analysis.channelTitle ?? "—"}</dd>
                <dt className="text-zinc-500">Tipo</dt>
                <dd className="font-medium text-zinc-900">{YOUTUBE_KIND_LABEL[analysis.kind as YoutubeUrlKind] ?? analysis.kind}</dd>
                <dt className="text-zinc-500">Duração</dt>
                <dd className="font-medium text-zinc-900">
                  {analysis.youtubeDurationSeconds ? formatClockDuration(analysis.youtubeDurationSeconds) : "não informada"}
                </dd>
                <dt className="text-zinc-500">Situação</dt>
                <dd>
                  <Badge tone={availabilityTone(analysis.availability)}>{YOUTUBE_AVAILABILITY_LABEL[analysis.availability]}</Badge>
                </dd>
              </dl>
              <p className="text-sm text-zinc-600">{YOUTUBE_AVAILABILITY_HELP[analysis.availability]}</p>
              {analysis.regionRestricted ? <p className="text-sm text-amber-800">O YouTube restringe este vídeo no Brasil.</p> : null}
              {analysis.warningMessage ? (
                <p role="status" className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900" data-testid="youtube-warning">
                  {analysis.warningMessage}
                </p>
              ) : null}
              <a href={analysis.normalizedUrl} target="_blank" rel="noopener noreferrer" className="inline-block text-sm font-medium text-teal-800 hover:underline">
                Abrir no YouTube ↗
              </a>
            </div>
          </div>

          <div className="space-y-3 rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700 sm:p-4">
            <h3 className="font-semibold text-zinc-900">Como usar este vídeo na Alilu</h3>
            <ul className="space-y-1">
              <li>✓ Consultar os dados públicos e ver a prévia no player oficial do YouTube.</li>
              <li>✕ Baixar o arquivo direto do YouTube — os termos do YouTube não permitem, então a Alilu não faz isso.</li>
              <li>✓ Enviar o arquivo original e editar no Split-Screen ou publicar no Reels.</li>
            </ul>
            <details className="rounded-md bg-white p-3">
              <summary className="cursor-pointer font-medium text-zinc-900">Onde consigo o arquivo original?</summary>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>
                  <strong>Vídeo seu:</strong> no YouTube Studio, abra <em>Conteúdo</em>, passe o mouse no vídeo, toque em <em>⋮ Opções</em> e
                  escolha <em>Baixar</em>. Ou use o arquivo que você gravou e editou.
                </li>
                <li>
                  <strong>Vídeo de outra pessoa:</strong> peça o arquivo original e a autorização por escrito ao titular dos direitos.
                </li>
              </ul>
            </details>
            <p className="text-xs text-zinc-500">
              MP4, MOV ou WEBM · até {maxUploadMb} MB · até {maxDurationMinutes} minutos. O Split-Screen usa até 150 segundos por vídeo final.
            </p>
            <label
              className={`inline-flex min-h-11 cursor-pointer items-center justify-center rounded-md border border-zinc-300 bg-white px-4 font-medium text-zinc-800 hover:bg-zinc-50 ${
                busy || !authorized ? "pointer-events-none opacity-60" : ""
              }`}
            >
              {stage === "uploading" ? `Enviando… ${uploadPercent}%` : stage === "validating" ? "Validando o vídeo…" : "Enviar arquivo original"}
              <input
                type="file"
                accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm,.m4v"
                className="sr-only"
                disabled={busy || !authorized}
                data-testid="youtube-file-input"
                onClick={() => markPickerOpen("youtube-import")}
                onChange={(event) => {
                  void uploadOriginal(event.target.files?.[0] ?? null);
                  event.target.value = "";
                }}
              />
            </label>
            {!authorized ? <p className="text-xs text-red-600">Marque a declaração de autorização acima para enviar o arquivo.</p> : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="ghost" onClick={reset} disabled={busy}>
              Analisar outro link
            </Button>
          </div>
        </section>
      ) : null}

      {historySection}
    </div>
  );
}
