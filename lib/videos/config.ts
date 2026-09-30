import type { VideoAudioSource, VideoDurationMode, VideoOutputFormat, VideoSplitLayoutRatio } from "./split-screen-ffmpeg";

/**
 * Constantes centrais da categoria "Vídeos" (Fase A: editor de
 * split-screen). Nunca hardcode estes valores em outro arquivo — rotas,
 * validação e componentes importam tudo daqui.
 *
 * Esta é uma área de produto diferente das demais categorias do site: as
 * ferramentas de data/categories.ts são 100% client-side (nada é enviado
 * ao servidor); este editor ENVIA os dois vídeos para o Vercel Blob e
 * processa no backend com FFmpeg — por isso os limites aqui são mais
 * conservadores que os do Instagram (que exige login): esta ferramenta é
 * pública, sem cadastro, então precisa de um teto de abuso menor.
 */

/** 100 MB por vídeo de entrada — menor que os 250 MB dos Reels autenticados, de propósito (ferramenta pública, sem login). */
export const MAX_VIDEO_INPUT_BYTES = 100 * 1024 * 1024;

/**
 * 150 segundos (2:30) de duração final do resultado.
 *
 * Histórico: 180s na Fase A → um teste real em produção com um resultado
 * de 149s deu "Task timed out after 60 seconds" (a rota rodava com
 * `maxDuration = 60`) → baixado para 60s + preset do FFmpeg trocado para
 * "ultrafast" (ver split-screen-ffmpeg.ts), sem confirmação real ainda →
 * o Rodrigo pediu para subir para 150s. Como a conta é Vercel Pro
 * (confirmado com ele), desta vez a rota também teve seu `maxDuration`
 * subido para 200s (app/api/videos/split-screen/route.ts) — os dois
 * números precisam andar juntos: MAX_OUTPUT_DURATION_SECONDS sozinho não
 * significa nada se a function não tiver orçamento de tempo para
 * processar esse tanto de vídeo.
 *
 * Ainda é uma estimativa (sem telemetria real de um resultado de 150s de
 * verdade rodando na Vercel) — os logs de tempo por etapa em
 * lib/videos/backend/video-processing-service.ts mostram onde o tempo é
 * gasto se um timeout acontecer de novo. Se acontecer, o ajuste é baixar
 * este número (ou subir o `maxDuration`, já que agora há folga no plano
 * Pro para isso, ao contrário de antes).
 */
export const MAX_OUTPUT_DURATION_SECONDS = 150;

/**
 * Preset "Vídeo satisfatório": o único preset desta fase (ver relatório —
 * outros presets, como "Podcast + vídeo satisfatório", ficam fora de
 * escopo). Aplica de uma vez o combo mais comum do formato que viralizou
 * no TikTok/Reels: vertical, principal em cima ocupando metade da tela,
 * complementar embaixo repetindo em loop, só com o áudio do principal.
 * Objeto nomeado aqui (não hardcoded no componente) para o botão de preset
 * e os testes de sanidade (lib/videos/config.test.ts) lerem o mesmo valor.
 */
export const SATISFYING_PRESET: {
  outputFormat: VideoOutputFormat;
  layoutRatio: VideoSplitLayoutRatio;
  durationMode: VideoDurationMode;
  audioSource: VideoAudioSource;
} = {
  outputFormat: "vertical",
  layoutRatio: "50-50",
  durationMode: "loop",
  audioSource: "primary",
};

/** Tipos de vídeo aceitos no upload (principal e complementar). */
export const VIDEO_INPUT_CONTENT_TYPES = ["video/mp4", "video/quicktime", "video/webm"] as const;

export type VideoInputContentType = (typeof VIDEO_INPUT_CONTENT_TYPES)[number];

export function isAllowedVideoInputContentType(contentType: string): contentType is VideoInputContentType {
  return (VIDEO_INPUT_CONTENT_TYPES as readonly string[]).includes(contentType);
}

/** Prefixo de pasta dos vídeos de entrada no Vercel Blob — apagados logo após o processamento (sucesso ou erro). */
export const VIDEO_UPLOAD_PATH_PREFIX = "videos/uploads/";

/**
 * Prefixo de pasta do vídeo de SAÍDA (resultado final) no Vercel Blob.
 * Diferente dos uploads de entrada: este arquivo NÃO é apagado
 * automaticamente nesta fase (fica para uma fase futura, com um cron de
 * limpeza — ver relatório da Fase A, seção "O que ficou de fora").
 */
export const VIDEO_OUTPUT_PATH_PREFIX = "videos/outputs/";

/** O `pathname` de um client upload do Vercel Blob é escolhido pelo navegador — nunca confiar sem validar. */
export function isVideoUploadPathnameAllowed(pathname: string): boolean {
  if (!pathname) return false;
  if (!pathname.startsWith(VIDEO_UPLOAD_PATH_PREFIX)) return false;
  if (pathname.includes("..")) return false;
  if (pathname.length <= VIDEO_UPLOAD_PATH_PREFIX.length) return false;
  return true;
}

/**
 * Confirma que uma URL de blob apontada pelo cliente na rota de
 * processamento realmente veio do prefixo de upload desta categoria — o
 * cliente poderia, em tese, enviar qualquer URL no corpo da requisição;
 * esta checagem evita que a rota de processamento baixe/processe um
 * arquivo de qualquer lugar da internet.
 */
export function isVideoInputBlobUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;
    // Verificação de hostname é essencial aqui, não só de pathname: sem
    // ela, um atacante poderia apontar para qualquer domínio próprio que
    // simplesmente inclua "/videos/uploads/" no caminho (ex.:
    // https://atacante.exemplo/x/videos/uploads/y.mp4) e a rota de
    // processamento baixaria e rodaria FFmpeg em cima de um arquivo
    // arbitrário da internet — usando esta ferramenta pública e sem login
    // como um proxy de download/transcodificação para qualquer URL.
    // Blobs públicos da Vercel sempre ficam em "<id>.public.blob.vercel-storage.com".
    if (!parsed.hostname.endsWith(".public.blob.vercel-storage.com")) return false;
    return parsed.pathname.includes(`/${VIDEO_UPLOAD_PATH_PREFIX}`);
  } catch {
    return false;
  }
}

export const MAX_ORIGINAL_FILENAME_LENGTH = 200;

/** O nome original do arquivo é só metadado informativo — nunca vira caminho real, mas ainda assim é saneado antes de compor o pathname do Blob. */
export function sanitizeOriginalFilename(name: string | null | undefined): string {
  const fallback = "video";
  if (!name) return fallback;
  const trimmed = name.trim();
  if (!trimmed) return fallback;

  const baseName = trimmed.split(/[/\\]/).pop() ?? trimmed;
  const cleaned = baseName
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9.-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();

  return (cleaned || fallback).slice(0, MAX_ORIGINAL_FILENAME_LENGTH);
}
