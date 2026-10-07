import { createRng } from "./random";
import { normalizeForCompare } from "./text";
import type { StoryType } from "./types";

/**
 * CTAs que a plataforma REALMENTE consegue cumprir num Story publicado
 * pela API: sem sticker nativo (a Meta não permite publicar enquete,
 * pergunta ou link). Por isso nada de "vote", "toque", "clique" ou
 * "deslize" — só respostas por direct, reação, compartilhamento e visita.
 */
export const CTA_POOL: Record<"engage" | "share" | "visit" | "follow", string[]> = {
  engage: [
    "Responda no direct",
    "Reaja com um coração se concorda",
    "Me conta no direct",
    "Responda aqui com sua opinião",
    "Manda sua resposta no direct",
  ],
  share: [
    "Envie para quem precisa ouvir isso",
    "Compartilhe com alguém especial",
    "Manda para um amigo",
  ],
  visit: ["Acesse alilu.com.br", "Conheça as ferramentas no alilu.com.br", "Veja mais no alilu.com.br"],
  follow: ["Siga @alilu.tec", "Siga para ver mais", "Acompanhe @alilu.tec"],
};

const CTA_KIND_BY_TYPE: Record<StoryType, keyof typeof CTA_POOL> = {
  REFLECTION: "share",
  EMOTIONAL_QUESTION: "engage",
  VISUAL_POLL: "engage",
  CHOICE_AB: "engage",
  COMPLETE_SENTENCE: "engage",
  MINI_STORY: "share",
  CURIOSITY: "share",
  CHECKLIST: "share",
  ADVICE: "share",
  CTA: "visit",
  ALILU_BRAND: "follow",
};

/** Frases que prometem interatividade que a API não publica (sticker nativo). */
export const INTERACTIVE_CLAIM_RE = /\b(vote|votar|vota|toque|tocar|clique|clicar|deslize|deslizar|arraste|arrastar)\b/i;

/**
 * Um CTA variado para o tipo: sorteia (determinístico pela semente) entre
 * os do tipo, sem repetir os CTAs recentes. Sem alternativa, repete o
 * menos recente.
 */
export function pickCta(type: StoryType, seed: string, recentCtas: string[]): string {
  const pool = CTA_POOL[CTA_KIND_BY_TYPE[type]];
  const recent = new Set(recentCtas.map(normalizeForCompare));
  const fresh = pool.filter((cta) => !recent.has(normalizeForCompare(cta)));
  const list = fresh.length > 0 ? fresh : pool;
  return list[Math.floor(createRng(`${seed}|cta`)() * list.length)];
}
