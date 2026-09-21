/**
 * Geração de legendas (ETAPA 8-11) — nada de IA, nada de servidor: monta o
 * texto combinando os modelos de content-templates.ts com o tom de
 * style-phrases.ts, usando só os dados que o próprio usuário preencheu no
 * formulário. Sempre devolve 3 variações com diferenças reais de redação
 * (3 estruturas de frase diferentes, não a mesma frase com sinônimos).
 *
 * `seed` é o que muda entre um clique em "Gerar novas opções" e outro
 * (ETAPA 11): desloca qual frase de tom de cada estilo é usada em cada
 * variação, dentro do banco de frases já existente — uma "variação útil
 * dentro dos limites do modelo", nunca inventando conteúdo novo.
 */

import { CAPTION_CONTENT_TEMPLATES, type CaptionContext } from "./content-templates";
import { buildHashtags, getContentTypeEmoji } from "./decorations";
import { pickStyleTonePhrase } from "./style-phrases";
import type { CaptionFormInput, GeneratedCaption } from "./types";

const FALLBACK_SUBJECT = "esse assunto";

function buildContext(input: CaptionFormInput): CaptionContext {
  const subject = input.subject.trim();
  const audience = input.audience.trim();
  return {
    subject: subject.length > 0 ? subject : FALLBACK_SUBJECT,
    audience: audience.length > 0 ? audience : null,
  };
}

function buildCaptionText(
  variantIndex: number,
  ctx: CaptionContext,
  input: CaptionFormInput,
  seed: number
): string {
  const variant = CAPTION_CONTENT_TEMPLATES[input.contentType][variantIndex];
  const toneLine = pickStyleTonePhrase(input.style, seed + variantIndex);
  const emoji = input.includeEmojis ? ` ${getContentTypeEmoji(input.contentType)}` : "";

  const paragraphs = [`${variant.hook(ctx)}${emoji}`, toneLine];

  if (input.size === "medio" || input.size === "longo") {
    paragraphs.push(variant.body(ctx));
  }
  if (input.size === "longo") {
    paragraphs.push(variant.closing(ctx));
  }

  const cta = input.callToAction.trim();
  if (cta.length > 0) {
    paragraphs.push(cta);
  }

  const hashtags = input.includeHashtags ? buildHashtags(input) : [];
  if (hashtags.length > 0) {
    paragraphs.push(hashtags.join(" "));
  }

  return paragraphs.join("\n\n");
}

export const CAPTION_VARIANT_COUNT = 3;

/** Sempre devolve CAPTION_VARIANT_COUNT (3) legendas — nunca menos, mesmo com campos opcionais vazios. */
export function generateCaptions(input: CaptionFormInput, seed = 0): GeneratedCaption[] {
  const ctx = buildContext(input);
  const hashtags = input.includeHashtags ? buildHashtags(input) : [];

  return Array.from({ length: CAPTION_VARIANT_COUNT }, (_, variantIndex) => ({
    id: `${input.contentType}-${variantIndex}-${seed}`,
    text: buildCaptionText(variantIndex, ctx, input, seed),
    hashtags,
  }));
}
