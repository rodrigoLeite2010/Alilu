/**
 * Emojis (opcionais, um por tipo de conteúdo — ETAPA 10) e hashtags
 * (opcionais, derivadas só do tipo de conteúdo e do assunto que o próprio
 * usuário digitou — nunca uma lista de hashtags "de engajamento" aleatória
 * ou prometendo alcance, ETAPA 10).
 */

import type { CaptionContentTypeId, CaptionFormInput } from "./types";

const CONTENT_TYPE_EMOJI: Record<CaptionContentTypeId, string> = {
  promocao: "🎉",
  produto: "✨",
  restaurante: "🍽️",
  aniversario: "🎂",
  agradecimento: "🙏",
  "conteudo-educativo": "📚",
  dicas: "💡",
  comunicado: "📣",
  motivacional: "🌱",
  pessoal: "📸",
};

export function getContentTypeEmoji(contentType: CaptionContentTypeId): string {
  return CONTENT_TYPE_EMOJI[contentType];
}

/** Remove acentos e qualquer caractere que não seja letra/número, para virar uma hashtag válida. */
function slugifyForHashtag(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase();
}

const CONTENT_TYPE_HASHTAG_WORD: Record<CaptionContentTypeId, string> = {
  promocao: "promocao",
  produto: "produto",
  restaurante: "restaurante",
  aniversario: "aniversario",
  agradecimento: "agradecimento",
  "conteudo-educativo": "conteudoeducativo",
  dicas: "dicas",
  comunicado: "comunicado",
  motivacional: "motivacional",
  pessoal: "publicacaopessoal",
};

const MAX_SUBJECT_HASHTAGS = 2;
const MAX_HASHTAG_WORD_LENGTH = 24;

/**
 * Gera até 3 hashtags: uma do tipo de conteúdo (sempre relevante, porque
 * foi o próprio usuário quem escolheu esse tipo) e, quando o assunto
 * informado tiver palavras aproveitáveis, até duas derivadas dele. Se o
 * assunto não render nenhuma palavra utilizável, não força nenhuma
 * hashtag "genérica" no lugar — só devolve a do tipo de conteúdo, para o
 * usuário editar/completar manualmente (ETAPA 10).
 */
export function buildHashtags(input: Pick<CaptionFormInput, "subject" | "contentType">): string[] {
  const hashtags = new Set<string>();
  hashtags.add(`#${CONTENT_TYPE_HASHTAG_WORD[input.contentType]}`);

  const subjectWords = input.subject
    .split(/\s+/)
    .map(slugifyForHashtag)
    .filter((word) => word.length >= 3 && word.length <= MAX_HASHTAG_WORD_LENGTH);

  for (const word of subjectWords) {
    if (hashtags.size >= 1 + MAX_SUBJECT_HASHTAGS) break;
    hashtags.add(`#${word}`);
  }

  return Array.from(hashtags);
}
