/**
 * Linha de diagnóstico de cada geração do Carrossel Inteligente (preview, manual da automação e cron).
 * Segura: sem chaves, tokens ou dados pessoais — só categoria, tema, histórico recente e contagens.
 */
export const CAROUSEL_SYSTEM_PROMPT_ID = "carousel-system-v2-neutral";

export interface CarouselDiagnosticInput {
  category: string | null;
  topic: string;
  topicSource: "AUTO" | "PROMPT";
  recentCategories: readonly (string | null)[];
  recentTopics: readonly string[];
  /** Há prompt configurado (AutomationSettings) ou foi usado o estilo padrão. */
  promptSource: "AutomationSettings" | "Default";
  /** O prompt configurado foi trocado/ignorado por outro (false = o do usuário valeu). */
  promptOverride: boolean;
  provider: string | null;
  model: string | null;
  finalPromptChars: number | null;
  creatorBias: readonly string[];
  imagesSelected: number;
  imageIds: readonly string[];
  templatesSelected: number;
  templateId: string | null;
  structure: string | null;
  relaxed: readonly string[];
}

const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

export function formatCarouselDiagnostic(d: CarouselDiagnosticInput): string {
  const cats = d.recentCategories.map((c) => c ?? "—").slice(0, 5);
  const topics = d.recentTopics.slice(0, 5).map((t) => clip(t, 60));
  return [
    "CarouselGeneration",
    `Category: ${d.category ?? "—"}`,
    `Topic: ${clip(d.topic, 120)}`,
    `TopicSource: ${d.topicSource}`,
    `RecentCategories: [${cats.join(", ")}]`,
    `RecentTopics: [${topics.join(" | ")}]${d.recentTopics.length > 5 ? ` (+${d.recentTopics.length - 5})` : ""}`,
    `PromptSource: ${d.promptSource}`,
    `PromptOverride: ${d.promptOverride}`,
    `SystemPrompt: ${CAROUSEL_SYSTEM_PROMPT_ID}`,
    `Provider: ${d.provider ?? "—"}`,
    `Model: ${d.model ?? "—"}`,
    `FinalPromptChars: ${d.finalPromptChars ?? "—"}`,
    `Structure: ${d.structure ?? "—"}`,
    `CreatorBias: ${d.creatorBias.length ? d.creatorBias.join(",") : "none"}`,
    `ImagesSelected: ${d.imagesSelected}`,
    `ImageIds: [${d.imageIds.join(", ")}]`,
    `TemplatesSelected: ${d.templatesSelected}`,
    `Template: ${d.templateId ?? "—"}`,
    ...(d.relaxed.length ? [`Relaxed: ${d.relaxed.join("; ")}`] : []),
  ].join(" / ");
}
