/**
 * Frases de tom por estilo (ETAPA 10) — genéricas o bastante para servir a
 * qualquer tipo de conteúdo, sem contradizer nenhum deles. Cada estilo tem
 * mais de uma opção para dar variedade real ao usar "Gerar novas opções"
 * (ETAPA 11), sem repetir sempre a mesma frase.
 */

import type { CaptionStyleId } from "./types";

export const STYLE_TONE_PHRASES: Record<CaptionStyleId, string[]> = {
  profissional: [
    "Contamos com a sua confiança.",
    "Estamos à disposição para o que precisar.",
    "Prezamos por um atendimento de qualidade.",
  ],
  descontraido: ["Bora nessa?", "Vem com a gente!", "Isso é para quem topa!"],
  comercial: [
    "Não perca essa chance.",
    "Fale com a gente agora mesmo.",
    "Garanta o seu quanto antes.",
  ],
  inspirador: [
    "Cada passo importa nessa jornada.",
    "Acredite no que você está construindo.",
    "Grandes coisas começam de um jeito simples.",
  ],
  informativo: [
    "Fique por dentro de todos os detalhes.",
    "Confira as informações a seguir.",
    "Saiba mais sobre o assunto.",
  ],
};

export function pickStyleTonePhrase(style: CaptionStyleId, seed: number): string {
  const phrases = STYLE_TONE_PHRASES[style];
  const index = ((seed % phrases.length) + phrases.length) % phrases.length;
  return phrases[index];
}
