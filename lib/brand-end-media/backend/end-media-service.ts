import "server-only";
import { createHash, randomUUID } from "node:crypto";
import path from "node:path";
import { copy, del as deleteBlob, put } from "@vercel/blob";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { buildMediaPathnamePrefix } from "@/lib/instagram/backend/media-service";
import { getInstagramMediaById, insertInstagramMedia } from "@/lib/instagram/backend/media-repository";
import {
  CAROUSEL_FULL_MESSAGE,
  CAROUSEL_MAX_ITEMS_WITH_END,
  END_MEDIA_MAX_IMAGE_BYTES,
  END_MEDIA_MAX_VIDEO_BYTES,
  END_MEDIA_MAX_VIDEO_SECONDS,
  END_MEDIA_SLOTS,
  endMediaUploadPrefix,
  isVideoSlot,
  type CarouselEndMediaChoice,
  type EndMediaAssetDto,
  type EndMediaSettingsDto,
  type EndMediaSlot,
  type EndMediaSummaryDto,
} from "../end-media-config";
import {
  buildAppendEndClipArgs,
  buildNormalizeEndClipArgs,
  endClipCacheKey,
  endClipDuration,
  type OutputSize,
} from "../end-media-ffmpeg";
import {
  deleteEndMediaAsset,
  findCachedRender,
  getEndMediaAsset,
  getRenderByResultMedia,
  getEndMediaSettings,
  insertRender,
  listEndMediaAssets,
  recordEndMediaEvent,
  saveEndMediaSettings,
  saveNormalizedVariant,
  upsertEndMediaAsset,
  type EndMediaAssetRecord,
  type EndMediaRenderRecord,
} from "./end-media-repository";
import {
  EndMediaProcessingError,
  downloadToFile,
  probeVideoFile,
  readFile,
  requireFfmpeg,
  runTool,
  withWorkDir,
} from "./end-media-processing";

export class EndMediaValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EndMediaValidationError";
  }
}

export const REEL_OUTPUT_SIZE: OutputSize = { width: 1080, height: 1920 };

function toAssetDto(asset: EndMediaAssetRecord): EndMediaAssetDto {
  return {
    slot: asset.slot,
    url: asset.storageUrl,
    contentType: asset.contentType,
    fileSizeBytes: asset.fileSizeBytes,
    width: asset.width,
    height: asset.height,
    durationSeconds: asset.durationSeconds,
    hasAudio: asset.hasAudio,
  };
}

export async function getEndMediaSummary(userId: string): Promise<EndMediaSummaryDto> {
  const [settings, assets] = await Promise.all([getEndMediaSettings(userId), listEndMediaAssets(userId)]);
  return { settings, assets: Object.fromEntries(assets.map((asset) => [asset.slot, toAssetDto(asset)])) };
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.round(parsed * 10) / 10));
}

/** Valida tudo do lado do servidor — o frontend nunca decide o dono nem os limites. */
export async function updateEndMediaSettings(userId: string, input: Record<string, unknown>): Promise<EndMediaSettingsDto> {
  const current = await getEndMediaSettings(userId);
  const maxVideo = input.maxVideoSeconds === null || input.maxVideoSeconds === "" ? null : input.maxVideoSeconds;
  return saveEndMediaSettings(userId, {
    carouselEnabled: bool(input.carouselEnabled, current.carouselEnabled),
    reelEnabled: bool(input.reelEnabled, current.reelEnabled),
    reelMediaKind: input.reelMediaKind === "IMAGE" ? "IMAGE" : input.reelMediaKind === "VIDEO" ? "VIDEO" : current.reelMediaKind,
    splitEnabled: bool(input.splitEnabled, current.splitEnabled),
    imageDurationSeconds: clampNumber(input.imageDurationSeconds, 1, 10, current.imageDurationSeconds),
    maxVideoSeconds: maxVideo === undefined ? current.maxVideoSeconds : maxVideo === null ? null : clampNumber(maxVideo, 1, END_MEDIA_MAX_VIDEO_SECONDS, END_MEDIA_MAX_VIDEO_SECONDS),
    keepAudio: bool(input.keepAudio, current.keepAudio),
    fadeSeconds: clampNumber(input.fadeSeconds, 0, 0.5, current.fadeSeconds),
    applyAutomatically: bool(input.applyAutomatically, current.applyAutomatically),
  });
}

function storageKeyFromUrl(url: string): string {
  try {
    return decodeURIComponent(new URL(url).pathname.replace(/^\//, ""));
  } catch {
    return "";
  }
}

function assertOwnUpload(userId: string, url: string): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new EndMediaValidationError("Arquivo inválido.");
  }
  const key = storageKeyFromUrl(url);
  if (parsed.protocol !== "https:" || !parsed.hostname.endsWith(".blob.vercel-storage.com") || !key.startsWith(endMediaUploadPrefix(userId)) || key.includes("..")) {
    throw new EndMediaValidationError("Arquivo inválido.");
  }
  return key;
}

async function deleteAssetFiles(asset: EndMediaAssetRecord | null): Promise<void> {
  if (!asset) return;
  const urls = [asset.storageUrl, ...Object.values(asset.normalized)];
  await Promise.all(urls.map((url) => deleteBlob(url).catch(() => undefined)));
}

const SLOT_TOGGLE: Record<EndMediaSlot, keyof EndMediaSettingsDto> = {
  CAROUSEL_IMAGE: "carouselEnabled",
  REEL_VIDEO: "reelEnabled",
  REEL_IMAGE: "reelEnabled",
  SPLIT_VIDEO: "splitEnabled",
};

/**
 * Recebe o arquivo já enviado direto ao Blob (prefixo do próprio usuário),
 * valida PELO CONTEÚDO, converte imagem para JPEG (formato aceito pela
 * Meta), pré-normaliza o vídeo para o Reel (cache) e grava no slot.
 */
export async function saveUploadedEndMedia(userId: string, input: { slot?: unknown; url?: unknown }): Promise<EndMediaSummaryDto> {
  const slot = END_MEDIA_SLOTS.find((candidate) => candidate === input.slot);
  if (!slot) throw new EndMediaValidationError("Tipo de mídia final inválido.");
  const url = typeof input.url === "string" ? input.url : "";
  const uploadedKey = assertOwnUpload(userId, url);
  const hadAsset = Boolean(await getEndMediaAsset(userId, slot));

  const record = await withWorkDir(async (dir) => {
    const localPath = path.join(dir, "upload");
    await downloadToFile(url, localPath, isVideoSlot(slot) ? END_MEDIA_MAX_VIDEO_BYTES : END_MEDIA_MAX_IMAGE_BYTES);
    const buffer = await readFile(localPath);
    if (isVideoSlot(slot)) {
      if (buffer.byteLength > END_MEDIA_MAX_VIDEO_BYTES) throw new EndMediaValidationError("O vídeo passa do limite de 100 MB.");
      let probed;
      try {
        probed = await probeVideoFile(localPath);
      } catch {
        throw new EndMediaValidationError("O arquivo não é um vídeo válido (use MP4, MOV ou WEBM).");
      }
      if (probed.durationSeconds > END_MEDIA_MAX_VIDEO_SECONDS + 0.5) {
        throw new EndMediaValidationError(`O vídeo de encerramento pode ter no máximo ${END_MEDIA_MAX_VIDEO_SECONDS} segundos.`);
      }
      const lowerKey = uploadedKey.toLowerCase();
      const contentType = lowerKey.endsWith(".mov") ? "video/quicktime" : lowerKey.endsWith(".webm") ? "video/webm" : "video/mp4";
      return {
        storageUrl: url,
        storageKey: uploadedKey,
        contentType,
        fileSizeBytes: buffer.byteLength,
        width: probed.width,
        height: probed.height,
        durationSeconds: Math.round(probed.durationSeconds * 100) / 100,
        videoCodec: probed.codec,
        fps: probed.fps,
        hasAudio: probed.hasAudio,
      };
    }
    if (buffer.byteLength > END_MEDIA_MAX_IMAGE_BYTES) throw new EndMediaValidationError("A imagem passa do limite de 15 MB.");
    let image;
    try {
      image = await loadImage(buffer);
    } catch {
      throw new EndMediaValidationError("O arquivo não é uma imagem válida (use JPG, PNG ou WebP).");
    }
    if (!image.width || !image.height) throw new EndMediaValidationError("O arquivo não é uma imagem válida.");
    // Sempre JPEG (a Meta só aceita JPEG em carrossel) com fundo branco para PNG/WebP transparentes.
    const canvas = createCanvas(image.width, image.height);
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, image.width, image.height);
    ctx.drawImage(image, 0, 0);
    const jpeg = canvas.toBuffer("image/jpeg", 92);
    const blob = await put(`${endMediaUploadPrefix(userId)}${slot.toLowerCase()}-${randomUUID()}.jpg`, jpeg, {
      access: "public",
      contentType: "image/jpeg",
      addRandomSuffix: false,
    });
    await deleteBlob(url).catch(() => undefined);
    return {
      storageUrl: blob.url,
      storageKey: storageKeyFromUrl(blob.url),
      contentType: "image/jpeg",
      fileSizeBytes: jpeg.byteLength,
      width: image.width,
      height: image.height,
      durationSeconds: null,
      videoCodec: null,
      fps: null,
      hasAudio: false,
    };
  });

  const { asset, previous } = await upsertEndMediaAsset({ userId, slot, ...record });
  if (previous && previous.storageUrl !== asset.storageUrl) await deleteAssetFiles(previous);

  // Primeira mídia do slot liga a opção correspondente (empresas antigas nascem desligadas).
  if (!hadAsset) {
    const settings = await getEndMediaSettings(userId);
    const toggle = SLOT_TOGGLE[slot];
    const patch: Partial<EndMediaSettingsDto> = { [toggle]: true };
    if (slot === "REEL_IMAGE" && !(await getEndMediaAsset(userId, "REEL_VIDEO"))) patch.reelMediaKind = "IMAGE";
    if (slot === "REEL_VIDEO") patch.reelMediaKind = "VIDEO";
    await saveEndMediaSettings(userId, { ...settings, ...patch });
  }

  // Pré-normaliza o encerramento no formato de Reel (cache) — falha aqui não impede salvar.
  if (slot !== "CAROUSEL_IMAGE") {
    const settings = await getEndMediaSettings(userId);
    await ensureNormalizedClip(asset, settings, REEL_OUTPUT_SIZE).catch((error: unknown) => {
      console.error(JSON.stringify({ scope: "end-media", event: "prenormalize_failed", userId, slot, message: error instanceof Error ? error.message : String(error) }));
    });
  }
  return getEndMediaSummary(userId);
}

export async function removeEndMedia(userId: string, slotInput: unknown): Promise<EndMediaSummaryDto> {
  const slot = END_MEDIA_SLOTS.find((candidate) => candidate === slotInput);
  if (!slot) throw new EndMediaValidationError("Tipo de mídia final inválido.");
  const removed = await deleteEndMediaAsset(userId, slot);
  // As publicações antigas usam CÓPIAS do arquivo (instagram-media/…), então apagar aqui é seguro.
  await deleteAssetFiles(removed);
  return getEndMediaSummary(userId);
}

// ---------------------------------------------------------------- vídeo

export type VideoEndContext = "REEL" | "SPLIT_SCREEN";

/** Qual mídia usar como encerramento de vídeo (Reels prefere vídeo; Split usa o próprio, senão o do Reels). */
export async function resolveVideoEndAsset(userId: string, context: VideoEndContext, settings: EndMediaSettingsDto): Promise<EndMediaAssetRecord | null> {
  const order: EndMediaSlot[] =
    context === "SPLIT_SCREEN"
      ? ["SPLIT_VIDEO", "REEL_VIDEO", "REEL_IMAGE"]
      : settings.reelMediaKind === "IMAGE"
        ? ["REEL_IMAGE", "REEL_VIDEO"]
        : ["REEL_VIDEO", "REEL_IMAGE"];
  for (const slot of order) {
    const asset = await getEndMediaAsset(userId, slot);
    if (asset) return asset;
  }
  return null;
}

export interface NormalizedEndClip {
  url: string;
  durationSeconds: number;
  kind: "VIDEO" | "IMAGE";
  asset: EndMediaAssetRecord;
  cacheKey: string;
}

function clipOptions(asset: EndMediaAssetRecord, settings: EndMediaSettingsDto) {
  const kind: "VIDEO" | "IMAGE" = isVideoSlot(asset.slot) ? "VIDEO" : "IMAGE";
  const durationSeconds = kind === "IMAGE" ? settings.imageDurationSeconds : settings.maxVideoSeconds;
  return { kind, durationSeconds };
}

/** Trecho de encerramento pronto para emendar no tamanho pedido (gera uma vez e guarda). */
export async function ensureNormalizedClip(asset: EndMediaAssetRecord, settings: EndMediaSettingsDto, size: OutputSize): Promise<NormalizedEndClip> {
  const { kind, durationSeconds } = clipOptions(asset, settings);
  const keepAudio = settings.keepAudio;
  const cacheKey = endClipCacheKey({ assetId: asset.id, size, kind, durationSeconds, keepAudio, fadeSeconds: settings.fadeSeconds });
  const clipDuration = endClipDuration({ kind, durationSeconds, sourceDurationSeconds: asset.durationSeconds });
  const cached = asset.normalized[cacheKey];
  if (cached) return { url: cached, durationSeconds: clipDuration, kind, asset, cacheKey };

  const ffmpeg = requireFfmpeg();
  const url = await withWorkDir(async (dir) => {
    const input = path.join(dir, kind === "IMAGE" ? "end.jpg" : "end-source");
    const output = path.join(dir, "end-normalized.mp4");
    await downloadToFile(asset.storageUrl, input);
    await runTool(
      ffmpeg,
      buildNormalizeEndClipArgs({
        inputPath: input,
        outputPath: output,
        kind,
        size,
        durationSeconds,
        sourceDurationSeconds: asset.durationSeconds,
        sourceHasAudio: asset.hasAudio,
        keepAudio,
        fadeSeconds: settings.fadeSeconds,
      }),
      60_000,
    );
    const hash = createHash("sha1").update(cacheKey).digest("hex").slice(0, 16);
    const blob = await put(`${endMediaUploadPrefix(asset.userId)}normalized/${hash}-${randomUUID().slice(0, 8)}.mp4`, await readFile(output), {
      access: "public",
      contentType: "video/mp4",
      addRandomSuffix: false,
    });
    return blob.url;
  });
  const saved = await saveNormalizedVariant(asset.id, asset.userId, cacheKey, url);
  if (!saved) {
    // O arquivo do slot foi trocado no meio: não guarda variante órfã.
    await deleteBlob(url).catch(() => undefined);
    throw new EndMediaProcessingError("A mídia final foi alterada durante o processamento. Tente novamente.");
  }
  return { url, durationSeconds: clipDuration, kind, asset, cacheKey };
}

export interface AppliedVideoEnd {
  render: EndMediaRenderRecord;
  resultMediaId: string;
  resultUrl: string;
  cached: boolean;
}

/**
 * Reel (manual ou Piloto): vídeo da biblioteca do usuário + encerramento →
 * NOVO arquivo (o original nunca é alterado). Mesmo vídeo + mesmo
 * encerramento = reaproveita o resultado (cache), nunca emenda duas vezes.
 */
export async function applyEndMediaToVideoMedia(
  userId: string,
  sourceMediaId: string,
  options: { context: "REEL" | "AUTOMATION_REEL"; timeoutMs?: number; postId?: string | null },
): Promise<AppliedVideoEnd> {
  const startedAt = Date.now();
  const settings = await getEndMediaSettings(userId);
  const source = await getInstagramMediaById(sourceMediaId, userId);
  if (!source || source.mediaType !== "video") throw new EndMediaValidationError("Vídeo não encontrado.");
  // Nunca emenda em cima de um vídeo que já é resultado com encerramento (retry/duplo clique).
  const alreadyRendered = await getRenderByResultMedia(source.id, userId);
  if (alreadyRendered) {
    return { render: alreadyRendered, resultMediaId: source.id, resultUrl: source.storageUrl, cached: true };
  }
  const asset = await resolveVideoEndAsset(userId, "REEL", settings);
  if (!asset) throw new EndMediaValidationError("Mídia final padrão não configurada.");

  const clip = await ensureNormalizedClip(asset, settings, REEL_OUTPUT_SIZE);
  const cached = await findCachedRender(userId, source.id, clip.cacheKey);
  if (cached?.resultMediaId) {
    return { render: cached, resultMediaId: cached.resultMediaId, resultUrl: cached.resultUrl, cached: true };
  }

  const ffmpeg = requireFfmpeg();
  const resultUrl = await withWorkDir(async (dir) => {
    const mainPath = path.join(dir, "main");
    const endPath = path.join(dir, "end.mp4");
    const outPath = path.join(dir, "final.mp4");
    await Promise.all([downloadToFile(source.storageUrl, mainPath), downloadToFile(clip.url, endPath)]);
    const probed = await probeVideoFile(mainPath);
    await runTool(
      ffmpeg,
      buildAppendEndClipArgs({
        mainPath,
        mainDurationSeconds: probed.durationSeconds,
        mainHasAudio: probed.hasAudio,
        endClipPath: endPath,
        endClipDurationSeconds: clip.durationSeconds,
        size: REEL_OUTPUT_SIZE,
        fadeSeconds: settings.fadeSeconds,
        outputPath: outPath,
      }),
      options.timeoutMs ?? 170_000,
    );
    const blob = await put(`${buildMediaPathnamePrefix(userId)}com-encerramento-${randomUUID()}.mp4`, await readFile(outPath), {
      access: "public",
      contentType: "video/mp4",
      addRandomSuffix: false,
    });
    return blob.url;
  });
  const resultMediaId = await insertInstagramMedia({
    userId,
    storageUrl: resultUrl,
    mediaType: "video",
    fileSizeBytes: null,
    originalFilename: "reel-com-encerramento.mp4",
    generatedFromMediaId: source.id,
  });
  const processingMs = Date.now() - startedAt;
  const render = await insertRender({
    userId,
    context: options.context,
    sourceMediaId: source.id,
    endKey: clip.cacheKey,
    endMediaType: clip.kind,
    endMediaUrl: asset.storageUrl,
    resultUrl,
    resultMediaId,
    processingMs,
  });
  await recordEndMediaEvent({ userId, postId: options.postId ?? null, context: options.context, mediaType: clip.kind, assetId: asset.id, applied: true, processingMs });
  return { render, resultMediaId: render.resultMediaId ?? resultMediaId, resultUrl: render.resultUrl, cached: false };
}

// ---------------------------------------------------------------- carrossel

export interface CarouselEndItem {
  mediaId: string;
  urlUsed: string;
  sourceAssetId: string | null;
}

/**
 * Item final do carrossel. "default" usa a imagem da empresa; "override"
 * usa outra imagem SÓ nesta publicação (não altera a configuração).
 * Sempre uma CÓPIA em instagram-media/ — a publicação continua apontando
 * para a mídia usada na época mesmo que a configuração mude ou seja apagada.
 */
export async function prepareCarouselEndItem(
  userId: string,
  choice: CarouselEndMediaChoice,
  currentItems: number,
  resolveOverrideMediaId: (mediaUrl: string) => Promise<string>,
): Promise<CarouselEndItem | null> {
  if (choice.mode === "none") return null;
  if (currentItems >= CAROUSEL_MAX_ITEMS_WITH_END) throw new EndMediaValidationError(CAROUSEL_FULL_MESSAGE);

  if (choice.mode === "override") {
    const mediaId = await resolveOverrideMediaId(choice.mediaUrl);
    const media = await getInstagramMediaById(mediaId, userId);
    if (!media || media.mediaType !== "image") throw new EndMediaValidationError("A imagem final desta publicação não é válida.");
    return { mediaId: media.id, urlUsed: media.storageUrl, sourceAssetId: null };
  }

  const asset = await getEndMediaAsset(userId, "CAROUSEL_IMAGE");
  if (!asset) throw new EndMediaValidationError("Mídia final padrão não configurada.");
  const copied = await copy(asset.storageUrl, `${buildMediaPathnamePrefix(userId)}encerramento-${randomUUID()}.jpg`, {
    access: "public",
    contentType: "image/jpeg",
    addRandomSuffix: false,
  });
  const mediaId = await insertInstagramMedia({
    userId,
    storageUrl: copied.url,
    mediaType: "image",
    fileSizeBytes: asset.fileSizeBytes,
    originalFilename: "encerramento-carrossel.jpg",
  });
  return { mediaId, urlUsed: copied.url, sourceAssetId: asset.id };
}

/** Lê a escolha enviada pela tela. `undefined` = a tela não sabe da opção (usa "aplicar automaticamente"). */
export function parseCarouselEndMediaChoice(value: unknown): CarouselEndMediaChoice | undefined {
  if (!value || typeof value !== "object") return undefined;
  const raw = value as { mode?: unknown; mediaUrl?: unknown };
  if (raw.mode === "none") return { mode: "none" };
  if (raw.mode === "default") return { mode: "default" };
  if (raw.mode === "override" && typeof raw.mediaUrl === "string" && raw.mediaUrl) return { mode: "override", mediaUrl: raw.mediaUrl };
  return undefined;
}

export interface CarouselEndResolution {
  item: CarouselEndItem | null;
  /** Motivo de não ter aplicado (vai para o histórico/log, nunca bloqueia a publicação). */
  notApplied: string | null;
}

/**
 * Decide e prepara o item final de um carrossel novo:
 *  - escolha explícita da tela ("default"/"override") com carrossel cheio → erro claro (não adiciona em silêncio);
 *  - sem escolha (tela antiga, fluxos automáticos) → só aplica se a empresa ligou o carrossel + "aplicar automaticamente";
 *  - mídia não configurada → segue sem ela.
 */
export async function resolveCarouselEndForPost(
  userId: string,
  choice: CarouselEndMediaChoice | undefined,
  currentItems: number,
  resolveOverrideMediaId: (mediaUrl: string) => Promise<string>,
): Promise<CarouselEndResolution> {
  if (choice?.mode === "none") return { item: null, notApplied: null };
  if (!choice) {
    const settings = await getEndMediaSettings(userId);
    if (!settings.carouselEnabled || !settings.applyAutomatically) return { item: null, notApplied: null };
    if (!(await getEndMediaAsset(userId, "CAROUSEL_IMAGE"))) return { item: null, notApplied: "Mídia final padrão não configurada." };
    if (currentItems >= CAROUSEL_MAX_ITEMS_WITH_END) return { item: null, notApplied: CAROUSEL_FULL_MESSAGE };
    return { item: await prepareCarouselEndItem(userId, { mode: "default" }, currentItems, resolveOverrideMediaId), notApplied: null };
  }
  if (choice.mode === "default" && !(await getEndMediaAsset(userId, "CAROUSEL_IMAGE"))) {
    return { item: null, notApplied: "Mídia final padrão não configurada." };
  }
  return { item: await prepareCarouselEndItem(userId, choice, currentItems, resolveOverrideMediaId), notApplied: null };
}

// ---------------------------------------------------------------- split screen

export interface SplitEndClipResolution {
  clip: NormalizedEndClip | null;
  fadeSeconds: number;
  /** Motivo de não aplicar (mostrado como aviso, nunca bloqueia). */
  notApplied: string | null;
}

/**
 * Split Screen: `wanted` vem da caixa "Adicionar encerramento padrão"
 * (undefined = tela antiga → segue a configuração da empresa).
 */
export async function resolveSplitScreenEndClip(userId: string, wanted: boolean | undefined, size: OutputSize): Promise<SplitEndClipResolution> {
  const settings = await getEndMediaSettings(userId);
  const shouldApply = wanted === true || (wanted === undefined && settings.splitEnabled && settings.applyAutomatically);
  if (!shouldApply) return { clip: null, fadeSeconds: settings.fadeSeconds, notApplied: null };
  const asset = await resolveVideoEndAsset(userId, "SPLIT_SCREEN", settings);
  if (!asset) return { clip: null, fadeSeconds: settings.fadeSeconds, notApplied: "Mídia final padrão não configurada." };
  try {
    return { clip: await ensureNormalizedClip(asset, settings, size), fadeSeconds: settings.fadeSeconds, notApplied: null };
  } catch (error) {
    await recordEndMediaEvent({ userId, context: "SPLIT_SCREEN", mediaType: isVideoSlot(asset.slot) ? "VIDEO" : "IMAGE", assetId: asset.id, applied: false, error: error instanceof Error ? error.message : String(error) });
    return { clip: null, fadeSeconds: settings.fadeSeconds, notApplied: "Não foi possível adicionar o encerramento padrão." };
  }
}

/** Registra o encerramento aplicado no Split Screen (o id vai junto ao publicar como Reel → histórico). */
export async function recordSplitScreenEndRender(userId: string, clip: NormalizedEndClip, resultUrl: string, processingMs: number): Promise<string> {
  const render = await insertRender({
    userId,
    context: "SPLIT_SCREEN",
    sourceMediaId: null,
    endKey: clip.cacheKey,
    endMediaType: clip.kind,
    endMediaUrl: clip.asset.storageUrl,
    resultUrl,
    resultMediaId: null,
    processingMs,
  });
  await recordEndMediaEvent({ userId, context: "SPLIT_SCREEN", mediaType: clip.kind, assetId: clip.asset.id, applied: true, processingMs });
  return render.id;
}

// ---------------------------------------------------------------- Piloto Automático

/** O Piloto deve reservar 1 slide para a imagem final? (carrossel ligado + automático + imagem cadastrada) */
export async function automationCarouselWantsEndImage(userId: string): Promise<boolean> {
  const settings = await getEndMediaSettings(userId);
  if (!settings.carouselEnabled || !settings.applyAutomatically) return false;
  return Boolean(await getEndMediaAsset(userId, "CAROUSEL_IMAGE"));
}

/** O Piloto deve emendar o encerramento nos Reels? */
export async function automationReelWantsEndMedia(userId: string): Promise<boolean> {
  const settings = await getEndMediaSettings(userId);
  if (!settings.reelEnabled || !settings.applyAutomatically) return false;
  return Boolean(await resolveVideoEndAsset(userId, "REEL", settings));
}
