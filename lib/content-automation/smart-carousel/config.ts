import { CAROUSEL_LIMITS } from "@/lib/carousel/carousel-plans";
import { isCarouselTemplateId } from "@/lib/carousel/design/templates";

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
};

const IMAGE_SOURCES: string[] = ["AUTO", "OWN", "COMBINED", "NONE"];
const isIdList = (value: unknown): value is string[] =>
  Array.isArray(value) && value.length <= 50 && value.every((item) => typeof item === "string" && /^[0-9a-f-]{36}$/i.test(item));
const isWindow = (value: unknown): value is number => typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 60;

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
  return {
    slideCount,
    templateMode: raw.templateMode === "FIXED" && templateId ? "FIXED" : "AUTO",
    templateId: raw.templateMode === "FIXED" ? templateId : null,
    imageSource: IMAGE_SOURCES.includes(raw.imageSource as string) ? (raw.imageSource as SmartCarouselConfig["imageSource"]) : "AUTO",
    ownImageMediaIds: isIdList(raw.ownImageMediaIds) ? raw.ownImageMediaIds : [],
    antiRepeatWindow: isWindow(raw.antiRepeatWindow) ? raw.antiRepeatWindow : d.antiRepeatWindow,
    addFinalImage: typeof raw.addFinalImage === "boolean" ? raw.addFinalImage : d.addFinalImage,
    generateCaption: typeof raw.generateCaption === "boolean" ? raw.generateCaption : d.generateCaption,
  };
}
