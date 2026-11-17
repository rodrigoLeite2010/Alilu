/**
 * Tipos, status, rótulos e padrões do Radar Viral (módulo puro — tela e servidor).
 */

export type RadarStatus = "ACTIVE" | "PAUSED" | "ARCHIVED";
export type RadarSourceType = "YOUTUBE_SEARCH" | "YOUTUBE_CHANNEL" | "RSS" | "INSTAGRAM_HASHTAG" | "TIKTOK";
export type SourceLicense = "NONE" | "OWN" | "LICENSED";
export type CandidatePlatform = "YOUTUBE" | "RSS" | "INSTAGRAM" | "TIKTOK";
export type AuthorizationStatus = "AUTHORIZED" | "NOT_AUTHORIZED" | "PENDING_REVIEW";
export type AuthorizationType = "OWN" | "LICENSED" | "MANUAL_APPROVAL";
export type CandidateStatus =
  | "DISCOVERED"
  | "CLASSIFIED"
  | "AWAITING_AUTHORIZATION"
  | "ELIGIBLE"
  | "QUEUED"
  | "REFERENCE"
  | "IGNORED"
  | "UNAVAILABLE"
  | "FILTERED";
/** A = importação autorizada · B = referência para conteúdo original · C = aguardando autorização/revisão. */
export type CandidateRoute = "A" | "B" | "C";
export type ExecutionTrigger = "SCHEDULE" | "REFILL" | "MANUAL";
export type ExecutionStatus = "RUNNING" | "SUCCEEDED" | "PARTIAL" | "FAILED" | "SKIPPED" | "ABANDONED";
export type PriorityMode = "FIFO" | "SCORE";
export type CaptionMode = "TEMPLATE" | "AI";
export type CaptionStyle = "NEWS" | "CURIOSITY" | "SUSPENSE" | "COMPARISON" | "HUMOR" | "QUESTION";

export interface LicenseScope {
  edit: boolean;
  republish: boolean;
  commercial: boolean;
}

export interface RadarCriteria {
  minViews: number;
  minLikes: number;
  minComments: number;
  /** Idade máxima do conteúdo em horas. */
  maxAgeHours: number;
  /** Pontuação mínima (0–100). */
  minScore: number;
  maxSelectedPerRun: number;
}

export interface ScoreWeights {
  velocity: number;
  likeRate: number;
  commentRate: number;
  recency: number;
  relevance: number;
}

/**
 * Etapas exibidas no painel (spec: Descoberto → … → Publicado). As do radar
 * vêm do candidato; a partir de "Na fila" vêm do item da Fila de vídeos e da
 * publicação no agendador (fonte única, sem duplicar estado).
 */
export type PipelineStage =
  | "DISCOVERED"
  | "CLASSIFIED"
  | "AWAITING_AUTHORIZATION"
  | "ELIGIBLE"
  | "REFERENCE"
  | "IMPORTING"
  | "PROCESSING"
  | "READY"
  | "WAITING_FILE"
  | "SCHEDULED"
  | "PUBLISHING"
  | "PUBLISHED"
  | "FAILED"
  | "PAUSED"
  | "CANCELLED"
  | "IGNORED"
  | "UNAVAILABLE"
  | "FILTERED";

export const PIPELINE_STAGE_LABEL: Record<PipelineStage, string> = {
  DISCOVERED: "Descoberto",
  CLASSIFIED: "Classificado",
  AWAITING_AUTHORIZATION: "Aguardando autorização",
  ELIGIBLE: "Elegível",
  REFERENCE: "Referência (conteúdo original)",
  IMPORTING: "Importando",
  PROCESSING: "Processando",
  READY: "Pronto",
  WAITING_FILE: "Aguardando arquivo autorizado",
  SCHEDULED: "Agendado",
  PUBLISHING: "Publicando",
  PUBLISHED: "Publicado",
  FAILED: "Falhou",
  PAUSED: "Pausado",
  CANCELLED: "Cancelado",
  IGNORED: "Ignorado",
  UNAVAILABLE: "Indisponível",
  FILTERED: "Fora dos critérios",
};

export const RADAR_STATUS_LABEL: Record<RadarStatus, string> = {
  ACTIVE: "Ativo",
  PAUSED: "Pausado",
  ARCHIVED: "Arquivado",
};

export const SOURCE_TYPE_LABEL: Record<RadarSourceType, string> = {
  YOUTUBE_SEARCH: "YouTube — pesquisa (API oficial)",
  YOUTUBE_CHANNEL: "YouTube — canal",
  RSS: "Feed RSS/Atom",
  INSTAGRAM_HASHTAG: "Instagram — hashtag (API oficial)",
  TIKTOK: "TikTok",
};

export const LICENSE_LABEL: Record<SourceLicense, string> = {
  NONE: "Conteúdo de terceiros (sem autorização)",
  OWN: "Conteúdo próprio",
  LICENSED: "Conteúdo licenciado",
};

export const AUTHORIZATION_LABEL: Record<AuthorizationStatus, string> = {
  AUTHORIZED: "Autorizado",
  NOT_AUTHORIZED: "Sem autorização",
  PENDING_REVIEW: "Em revisão",
};

export const ROUTE_LABEL: Record<CandidateRoute, string> = {
  A: "Importação autorizada",
  B: "Referência para conteúdo original",
  C: "Aguardando autorização ou revisão",
};

export const CAPTION_STYLE_LABEL: Record<CaptionStyle, string> = {
  NEWS: "Notícias",
  CURIOSITY: "Curiosidades",
  SUSPENSE: "Suspense",
  COMPARISON: "Comparações",
  HUMOR: "Humor",
  QUESTION: "Perguntas",
};

export const FREQUENCY_PRESETS: Array<{ minutes: number; label: string }> = [
  { minutes: 180, label: "A cada 3 horas" },
  { minutes: 360, label: "A cada 6 horas" },
  { minutes: 720, label: "A cada 12 horas" },
  { minutes: 1440, label: "Uma vez por dia" },
];
export const MIN_FREQUENCY_MINUTES = 60;
export const MAX_FREQUENCY_MINUTES = 10080;

export const DEFAULT_CRITERIA: RadarCriteria = {
  minViews: 100_000,
  minLikes: 0,
  minComments: 0,
  maxAgeHours: 24 * 14,
  minScore: 30,
  maxSelectedPerRun: 10,
};

/** Proposta inicial (spec §6) — ajustável por radar. */
export const DEFAULT_SCORE_WEIGHTS: ScoreWeights = {
  velocity: 35,
  likeRate: 20,
  commentRate: 15,
  recency: 15,
  relevance: 15,
};

export const MAX_RADARS_PER_USER = 20;
export const MAX_SOURCES_PER_RADAR = 15;
export const MAX_KEYWORDS = 15;
export const MAX_HASHTAGS = 30;

/** Palavras-chave sugeridas para o tema GTA 6 (spec §5). */
export const GTA6_KEYWORDS = [
  "GTA 6",
  "GTA VI",
  "GTA 6 Brasil",
  "GTA 6 trailer",
  "GTA 6 details",
  "GTA 6 news",
  "Vice City",
  "GTA 6 secrets",
  "GTA 6 updates",
];

/** Termos que identificam o tema (relevância por regras, sem IA). */
export const THEME_ALIASES: Record<string, string[]> = {
  "gta-6": ["gta 6", "gta vi", "gta6", "gtavi", "grand theft auto vi", "grand theft auto 6", "vice city", "leonida", "lucia", "jason"],
  "gta-5": ["gta 5", "gta v", "gta5", "gtav", "grand theft auto v", "gta online", "los santos"],
};

export function isLicenseScopeComplete(scope: Partial<LicenseScope> | null | undefined): boolean {
  return Boolean(scope?.edit && scope?.republish && scope?.commercial);
}
