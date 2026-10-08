import { CAROUSEL_LIMITS } from "@/lib/carousel/carousel-plans";
import { isCarouselTemplateId } from "@/lib/carousel/design/templates";
import { CAROUSEL_CATEGORY_IDS, defaultCategoryWeights, isCarouselCategoryId, type CarouselCategoryId } from "./categories";

/**
 * Configuração do Carrossel Inteligente automático (Piloto Automático).
 * Guardada em content_automations.smart_carousel_config (jsonb). Valores
 * inválidos são ERRO de validação — nunca trocados em silêncio.
 */
export interface SmartCarouselConfig {
  slideCount: number;
  templateMode: "AUTO" | "FIXED";
  templateId: string | null;
  /** AUTO = banco de fotos (Pixabay); OWN = só imagens do usuário; COMBINED = alterna próprias e banco; NONE = só o modelo visual. */
  imageSource: "AUTO" | "OWN" | "COMBINED" | "NONE";
  /** Imagens próprias (ids da biblioteca de mídia) usadas em OWN/COMBINED. */
  ownImageMediaIds: string[];
  /** Janela da anti-repetição: quantos carrosséis recentes (tema, gancho, título, imagens) são evitados. */
  antiRepeatWindow: number;
  addFinalImage: boolean;
  generateCaption: boolean;
  /**
   * De onde vem o TEMA de cada carrossel automático.
   * AUTO (padrão) = o Alilu escolhe categoria + tema (planejador); o prompt do Piloto é só a
   * orientação de estilo/tom. PROMPT = o texto do prompt do dia é o próprio tema (modo antigo).
   */
  topicSource: "AUTO" | "PROMPT";
  /** Categorias ligadas (checkbox). */
  enabledCategories: CarouselCategoryId[];
  /** Peso de cada categoria no sorteio (0–100; 0 = nunca). */
  categoryWeights: Record<string, number>;
  /** Não repetir a categoria nos últimos N carrosséis (0 desliga). */
  avoidCategoryWindow: number;
  /** Não repetir o tema nos últimos N carrosséis. */
  avoidTopicWindow: number;
  /** Faixa de fotos reais por carrossel (não é obrigatório foto em todo slide). */
  minPhotos: number;
  maxPhotos: number;
}

export const DEFAULT_SMART_CAROUSEL_CONFIG: SmartCarouselConfig = {
  slideCount: 8,
  templateMode: "AUTO",
  templateId: null,
  imageSource: "AUTO",
  ownImageMediaIds: [],
  antiRepeatWindow: 15,
  addFinalImage: true,
  generateCaption: true,
  topicSource: "AUTO",
  enabledCategories: [...CAROUSEL_CATEGORY_IDS],
  categoryWeights: defaultCategoryWeights(),
  avoidCategoryWindow: 3,
  avoidTopicWindow: 15,
  minPhotos: 3,
  maxPhotos: 5,
};

const IMAGE_SOURCES: string[] = ["AUTO", "OWN", "COMBINED", "NONE"];
const isIdList = (value: unknown): value is string[] =>
  Array.isArray(value) && value.length <= 50 && value.every((item) => typeof item === "string" && /^[0-9a-f-]{36}$/i.test(item));
const isWindow = (value: unknown): value is number => typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 60;

const isCategoryList = (value: unknown): value is CarouselCategoryId[] =>
  Array.isArray(value) && value.length <= CAROUSEL_CATEGORY_IDS.length && value.every(isCarouselCategoryId) && new Set(value).size === value.length;
const isWeight = (value: unknown): value is number => typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 100;
const isWeightMap = (value: unknown): value is Record<string, number> =>
  typeof value === "object" && value !== null && !Array.isArray(value) && Object.entries(value).every(([key, weight]) => isCarouselCategoryId(key) && isWeight(weight));
const isSmallWindow = (value: unknown): value is number => typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 10;
const isPhotoCount = (value: unknown): value is number => typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 8;

export function validateSmartCarouselConfigInput(input: unknown): string[] {
  if (typeof input !== "object" || input === null || Array.isArray(input)) return ["Configuração inválida."];
  const raw = input as Record<string, unknown>;
  const problems: string[] = [];
  if (raw.slideCount !== undefined) {
    const n = raw.slideCount;
    if (typeof n !== "number" || !Number.isInteger(n) || n < CAROUSEL_LIMITS.minSlides || n > CAROUSEL_LIMITS.maxSlides) {
      problems.push(`O número de slides precisa ser um inteiro entre ${CAROUSEL_LIMITS.minSlides} e ${CAROUSEL_LIMITS.maxSlides}.`);
    }
  }
  if (raw.templateMode !== undefined && raw.templateMode !== "AUTO" && raw.templateMode !== "FIXED") {
    problems.push("Modo de template inválido.");
  }
  if (raw.templateId !== undefined && raw.templateId !== null && !isCarouselTemplateId(raw.templateId)) {
    problems.push("Template inválido.");
  }
  if (raw.imageSource !== undefined && !IMAGE_SOURCES.includes(raw.imageSource as string)) {
    problems.push("Fonte de imagens inválida.");
  }
  if (raw.ownImageMediaIds !== undefined && !isIdList(raw.ownImageMediaIds)) {
    problems.push("Lista de imagens próprias inválida (máximo 50).");
  }
  if (raw.antiRepeatWindow !== undefined && !isWindow(raw.antiRepeatWindow)) {
    problems.push("A janela de anti-repetição precisa ser um inteiro entre 1 e 60.");
  }
  if ((raw.imageSource === "OWN" || raw.imageSource === "COMBINED") && Array.isArray(raw.ownImageMediaIds) && raw.ownImageMediaIds.length === 0) {
    problems.push("Escolha ao menos uma imagem própria.");
  }
  for (const key of ["addFinalImage", "generateCaption"] as const) {
    if (raw[key] !== undefined && typeof raw[key] !== "boolean") problems.push(`${key} precisa ser verdadeiro ou falso.`);
  }
  if (raw.templateMode === "FIXED" && !isCarouselTemplateId(raw.templateId)) {
    problems.push("Escolha o template fixo.");
  }
  if (raw.topicSource !== undefined && raw.topicSource !== "AUTO" && raw.topicSource !== "PROMPT") problems.push("Origem do tema inválida.");
  if (raw.enabledCategories !== undefined && !isCategoryList(raw.enabledCategories)) problems.push("Lista de categorias inválida.");
  if (raw.categoryWeights !== undefined && !isWeightMap(raw.categoryWeights)) problems.push("Os pesos das categorias precisam ser inteiros entre 0 e 100.");
  if (isCategoryList(raw.enabledCategories) && isWeightMap(raw.categoryWeights)) {
    const weights = { ...defaultCategoryWeights(), ...raw.categoryWeights };
    if (!raw.enabledCategories.some((id) => (weights[id] ?? 0) > 0)) problems.push("Ligue ao menos uma categoria com peso maior que zero.");
  } else if (isCategoryList(raw.enabledCategories) && raw.categoryWeights === undefined && raw.enabledCategories.length === 0) {
    problems.push("Ligue ao menos uma categoria.");
  }
  if (raw.avoidCategoryWindow !== undefined && !isSmallWindow(raw.avoidCategoryWindow)) problems.push("A janela de categorias precisa ser um inteiro entre 0 e 10.");
  if (raw.avoidTopicWindow !== undefined && !isWindow(raw.avoidTopicWindow)) problems.push("A janela de temas precisa ser um inteiro entre 1 e 60.");
  if (raw.minPhotos !== undefined && !isPhotoCount(raw.minPhotos)) problems.push("O mínimo de fotos precisa ser um inteiro entre 0 e 8.");
  if (raw.maxPhotos !== undefined && !isPhotoCount(raw.maxPhotos)) problems.push("O máximo de fotos precisa ser um inteiro entre 0 e 8.");
  if (isPhotoCount(raw.minPhotos) && isPhotoCount(raw.maxPhotos) && raw.minPhotos > raw.maxPhotos) problems.push("O mínimo de fotos não pode passar do máximo.");
  return problems;
}

/** Aplica padrões e descarta o que não for válido (leitura do banco). */
export function normalizeSmartCarouselConfig(input: unknown): SmartCarouselConfig {
  const raw = typeof input === "object" && input !== null && !Array.isArray(input) ? (input as Record<string, unknown>) : {};
  const d = DEFAULT_SMART_CAROUSEL_CONFIG;
  const slideCount =
    typeof raw.slideCount === "number" && Number.isInteger(raw.slideCount) && raw.slideCount >= CAROUSEL_LIMITS.minSlides && raw.slideCount <= CAROUSEL_LIMITS.maxSlides
      ? raw.slideCount
      : d.slideCount;
  const templateId = isCarouselTemplateId(raw.templateId) ? raw.templateId : null;
  // Categorias: sem configuração (automações antigas) = todas ligadas com os pesos padrão.
  const enabledCategories = isCategoryList(raw.enabledCategories) && raw.enabledCategories.length > 0 ? raw.enabledCategories : [...d.enabledCategories];
  const categoryWeights = { ...defaultCategoryWeights(), ...(isWeightMap(raw.categoryWeights) ? raw.categoryWeights : {}) };
  const maxPhotos = isPhotoCount(raw.maxPhotos) ? raw.maxPhotos : d.maxPhotos;
  const minPhotos = Math.min(isPhotoCount(raw.minPhotos) ? raw.minPhotos : d.minPhotos, maxPhotos);
  return {
    slideCount,
    templateMode: raw.templateMode === "FIXED" && templateId ? "FIXED" : "AUTO",
    templateId: raw.templateMode === "FIXED" ? templateId : null,
    imageSource: IMAGE_SOURCES.includes(raw.imageSource as string) ? (raw.imageSource as SmartCarouselConfig["imageSource"]) : "AUTO",
    ownImageMediaIds: isIdList(raw.ownImageMediaIds) ? raw.ownImageMediaIds : [],
    antiRepeatWindow: isWindow(raw.antiRepeatWindow) ? raw.antiRepeatWindow : d.antiRepeatWindow,
    addFinalImage: typeof raw.addFinalImage === "boolean" ? raw.addFinalImage : d.addFinalImage,
    generateCaption: typeof raw.generateCaption === "boolean" ? raw.generateCaption : d.generateCaption,
    topicSource: raw.topicSource === "PROMPT" ? "PROMPT" : "AUTO",
    enabledCategories,
    categoryWeights,
    avoidCategoryWindow: isSmallWindow(raw.avoidCategoryWindow) ? raw.avoidCategoryWindow : d.avoidCategoryWindow,
    avoidTopicWindow: isWindow(raw.avoidTopicWindow) ? raw.avoidTopicWindow : d.avoidTopicWindow,
    minPhotos,
    maxPhotos,
  };
}
