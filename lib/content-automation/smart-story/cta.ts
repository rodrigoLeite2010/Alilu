import { createRng } from "./random";
import { normalizeForCompare } from "./text";
import { NONE_BRAND, type StoryBrand } from "./brand";
import type { StoryType } from "./types";

type CtaKind = "engage" | "share" | "visit" | "follow";
type CtaPool = Record<CtaKind, string[]>;

/**
 * CTAs que a plataforma REALMENTE consegue cumprir num Story publicado
 * pela API: sem sticker nativo (a Meta não permite publicar enquete,
 * pergunta ou link). Por isso nada de "vote", "toque", "clique" ou
 * "deslize" — só respostas por direct, reação, compartilhamento e visita.
 */
const GENERIC_POOL = {
  engage: [
    "Responda no direct",
    "Reaja com um coração se concorda",
    "Me conta no direct",
    "Responda aqui com sua opinião",
    "Manda sua resposta no direct",
  ],
  share: ["Envie para quem precisa ouvir isso", "Compartilhe com alguém especial", "Manda para um amigo"],
};

/** Pool da marca Alilu (exportado por compatibilidade: é o pool da conta do Alilu). */
export const CTA_POOL: CtaPool = {
  ...GENERIC_POOL,
  visit: ["Acesse alilu.com.br", "Conheça as ferramentas no alilu.com.br", "Veja mais no alilu.com.br"],
  follow: ["Siga @alilu.tec", "Siga para ver mais", "Acompanhe @alilu.tec"],
};

/**
 * Pool de CTAs da marca. "visit" só existe com site próprio; "follow" usa o
 * @ próprio (ou o genérico "Siga para ver mais"). NUNCA devolve texto do
 * Alilu para quem não é o Alilu.
 */
export function ctaPoolFor(brand: StoryBrand): CtaPool {
  if (brand.kind === "ALILU") return CTA_POOL;
  return {
    ...GENERIC_POOL,
    visit: brand.site ? [`Acesse ${brand.site}`, `Veja mais em ${brand.site}`, `Conheça ${brand.site}`] : [],
    follow: brand.handle ? [`Siga ${brand.handle}`, "Siga para ver mais", `Acompanhe ${brand.handle}`] : ["Siga para ver mais"],
  };
}

const CTA_KIND_BY_TYPE: Record<StoryType, CtaKind> = {
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
 * menos recente. Sem site, o convite de "visita" cai para "engajar".
 */
export function pickCta(type: StoryType, seed: string, recentCtas: string[], brand: StoryBrand = NONE_BRAND): string {
  const pools = ctaPoolFor(brand);
  let pool = pools[CTA_KIND_BY_TYPE[type]];
  if (pool.length === 0) pool = pools.engage;
  const recent = new Set(recentCtas.map(normalizeForCompare));
  const fresh = pool.filter((cta) => !recent.has(normalizeForCompare(cta)));
  const list = fresh.length > 0 ? fresh : pool;
  return list[Math.floor(createRng(`${seed}|cta`)() * list.length)];
}

