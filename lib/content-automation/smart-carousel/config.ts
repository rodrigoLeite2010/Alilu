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
  imageSource: "AUTO" | "NONE";
  addFinalImage: boolean;
  generateCaption: boolean;
}

export const DEFAULT_SMART_CAROUSEL_CONFIG: SmartCarouselConfig = {
  slideCount: 8,
  templateMode: "AUTO",
  templateId: null,
  imageSource: "AUTO",
  addFinalImage: true,
  generateCaption: true,
};

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
  if (raw.imageSource !== undefined && raw.imageSource !== "AUTO" && raw.imageSource !== "NONE") {
    problems.push("Fonte de imagens inválida.");
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
    imageSource: raw.imageSource === "NONE" ? "NONE" : "AUTO",
    addFinalImage: typeof raw.addFinalImage === "boolean" ? raw.addFinalImage : d.addFinalImage,
    generateCaption: typeof raw.generateCaption === "boolean" ? raw.generateCaption : d.generateCaption,
  };
}
