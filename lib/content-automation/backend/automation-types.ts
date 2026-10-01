/**
 * Tipos compartilhados do Piloto Automático de Conteúdo. Espelham
 * exatamente os CHECKs da migração db/migrations/0004_content_automation.sql
 * — qualquer novo valor precisa ser adicionado nos dois lugares.
 */

export type AutomationStatus = "ACTIVE" | "PAUSED" | "ARCHIVED" | "ERROR";

export type DayOfWeek =
  | "MONDAY"
  | "TUESDAY"
  | "WEDNESDAY"
  | "THURSDAY"
  | "FRIDAY"
  | "SATURDAY"
  | "SUNDAY";

/** Sempre nesta ordem (segunda a domingo) — usado para gerar as 7 linhas de cada automação e para a UI. */
export const DAYS_OF_WEEK: DayOfWeek[] = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
];

export const DAY_OF_WEEK_LABEL: Record<DayOfWeek, string> = {
  MONDAY: "Segunda-feira",
  TUESDAY: "Terça-feira",
  WEDNESDAY: "Quarta-feira",
  THURSDAY: "Quinta-feira",
  FRIDAY: "Sexta-feira",
  SATURDAY: "Sábado",
  SUNDAY: "Domingo",
};

/**
 * "STORY": imagem 9:16 (1080×1920) publicada como Story do Instagram
 * (media_type=STORIES) — mesma geração de arte do POST, só que no formato
 * de Stories e sem legenda (Stories não têm legenda na API).
 */
export type AutomationContentType = "POST" | "REEL" | "CAROUSEL" | "STORY";

/** Quantos horários um mesmo dia pode ter (o principal + extras). */
export const MAX_SLOTS_PER_DAY = 6;

/**
 * Categoria opcional de um horário — só alimenta a variável {{categoria}}
 * do prompt e a sugestão de prompt na tela; nunca muda o fluxo de geração.
 */
export type AutomationContentCategory =
  | "MOTIVACIONAL"
  | "FINANCEIRO"
  | "UTILIDADES"
  | "CURIOSIDADE"
  | "DIVULGACAO"
  | "PERSONALIZADO";

export const CONTENT_CATEGORIES: AutomationContentCategory[] = [
  "MOTIVACIONAL",
  "FINANCEIRO",
  "UTILIDADES",
  "CURIOSIDADE",
  "DIVULGACAO",
  "PERSONALIZADO",
];

export const CONTENT_CATEGORY_LABEL: Record<AutomationContentCategory, string> = {
  MOTIVACIONAL: "Motivacional",
  FINANCEIRO: "Financeiro",
  UTILIDADES: "Utilidades",
  CURIOSIDADE: "Curiosidade",
  DIVULGACAO: "Divulgação",
  PERSONALIZADO: "Personalizado",
};

/** Tamanho máximo do texto desenhado sobre a imagem de um POST (cabe numa arte só) — compartilhado entre a validação do serviço e o formulário (WeekDayEditor). */
export const MAX_VISUAL_TEXT_LENGTH = 120;

/** Tamanho máximo do texto de um CAROUSEL — bem maior que o de POST, porque é dividido em vários slides (generateSlidesFromText, mesmo motor do Carrossel automático manual) em vez de precisar caber numa imagem só. */
export const MAX_CAROUSEL_VISUAL_TEXT_LENGTH = 4000;

/**
 * Como a legenda de um dia é definida: "AI" (padrão histórico) chama o
 * provedor de IA configurado a partir do `prompt` do dia; "MANUAL" usa
 * `manualCaption` tal como escrito pelo usuário, sem nenhuma chamada de
 * IA — o cron (content-automation-cron.ts) pula content-generation-service.ts
 * inteiro para esses dias.
 */
export type AutomationContentMode = "AI" | "MANUAL";

export type ImageMode = "AUTO_TEMPLATE" | "FIXED_IMAGE" | "MEDIA_LIBRARY";

export type VideoSelection = "FIXED" | "ROTATE" | "RANDOM";

export type AutomationRunStatus =
  | "PENDING"
  | "GENERATING"
  | "GENERATED"
  | "WAITING_APPROVAL"
  | "SCHEDULED"
  | "PUBLISHING"
  | "PUBLISHED"
  | "FAILED"
  | "CANCELLED";

export interface AutomationDayRecord {
  id: string;
  automationId: string;
  dayOfWeek: DayOfWeek;
  /**
   * 0 = horário principal do dia (sempre existe, criado junto da
   * automação); 1, 2, … = horários extras do mesmo dia ("+ Adicionar
   * horário"). Cada horário gera no máximo 1 execução por dia.
   */
  slotIndex: number;
  contentCategory: AutomationContentCategory | null;
  enabled: boolean;
  /**
   * "CAROUSEL" só é válido quando a automação usa imageMode =
   * "AUTO_TEMPLATE": em vez de desenhar UMA imagem, o texto visual
   * (mais longo que o de POST) é dividido em vários slides com o MESMO
   * motor do Carrossel automático manual (generateSlidesFromText) e
   * publicado como carrossel de verdade (createDraftCarouselPost).
   */
  contentType: AutomationContentType;
  contentMode: AutomationContentMode;
  prompt: string;
  /** Legenda final, usada tal como está quando contentMode = "MANUAL" (ignorado em modo "AI"). */
  manualCaption: string | null;
  /**
   * Texto desenhado sobre a imagem quando imageMode = "AUTO_TEMPLATE" e
   * contentMode = "MANUAL" (ver template-render-service.ts) — usado tal
   * como está em POST (frase curta) e CAROUSEL (texto mais longo,
   * dividido em slides na hora de gerar). Em modo "AI" o texto visual é
   * gerado a cada execução e nunca fica salvo aqui — este campo é
   * ignorado nesse caso.
   */
  visualText: string | null;
  publishTime: string; // "HH:mm"
  templateId: string | null;
  styleConfig: Record<string, unknown> | null;
  /**
   * Opacidade (0..1) do véu escuro sobre a foto de fundo quando imageMode
   * = "AUTO_TEMPLATE" — só para legibilidade do texto, nunca para
   * escurecer a imagem por padrão (ver template-render-service.ts).
   * `null` usa o padrão (20%).
   */
  overlayOpacity: number | null;
  /**
   * Cor (hex, "#rrggbb") do texto desenhado sobre a imagem quando
   * imageMode = "AUTO_TEMPLATE" (POST ou CAROUSEL) — ver
   * template-render-service.ts. `null` usa o padrão (branco, "#ffffff"),
   * mesma cor que o template "frase-motivacional" já usa por padrão no
   * editor manual.
   */
  visualTextColor: string | null;
  imageMediaId: string | null;
  videoMediaId: string | null;
}

export interface AutomationRecord {
  id: string;
  userId: string;
  instagramAccountId: string;
  name: string;
  description: string;
  status: AutomationStatus;
  timezone: string;
  brandContext: string;
  autoPublish: boolean;
  requireApproval: boolean;
  generationLeadMinutes: number;
  imageMode: ImageMode;
  fixedImageMediaId: string | null;
  videoSelection: VideoSelection;
  fixedVideoMediaId: string | null;
  createdAt: Date;
  updatedAt: Date;
  lastRunAt: Date | null;
  nextRunAt: Date | null;
}

export interface AutomationWithDays extends AutomationRecord {
  days: AutomationDayRecord[];
}

export interface AutomationRunRecord {
  id: string;
  automationId: string;
  automationDayId: string;
  instagramAccountId: string;
  runDate: string; // "YYYY-MM-DD"
  status: AutomationRunStatus;
  publicationId: string | null;
  generationAttempt: number;
  errorMessage: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  nextAttemptAt: Date | null;
  createdAt: Date;
}
