/**
 * Validação/normalização das configurações do radar e das fontes (puro).
 */
import { findCategory, findTheme } from "@/lib/video-queue/catalog";
import { isForbiddenHost } from "@/lib/video-queue/links";
import { normalizeWeights } from "./score";
import { isValidYoutubeChannelId } from "./rss";
import {
  CAPTION_STYLE_LABEL,
  DEFAULT_CRITERIA,
  GTA6_KEYWORDS,
  MAX_FREQUENCY_MINUTES,
  MAX_HASHTAGS,
  MAX_KEYWORDS,
  MAX_SOURCES_PER_RADAR,
  MIN_FREQUENCY_MINUTES,
  type CaptionMode,
  type CaptionStyle,
  type LicenseScope,
  type PriorityMode,
  type RadarCriteria,
  type RadarSourceType,
  type ScoreWeights,
  type SourceLicense,
} from "./types";

export class RadarConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RadarConfigError";
  }
}

export interface RadarSettings {
  name: string;
  category: string;
  theme: string;
  keywords: string[];
  hashtags: string[];
  language: string;
  region: string;
  frequencyMinutes: number;
  criteria: RadarCriteria;
  scoreWeights: ScoreWeights;
  autoMode: boolean;
  supervisedMode: boolean;
  queueMin: number;
  queueTarget: number;
  priorityMode: PriorityMode;
  captionMode: CaptionMode;
  captionStyle: CaptionStyle;
  aiClassification: boolean;
  aiDailyCap: number;
}

export interface SourceInput {
  type: RadarSourceType;
  label: string;
  enabled: boolean;
  config: { url?: string; channelId?: string };
  license: SourceLicense;
  licenseScope: LicenseScope;
  licenseNote: string | null;
  licenseEvidenceUrl: string | null;
  trustedForFacts: boolean;
}

const str = (value: unknown) => (typeof value === "string" ? value : "");
const bool = (value: unknown, fallback: boolean) => (typeof value === "boolean" ? value : fallback);

function int(value: unknown, fallback: number, min: number, max: number, label: string): number {
  if (value === undefined || value === null || value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) throw new RadarConfigError(`${label}: use um número inteiro entre ${min} e ${max}.`);
  return parsed;
}

function list(value: unknown, max: number, label: string, maxLength = 60): string[] {
  const raw = Array.isArray(value) ? value : typeof value === "string" ? value.split(/[\n,;]+/) : [];
  const items = [...new Set(raw.map((item) => str(item).replace(/\s+/g, " ").trim()).filter(Boolean))];
  if (items.length > max) throw new RadarConfigError(`${label}: no máximo ${max}.`);
  if (items.some((item) => item.length > maxLength)) throw new RadarConfigError(`${label}: cada item pode ter até ${maxLength} caracteres.`);
  return items;
}

export function normalizeCriteria(raw: unknown, base: RadarCriteria = DEFAULT_CRITERIA): RadarCriteria {
  const value = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    minViews: int(value.minViews, base.minViews, 0, 1_000_000_000, "Visualizações mínimas"),
    minLikes: int(value.minLikes, base.minLikes, 0, 100_000_000, "Curtidas mínimas"),
    minComments: int(value.minComments, base.minComments, 0, 10_000_000, "Comentários mínimos"),
    maxAgeHours: int(value.maxAgeHours, base.maxAgeHours, 1, 24 * 365, "Idade máxima (horas)"),
    minScore: int(value.minScore, base.minScore, 0, 100, "Pontuação mínima"),
    maxSelectedPerRun: int(value.maxSelectedPerRun, base.maxSelectedPerRun, 1, 50, "Máximo selecionado por execução"),
  };
}

export function defaultSettings(category = "games", theme = "gta-6"): RadarSettings {
  const themeRecord = findTheme(category, theme);
  return {
    name: themeRecord ? `Radar ${themeRecord.name} Brasil` : "Radar",
    category,
    theme,
    keywords: theme === "gta-6" ? [...GTA6_KEYWORDS] : themeRecord ? [themeRecord.name] : [],
    hashtags: themeRecord ? [...themeRecord.hashtags] : [],
    language: "pt",
    region: "BR",
    frequencyMinutes: 360,
    criteria: { ...DEFAULT_CRITERIA },
    scoreWeights: normalizeWeights(null),
    autoMode: true,
    supervisedMode: true,
    queueMin: 5,
    queueTarget: 15,
    priorityMode: "SCORE",
    captionMode: "TEMPLATE",
    captionStyle: "NEWS",
    aiClassification: false,
    aiDailyCap: 20,
  };
}

export function normalizeSettings(raw: Record<string, unknown>, base?: RadarSettings): RadarSettings {
  const category = str(raw.category ?? base?.category);
  const theme = str(raw.theme ?? base?.theme);
  if (!findCategory(category)) throw new RadarConfigError("Categoria inválida.");
  if (!findTheme(category, theme)) throw new RadarConfigError("Tema inválido para esta categoria.");
  const defaults = base ?? defaultSettings(category, theme);

  const name = (raw.name === undefined ? defaults.name : str(raw.name)).trim();
  if (!name || name.length > 80) throw new RadarConfigError("Dê um nome ao radar (até 80 caracteres).");

  const keywords = raw.keywords === undefined ? defaults.keywords : list(raw.keywords, MAX_KEYWORDS, "Palavras-chave");
  if (keywords.length === 0) throw new RadarConfigError("Informe pelo menos uma palavra-chave.");
  const hashtags = (raw.hashtags === undefined ? defaults.hashtags : list(raw.hashtags, MAX_HASHTAGS, "Hashtags", 40)).map((tag) =>
    tag.startsWith("#") ? tag : `#${tag}`,
  );
  if (hashtags.some((tag) => !/^#[\p{L}\p{N}_]+$/u.test(tag))) throw new RadarConfigError("Hashtags: use só letras, números e _ (ex.: #GTA6).");

  const language = (raw.language === undefined ? defaults.language : str(raw.language)).trim().toLowerCase();
  if (!/^[a-z]{2}$/.test(language)) throw new RadarConfigError("Idioma inválido (use o código de 2 letras, ex.: pt).");
  const region = (raw.region === undefined ? defaults.region : str(raw.region)).trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(region)) throw new RadarConfigError("País/região inválido (use o código de 2 letras, ex.: BR).");

  const frequencyMinutes = int(raw.frequencyMinutes, defaults.frequencyMinutes, MIN_FREQUENCY_MINUTES, MAX_FREQUENCY_MINUTES, "Frequência (minutos)");
  const criteria = normalizeCriteria(raw.criteria, defaults.criteria);
  let scoreWeights: ScoreWeights;
  try {
    scoreWeights = raw.scoreWeights === undefined ? defaults.scoreWeights : normalizeWeights(raw.scoreWeights as Record<string, unknown>);
  } catch (error) {
    throw new RadarConfigError((error as Error).message);
  }

  const autoMode = bool(raw.autoMode, defaults.autoMode);
  const supervisedMode = bool(raw.supervisedMode, defaults.supervisedMode);
  const queueMin = int(raw.queueMin, defaults.queueMin, 0, 500, "Tamanho mínimo da fila");
  const queueTarget = int(raw.queueTarget, defaults.queueTarget, 1, 1000, "Tamanho ideal da fila");
  if (queueMin > queueTarget) throw new RadarConfigError("O tamanho mínimo da fila não pode ser maior que o ideal.");

  const priorityMode = (raw.priorityMode ?? defaults.priorityMode) as PriorityMode;
  if (!["FIFO", "SCORE"].includes(priorityMode)) throw new RadarConfigError("Prioridade inválida.");
  const captionMode = (raw.captionMode ?? defaults.captionMode) as CaptionMode;
  if (!["TEMPLATE", "AI"].includes(captionMode)) throw new RadarConfigError("Modo de legenda inválido.");
  const captionStyle = (raw.captionStyle ?? defaults.captionStyle) as CaptionStyle;
  if (!(captionStyle in CAPTION_STYLE_LABEL)) throw new RadarConfigError("Estilo de legenda inválido.");

  return {
    name,
    category,
    theme,
    keywords,
    hashtags,
    language,
    region,
    frequencyMinutes,
    criteria,
    scoreWeights,
    autoMode,
    supervisedMode,
    queueMin,
    queueTarget,
    priorityMode,
    captionMode,
    captionStyle,
    aiClassification: bool(raw.aiClassification, defaults.aiClassification),
    aiDailyCap: int(raw.aiDailyCap, defaults.aiDailyCap, 0, 500, "Limite diário de IA"),
  };
}

function httpsFeedUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new RadarConfigError("Endereço do feed inválido.");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new RadarConfigError("O feed precisa ser http(s).");
  if (url.username || url.password || (url.port && url.port !== "80" && url.port !== "443")) throw new RadarConfigError("Endereço do feed não permitido.");
  // Primeira barreira contra SSRF (a definitiva é na conexão, em safe-download.ts).
  if (isForbiddenHost(url.hostname)) throw new RadarConfigError("Endereço interno ou privado não é aceito.");
  if (url.toString().length > 2048) throw new RadarConfigError("Endereço do feed longo demais.");
  return url.toString();
}

const SOURCE_TYPES: RadarSourceType[] = ["YOUTUBE_SEARCH", "YOUTUBE_CHANNEL", "RSS", "INSTAGRAM_HASHTAG", "TIKTOK"];

export function normalizeSource(raw: Record<string, unknown>): SourceInput {
  const type = str(raw.type) as RadarSourceType;
  if (!SOURCE_TYPES.includes(type)) throw new RadarConfigError("Tipo de fonte inválido.");
  const cfg = (raw.config && typeof raw.config === "object" ? raw.config : {}) as Record<string, unknown>;
  const config: SourceInput["config"] = {};
  if (type === "RSS") config.url = httpsFeedUrl(str(cfg.url));
  if (type === "YOUTUBE_CHANNEL") {
    const channelId = str(cfg.channelId).trim();
    if (!isValidYoutubeChannelId(channelId)) throw new RadarConfigError("ID do canal do YouTube inválido (começa com UC e tem 24 caracteres).");
    config.channelId = channelId;
  }
  const license = (str(raw.license) || "NONE") as SourceLicense;
  if (!["NONE", "OWN", "LICENSED"].includes(license)) throw new RadarConfigError("Tipo de autorização inválido.");
  // Pesquisa ampla (YouTube/Instagram/TikTok) é sempre conteúdo de terceiros.
  if (license !== "NONE" && (type === "YOUTUBE_SEARCH" || type === "INSTAGRAM_HASHTAG" || type === "TIKTOK")) {
    throw new RadarConfigError("Resultados de pesquisa são de terceiros: não podem ser marcados como próprios ou licenciados.");
  }
  const scopeRaw = (raw.licenseScope && typeof raw.licenseScope === "object" ? raw.licenseScope : {}) as Record<string, unknown>;
  const licenseScope: LicenseScope = {
    edit: scopeRaw.edit === true,
    republish: scopeRaw.republish === true,
    commercial: scopeRaw.commercial === true,
  };
  const licenseNote = str(raw.licenseNote).trim().slice(0, 1000) || null;
  const evidence = str(raw.licenseEvidenceUrl).trim();
  let licenseEvidenceUrl: string | null = null;
  if (evidence) {
    try {
      const url = new URL(evidence);
      if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error();
      licenseEvidenceUrl = url.toString().slice(0, 2048);
    } catch {
      throw new RadarConfigError("Link da comprovação da licença inválido.");
    }
  }
  if (license === "LICENSED" && !licenseNote && !licenseEvidenceUrl) {
    throw new RadarConfigError("Para conteúdo licenciado, descreva a licença ou informe o link da comprovação.");
  }
  if (license !== "NONE" && raw.rightsConfirmed !== true) {
    throw new RadarConfigError("Confirme que você tem os direitos declarados sobre os vídeos desta fonte.");
  }
  const label = str(raw.label).trim().slice(0, 80);
  return {
    type,
    label,
    enabled: raw.enabled !== false,
    config,
    license,
    licenseScope: license === "NONE" ? { edit: false, republish: false, commercial: false } : licenseScope,
    licenseNote,
    licenseEvidenceUrl,
    trustedForFacts: raw.trustedForFacts === true && type === "RSS",
  };
}

export function normalizeSources(raw: unknown): SourceInput[] {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) throw new RadarConfigError("Fontes inválidas.");
  if (raw.length > MAX_SOURCES_PER_RADAR) throw new RadarConfigError(`No máximo ${MAX_SOURCES_PER_RADAR} fontes por radar.`);
  return raw.map((item) => normalizeSource((item && typeof item === "object" ? item : {}) as Record<string, unknown>));
}
