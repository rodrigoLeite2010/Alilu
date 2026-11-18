/**
 * Legendas do Radar Instagram (lógica pura — tela e servidor). Reaproveita o
 * template da Fila de vídeos ({titulo}, {tema}, {numero}, {total}) e
 * acrescenta as hashtags fixas do radar (sem repetir as que já estão no texto).
 *
 * Ordem: legenda própria do vídeo (escrita ou gerada com IA e revisada) →
 * legenda padrão do radar. Com a regra "REVIEW", vídeo sem legenda própria
 * não é agendado até alguém revisar — nunca sai um texto inventado.
 */
import { renderCaptionTemplate, validateCaption } from "@/lib/video-queue/captions";

export const DEFAULT_RADAR_CAPTION = "{titulo}";
export const MAX_RADAR_HASHTAGS_TEXT = 600;

/** Normaliza "gta6, #gta  #games" → "#gta6 #gta #games" (só letras, números e _). */
export function normalizeHashtags(raw: string): string {
  const tags = (raw ?? "")
    .split(/[\s,;]+/)
    .map((tag) => tag.replace(/^#+/, "").trim())
    .filter((tag) => /^[\p{L}\p{N}_]+$/u.test(tag));
  return [...new Set(tags.map((tag) => `#${tag}`))].join(" ");
}

export function appendHashtags(caption: string, hashtags: string): string {
  const existing = new Set((caption.match(/#[\p{L}\p{N}_]+/gu) ?? []).map((tag) => tag.toLowerCase()));
  const extra = normalizeHashtags(hashtags)
    .split(" ")
    .filter((tag) => tag && !existing.has(tag.toLowerCase()));
  if (extra.length === 0) return caption.trim();
  return caption.trim() ? `${caption.trim()}\n\n${extra.join(" ")}` : extra.join(" ");
}

export interface RadarCaptionInput {
  ownCaption: string | null;
  title: string | null;
  template: string;
  hashtags: string;
  radarName: string;
  numero: number;
  total: number;
}

export function composeRadarCaption(input: RadarCaptionInput): string {
  const own = input.ownCaption?.trim();
  const base = own
    ? own
    : renderCaptionTemplate(input.template || DEFAULT_RADAR_CAPTION, {
        titulo: input.title,
        tema: input.radarName,
        categoria: "Instagram",
        numero: input.numero,
        total: input.total,
      });
  return appendHashtags(base, input.hashtags);
}

/** Erro (ou null) de uma legenda final do radar — mesmos limites da Meta usados nas filas. */
export function validateRadarCaption(caption: string): string | null {
  return validateCaption(caption);
}

/** Vídeo que só pode ser agendado depois da revisão da legenda. */
export function needsCaptionReview(policy: "DEFAULT" | "REVIEW", ownCaption: string | null): boolean {
  return policy === "REVIEW" && !ownCaption?.trim();
}
