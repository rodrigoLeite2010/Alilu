"use client";

import { useState } from "react";
import { uploadPresigned } from "@vercel/blob/client";
import { clearPickerMark, markPickerOpen, trackUpload } from "@/lib/client/upload-telemetry";
import { FileNotReadableError, ensureReadableFile } from "@/lib/client/file-readability";
import { Button, LinkButton } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { INSTAGRAM_IMPORT_KIND_LABEL, parseInstagramUrl } from "@/lib/instagram-import/url";
import type { InstagramImportDto } from "@/lib/instagram-import/backend/import-dto";

type Stage = "idle" | "resolving" | "preview" | "importing" | "done";

async function readError(response: Response, fallback: string): Promise<{ message: string; manualUpload: boolean; code: string | null }> {
  try {
    const body = (await response.json()) as { error?: string; manualUpload?: boolean; code?: string };
    return { message: body.error || fallback, manualUpload: Boolean(body.manualUpload), code: body.code ?? null };
  } catch {
    return { message: fallback, manualUpload: true, code: null };
  }
}

export function formatDuration(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds)) return "—";
  const total = Math.round(seconds);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export function formatResolution(width: number | null, height: number | null): string {
  return width && height ? `${width}×${height}` : "—";
}

/** O que fazer com o arquivo importado: as 3 saídas pedidas (split-screen, Reels, baixar). */
export function ImportedActions({ item }: { item: InstagramImportDto }) {
  if (!item.fileUrl) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {item.mediaType === "VIDEO" ? (
        <>
          <LinkButton href={`/videos/editor-split-screen?importacao=${item.id}`}>Usar no Split-Screen</LinkButton>
          <LinkButton href={`/instagram/reels?importacao=${item.id}`} variant="secondary">
            Publicar no Reels
          </LinkButton>
        </>
      ) : null}
      <LinkButton href={`${item.fileUrl}?download=1`} variant="secondary">
        Baixar
      </LinkButton>
    </div>
  );
}

/**
 * Vídeos > Importar do Instagram: colar link público → prévia → importar
 * para o storage do Alilu → usar no split-screen, publicar no Reels ou
 * baixar. Sem login no Instagram, sem senha/cookie. Fallback: upload manual.
 */
export function InstagramImporter({ userId }: { userId: string }) {
  const [url, setUrl] = useState("");
  const [authorized, setAuthorized] = useState(false);
  const [stage, setStage] = useState<Stage>("idle");
  const [error, setError] = useState<string | null>(null);
  const [offerManual, setOfferManual] = useState(false);
  const [preview, setPreview] = useState<InstagramImportDto | null>(null);
  const [selected, setSelected] = useState(0);
  const [duplicate, setDuplicate] = useState<InstagramImportDto | null>(null);
  const [result, setResult] = useState<InstagramImportDto | null>(null);
  const [uploading, setUploading] = useState(false);

  const urlCheck = url.trim() ? parseInstagramUrl(url) : null;

  function reset() {
    setUrl("");
    setStage("idle");
    setError(null);
    setOfferManual(false);
    setPreview(null);
    setDuplicate(null);
    setResult(null);
    setSelected(0);
  }

  async function resolve(force = false) {
    setError(null);
    setOfferManual(false);
    setDuplicate(null);
    if (!authorized) {
      setError("Confirme que o conteúdo é seu ou que você tem autorização para usá-lo.");
      return;
    }
    if (!urlCheck || !urlCheck.ok) {
      setError(urlCheck && !urlCheck.ok ? urlCheck.message : "Cole o link do Instagram.");
      return;
    }
    setStage("resolving");
    try {
      const response = await fetch("/api/videos/instagram-import/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim(), authorized: true, force }),
      });
      if (!response.ok) {
        const failure = await readError(response, "Não conseguimos importar agora. Tente novamente ou faça upload manual.");
        setError(failure.message);
        setOfferManual(failure.manualUpload || failure.code === "PRIVATE_CONTENT" || failure.code === "UNSUPPORTED");
        setStage("idle");
        return;
      }
      const body = (await response.json()) as { import: InstagramImportDto | null; duplicate: InstagramImportDto | null };
      if (body.duplicate) {
        setDuplicate(body.duplicate);
        setStage("idle");
        return;
      }
      setPreview(body.import);
      setSelected(0);
      setStage("preview");
    } catch {
      setError("Não conseguimos importar agora. Tente novamente ou faça upload manual.");
      setOfferManual(true);
      setStage("idle");
    }
  }

  async function confirmImport() {
    if (!preview) return;
    setStage("importing");
    setError(null);
    try {
      const response = await fetch(`/api/videos/instagram-import/${preview.id}/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemIndex: selected }),
      });
      if (!response.ok) {
        const failure = await readError(response, "Não conseguimos importar agora. Tente novamente ou faça upload manual.");
        setError(failure.message);
        setOfferManual(true);
        setStage("preview");
        return;
      }
      setResult(((await response.json()) as { import: InstagramImportDto }).import);
      setStage("done");
    } catch {
      setError("Não conseguimos importar agora. Tente novamente ou faça upload manual.");
      setOfferManual(true);
      setStage("preview");
    }
  }

  async function manualUpload(picked: File | null) {
    clearPickerMark();
    if (!picked) {
      trackUpload("instagram-import", "no_file");
      return;
    }
    // Celular: galeria às vezes manda o arquivo sem tipo — deduz pela extensão.
    const lower = picked.name.toLowerCase();
    const inferred = lower.endsWith(".mov") ? "video/quicktime" : lower.endsWith(".mp4") ? "video/mp4" : lower.match(/\.jpe?g$/) ? "image/jpeg" : null;
    const typed = !picked.type && inferred ? new File([picked], picked.name, { type: inferred, lastModified: picked.lastModified }) : picked;
    let file: File;
    try {
      file = await ensureReadableFile(typed);
    } catch (err) {
      trackUpload("instagram-import", "validation_error", { file: typed, message: "arquivo ilegível" });
      setError(err instanceof FileNotReadableError ? err.message : "Não foi possível abrir esse arquivo.");
      return;
    }
    trackUpload("instagram-import", "file_selected", { file });
    if (!["video/mp4", "video/quicktime", "image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      trackUpload("instagram-import", "validation_error", { file, message: "formato" });
      setError(`Formato não suportado${file.type ? ` (${file.type})` : ""}. Use vídeo MP4/MOV ou imagem JPG/PNG/WebP.`);
      return;
    }
    if (!authorized) {
      setError("Confirme que o conteúdo é seu ou que você tem autorização para usá-lo.");
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const extension = file.type === "video/quicktime" ? "mov" : file.type.startsWith("image/") ? file.type.split("/")[1].replace("jpeg", "jpg") : "mp4";
      trackUpload("instagram-import", "upload_start", { file });
      const uploaded = await uploadPresigned(`videos/imports/${userId}/manual/upload.${extension}`, file, {
        access: "public",
        handleUploadUrl: "/api/videos/instagram-import/upload",
      }).catch((err: unknown) => {
        trackUpload("instagram-import", "upload_error", { file, message: err instanceof Error ? err.message : "erro" });
        throw new Error("Não foi possível enviar o arquivo. Confira a conexão (Wi-Fi/4G) e tente de novo.");
      });
      trackUpload("instagram-import", "upload_done", { file });
      const response = await fetch("/api/videos/instagram-import/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blobUrl: uploaded.url, authorized: true, originalUrl: url.trim() || null }),
      });
      if (!response.ok) {
        setError((await readError(response, "Não foi possível usar este arquivo.")).message);
        return;
      }
      setResult(((await response.json()) as { import: InstagramImportDto }).import);
      setStage("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível enviar o arquivo.");
    } finally {
      setUploading(false);
    }
  }

  if (stage === "done" && result) {
    return (
      <section className="space-y-4 rounded-lg border border-teal-200 bg-teal-50/40 p-4 sm:p-6">
        <p className="text-base font-semibold text-teal-900">{result.mediaType === "VIDEO" ? "Vídeo importado com sucesso." : "Imagem importada com sucesso."}</p>
        {result.mediaType === "VIDEO" && result.fileUrl ? (
          <video src={result.fileUrl} controls playsInline className="max-h-[420px] w-full max-w-sm rounded-md border border-zinc-200 bg-black" />
        ) : result.fileUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- arquivo importado (Vercel Blob do Alilu).
          <img src={result.fileUrl} alt="Imagem importada" className="max-h-[420px] max-w-sm rounded-md border border-zinc-200" />
        ) : null}
        <p className="text-sm text-zinc-600">
          {formatDuration(result.durationSeconds)} · {formatResolution(result.width, result.height)}
          {result.mediaType === "VIDEO" ? ` · ${result.hasAudio ? "com áudio" : "sem áudio"}` : ""}
        </p>
        <ImportedActions item={result} />
        <div className="flex flex-wrap gap-2 border-t border-teal-100 pt-3">
          <Button type="button" variant="ghost" onClick={reset}>
            Importar outro
          </Button>
          <LinkButton href="/videos/importacoes-instagram" variant="ghost">
            Ver importações
          </LinkButton>
        </div>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <section className="space-y-4 rounded-lg border border-zinc-200 p-4 sm:p-6">
        <div>
          <label htmlFor="instagram-import-url" className="mb-1 block text-sm font-medium text-zinc-800">
            Cole o link do Reel, vídeo ou foto
          </label>
          <input
            id="instagram-import-url"
            type="url"
            inputMode="url"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://www.instagram.com/reel/XXXXXXXX/"
            disabled={stage === "resolving" || stage === "importing"}
            className="min-h-11 w-full rounded-md border border-zinc-300 px-3 text-sm"
          />
          {urlCheck && !urlCheck.ok ? <p className="mt-1 text-xs text-red-600">{urlCheck.message}</p> : null}
        </div>
        <label className="flex items-start gap-2 text-sm text-zinc-800">
          <input type="checkbox" checked={authorized} onChange={(event) => setAuthorized(event.target.checked)} className="mt-0.5 h-4 w-4" />
          Confirmo que este conteúdo é meu ou que tenho autorização para utilizá-lo.
        </label>
        {error ? (
          <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        ) : null}
        {duplicate ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <p className="font-medium">Este conteúdo já foi importado.</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button type="button" variant="secondary" onClick={() => { setResult(duplicate); setStage("done"); }}>
                Abrir existente
              </Button>
              <Button type="button" variant="ghost" onClick={() => resolve(true)}>
                Importar novamente
              </Button>
            </div>
          </div>
        ) : null}
        {stage !== "preview" ? (
          <Button type="button" onClick={() => resolve(false)} disabled={!authorized || stage === "resolving" || !url.trim()} className="w-full justify-center sm:w-auto">
            {stage === "resolving" ? "Identificando o conteúdo…" : "Importar"}
          </Button>
        ) : null}
        {offerManual ? (
          <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700">
            <p>Não foi possível importar automaticamente este conteúdo.</p>
            <label className="mt-2 inline-flex min-h-10 cursor-pointer items-center rounded-md border border-zinc-300 bg-white px-3 font-medium text-zinc-800 hover:bg-zinc-50">
              {uploading ? "Enviando…" : "Fazer upload do vídeo"}
              <input
                type="file"
                accept="video/*,image/*,.mp4,.mov"
                className="sr-only"
                disabled={uploading}
                onClick={() => markPickerOpen("instagram-import")}
                onChange={(event) => manualUpload(event.target.files?.[0] ?? null)}
              />
            </label>
          </div>
        ) : null}
        <p className="text-xs text-zinc-500">
          Utilize apenas conteúdo próprio ou para o qual você tenha autorização. Funciona só com conteúdo público — o Alilu nunca pede
          sua senha, cookie ou login do Instagram.
        </p>
      </section>

      {stage === "preview" || stage === "importing" ? (
        preview ? (
          <section className="space-y-4 rounded-lg border border-zinc-200 p-4 sm:p-6">
            <h2 className="text-base font-semibold text-zinc-900">Prévia</h2>
            <div className="flex flex-wrap gap-3">
              {preview.items.map((item) => (
                <button
                  key={item.index}
                  type="button"
                  onClick={() => setSelected(item.index)}
                  className={`relative overflow-hidden rounded-md border-2 ${selected === item.index ? "border-teal-700" : "border-transparent"}`}
                  aria-pressed={selected === item.index}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- miniatura servida pelo Alilu (proxy seguro). */}
                  <img src={`/api/videos/instagram-import/${preview.id}/thumbnail?item=${item.index}`} alt="" className="h-48 w-auto max-w-[180px] bg-zinc-100 object-cover" />
                  <span className="absolute left-1 top-1">
                    <Badge tone="neutral">{item.mediaType === "VIDEO" ? "Vídeo" : "Foto"}</Badge>
                  </span>
                </button>
              ))}
            </div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4">
              <dt className="text-zinc-500">Tipo</dt>
              <dd className="font-medium text-zinc-900">{INSTAGRAM_IMPORT_KIND_LABEL[preview.kind as keyof typeof INSTAGRAM_IMPORT_KIND_LABEL] ?? preview.kind}</dd>
              <dt className="text-zinc-500">Duração</dt>
              <dd className="font-medium text-zinc-900">{preview.durationSeconds ? formatDuration(preview.durationSeconds) : "medida ao importar"}</dd>
              <dt className="text-zinc-500">Resolução</dt>
              <dd className="font-medium text-zinc-900">{preview.width ? formatResolution(preview.width, preview.height) : "medida ao importar"}</dd>
              <dt className="text-zinc-500">Origem</dt>
              <dd className="truncate font-medium text-zinc-900" title={preview.normalizedUrl}>
                {preview.normalizedUrl.replace("https://www.", "")}
              </dd>
            </dl>
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={confirmImport} disabled={stage === "importing"}>
                {stage === "importing" ? "Importando…" : "Importar para o Alilu"}
              </Button>
              <Button type="button" variant="ghost" onClick={reset} disabled={stage === "importing"}>
                Cancelar
              </Button>
            </div>
          </section>
        ) : null
      ) : null}
    </div>
  );
}
