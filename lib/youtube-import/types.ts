/**
 * Tipos e mensagens compartilhados (tela e servidor) do "Importar do YouTube".
 *
 * Separação deliberada (ver RELATORIO-IMPORTAR-YOUTUBE.md):
 *   1. Consulta de METADADOS pelo link (API oficial YouTube Data API v3 / oEmbed).
 *   2. PRÉ-VISUALIZAÇÃO pelo player oficial incorporado (youtube-nocookie.com).
 *   3. O ARQUIVO de mídia nunca é baixado do YouTube — os Termos e as Developer
 *      Policies (III.E.1) proíbem baixar/armazenar o conteúdo audiovisual.
 *   4. O usuário ENVIA o arquivo original que ele tem direito de usar
 *      (ex.: o próprio vídeo baixado do YouTube Studio).
 *   5. Só esse arquivo enviado é editado na Alilu.
 */

/** Situação do vídeo segundo a consulta oficial. */
export type YoutubeAvailability =
  | "AVAILABLE"
  | "PRIVATE"
  | "NOT_FOUND"
  | "UNAVAILABLE"
  | "AGE_RESTRICTED"
  | "LIVE_NOW"
  | "UPCOMING"
  | "UNKNOWN";

/** Ciclo de vida do registro: consultado → arquivo enviado e validado → (expirado pela limpeza). */
export type YoutubeImportStatus = "ANALYZED" | "COMPLETED" | "EXPIRED";

export const YOUTUBE_AVAILABILITY_LABEL: Record<YoutubeAvailability, string> = {
  AVAILABLE: "Disponível publicamente",
  PRIVATE: "Privado, restrito ou sem incorporação permitida",
  NOT_FOUND: "Não encontrado (excluído ou inexistente)",
  UNAVAILABLE: "Indisponível no YouTube",
  AGE_RESTRICTED: "Com restrição de idade",
  LIVE_NOW: "Transmissão ao vivo em andamento",
  UPCOMING: "Transmissão agendada (ainda não começou)",
  UNKNOWN: "Não foi possível consultar agora",
};

export const YOUTUBE_AVAILABILITY_HELP: Record<YoutubeAvailability, string> = {
  AVAILABLE: "Os dados públicos foram confirmados pela API oficial do YouTube.",
  PRIVATE:
    "O YouTube não libera os dados deste vídeo para consulta (vídeo privado ou com incorporação desativada pelo dono). Se ele é seu, envie o arquivo original (no YouTube Studio: Conteúdo › ⋮ › Baixar).",
  NOT_FOUND: "Este vídeo não existe ou foi removido. Confira o link. Se você tem o arquivo original e o direito de usá-lo, pode enviá-lo.",
  UNAVAILABLE: "O YouTube indica que este vídeo não está disponível (recusado, com falha ou em processamento).",
  AGE_RESTRICTED: "O vídeo tem restrição de idade. A prévia pode exigir login no YouTube.",
  LIVE_NOW: "Lives em andamento não podem ser usadas. Aguarde terminar e envie o arquivo final.",
  UPCOMING: "A transmissão ainda não começou.",
  UNKNOWN: "A consulta ao YouTube falhou agora. Você ainda pode enviar o arquivo original autorizado.",
};

/** Códigos de erro devolvidos pela API interna (/api/videos/youtube-import/...). */
export const YOUTUBE_IMPORT_MESSAGES = {
  AUTHORIZATION_REQUIRED: "Confirme que o vídeo é seu ou que você tem autorização para utilizá-lo.",
  RATE_LIMITED: "Muitas consultas em pouco tempo. Aguarde um minuto e tente de novo.",
  DAILY_LIMIT: "Você atingiu o limite diário de consultas ao YouTube. Tente novamente amanhã.",
  QUOTA_EXCEEDED: "A cota diária da API do YouTube da Alilu acabou. A consulta volta amanhã; você ainda pode enviar o arquivo original.",
  API_AUTH_FAILED: "A integração com o YouTube não está configurada corretamente. Você ainda pode enviar o arquivo original.",
  NOT_CONFIGURED: "A consulta completa ao YouTube ainda não foi configurada. Mostramos os dados públicos básicos.",
  CONNECTION: "Não conseguimos falar com o YouTube agora (conexão). Tente de novo ou envie o arquivo original.",
  UPLOAD_FAILED: "Não foi possível enviar o arquivo. Confira a conexão (Wi-Fi/4G) e tente de novo.",
  INVALID_FILE: "O arquivo não é um vídeo válido. Envie MP4, MOV ou WEBM.",
  TOO_LARGE: "O vídeo é grande demais para importar.",
  TOO_LONG: "O vídeo é longo demais para importar.",
  STORAGE_FAILED: "Não conseguimos guardar o arquivo agora. Tente de novo em instantes.",
  NOT_FOUND: "Importação não encontrada.",
} as const;

export const YOUTUBE_UPLOAD_CONTENT_TYPES = ["video/mp4", "video/quicktime", "video/webm"] as const;

/** O que a tela recebe (sem dados internos). */
export interface YoutubeImportDto {
  id: string;
  status: YoutubeImportStatus;
  videoId: string;
  kind: string;
  normalizedUrl: string;
  availability: YoutubeAvailability;
  /** De onde vieram os metadados: API oficial (completa), oEmbed (básico) ou nenhuma. */
  metadataSource: "data_api" | "oembed" | "none";
  title: string | null;
  channelTitle: string | null;
  thumbnailUrl: string | null;
  /** Duração informada pelo YouTube (segundos). */
  youtubeDurationSeconds: number | null;
  embeddable: boolean;
  madeForKids: boolean | null;
  regionRestricted: boolean;
  warningMessage: string | null;
  /** Arquivo enviado pelo usuário (Vercel Blob da Alilu). */
  fileUrl: string | null;
  contentType: string | null;
  fileSizeBytes: number | null;
  durationSeconds: number | null;
  width: number | null;
  height: number | null;
  hasAudio: boolean | null;
  /** O arquivo enviado tem duração bem diferente do vídeo consultado (aviso, não bloqueio). */
  durationMismatch: boolean;
  createdAt: string;
  completedAt: string | null;
}

/** "PT1H2M3S" (ISO 8601 do YouTube) → segundos. "P0D" (live/agendado) → 0. Inválido → null. */
export function parseIsoDuration(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const match = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/.exec(value.trim());
  if (!match || value.trim() === "P" || value.trim().endsWith("T")) return null;
  const [, d, h, m, s] = match;
  return Number(d ?? 0) * 86400 + Number(h ?? 0) * 3600 + Number(m ?? 0) * 60 + Number(s ?? 0);
}

export function formatClockDuration(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds)) return "—";
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

/** Diferença aceitável entre a duração do arquivo e a do YouTube: 5 s ou 5%, o que for maior. */
export function isDurationMismatch(fileSeconds: number | null, youtubeSeconds: number | null): boolean {
  if (!fileSeconds || !youtubeSeconds) return false;
  return Math.abs(fileSeconds - youtubeSeconds) > Math.max(5, youtubeSeconds * 0.05);
}
