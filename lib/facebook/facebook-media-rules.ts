/**
 * Regras de mídia do Facebook (lógica pura, usada no servidor e na tela).
 *
 * Reels em Páginas (Reels Publishing API, documentação oficial):
 *   - proporção 9:16; resolução mínima 540 × 960 (recomendado 1080 × 1920);
 *   - duração de 3 a 90 segundos;
 *   - 24 a 60 fps; MP4 com H.264/H.265 (VP9/AV1 também aceitos);
 *   - até 30 Reels publicados via API por Página a cada 24 h.
 * Fotos: JPEG/PNG, recomendado até 4 MB.
 */

export const FACEBOOK_REEL_MIN_SECONDS = 3;
export const FACEBOOK_REEL_MAX_SECONDS = 90;
export const FACEBOOK_REEL_MIN_WIDTH = 540;
export const FACEBOOK_REEL_MIN_HEIGHT = 960;
export const FACEBOOK_REEL_MIN_FPS = 24;
export const FACEBOOK_REEL_MAX_FPS = 60;
export const FACEBOOK_PHOTO_MAX_BYTES = 4 * 1024 * 1024;
/** Mesmo teto do carrossel do Instagram (a fonte do conteúdo); a Pages API aceita mais. */
export const FACEBOOK_MAX_PHOTOS_PER_POST = 10;
export const FACEBOOK_CAPTION_MAX_LENGTH = 5000;
const ACCEPTED_CODECS = new Set(["h264", "hevc", "h265", "vp9", "av1"]);

export interface ReelProbe {
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
  videoCodec: string | null;
  fps: number | null;
  hasVideo: boolean;
  sizeBytes: number | null;
}

/** Devolve a primeira incompatibilidade encontrada (mensagem para o usuário) ou null. Campos desconhecidos não bloqueiam. */
export function validateFacebookReelSpecs(probe: Partial<ReelProbe>): string | null {
  if (probe.hasVideo === false) return "O arquivo não tem uma trilha de vídeo válida para o Facebook.";
  const { width, height, durationSeconds, videoCodec, fps } = probe;
  if (typeof durationSeconds === "number") {
    if (durationSeconds < FACEBOOK_REEL_MIN_SECONDS) return `O Facebook só aceita Reels com pelo menos ${FACEBOOK_REEL_MIN_SECONDS} segundos.`;
    if (durationSeconds > FACEBOOK_REEL_MAX_SECONDS + 0.5) {
      return `O Facebook só aceita Reels de até ${FACEBOOK_REEL_MAX_SECONDS} segundos pela API (este tem ${Math.round(durationSeconds)} s). Publique só no Instagram ou encurte o vídeo.`;
    }
  }
  if (typeof width === "number" && typeof height === "number" && width > 0 && height > 0) {
    const ratio = width / height;
    if (Math.abs(ratio - 9 / 16) > 0.02) return "O Facebook exige Reels na proporção 9:16 (vertical).";
    if (width < FACEBOOK_REEL_MIN_WIDTH || height < FACEBOOK_REEL_MIN_HEIGHT) {
      return `Resolução baixa demais para Reels no Facebook (mínimo ${FACEBOOK_REEL_MIN_WIDTH} × ${FACEBOOK_REEL_MIN_HEIGHT}).`;
    }
  }
  if (typeof fps === "number" && (fps < FACEBOOK_REEL_MIN_FPS - 0.5 || fps > FACEBOOK_REEL_MAX_FPS + 0.5)) {
    return `O Facebook exige Reels entre ${FACEBOOK_REEL_MIN_FPS} e ${FACEBOOK_REEL_MAX_FPS} quadros por segundo.`;
  }
  if (videoCodec && !ACCEPTED_CODECS.has(videoCodec)) return "Codec de vídeo não aceito pelo Facebook (use MP4 com H.264).";
  return null;
}

export type FacebookPostKind = "image" | "carousel" | "reels" | "story";

/** O que cada tipo de publicação do Alilu vira no Facebook (ou por que não é suportado). */
export function facebookSupportFor(postType: FacebookPostKind, hasVideoItems: boolean): { supported: true; label: string } | { supported: false; reason: string } {
  if (postType === "story") return { supported: false, reason: "Stories não são publicados no Facebook pelo Alilu. Escolha só o Instagram." };
  if (postType === "carousel" && hasVideoItems) {
    return {
      supported: false,
      reason: "O Facebook não publica carrossel com vídeo pela API. Use só fotos para publicar nas duas redes, ou publique o vídeo como Reel.",
    };
  }
  if (postType === "carousel") return { supported: true, label: "Post com várias fotos" };
  if (postType === "reels") return { supported: true, label: "Reel" };
  return { supported: true, label: "Foto" };
}
