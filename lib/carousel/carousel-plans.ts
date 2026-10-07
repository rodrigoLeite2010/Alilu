/**
 * Catálogo ÚNICO do produto "Carrossel Inteligente" — preços, cotas, limites
 * e regras comerciais. Só dados e funções puras (servidor e navegador).
 * Nunca escreva preço, cota, limite de perfis ou percentual de desconto em
 * outro lugar: telas, cobrança no Asaas e regras do servidor leem daqui.
 *
 * Produto SEPARADO do Piloto Automático (plans.ts): assinatura própria.
 */

export type CarouselPlanCode = "STARTER" | "PRO" | "TURBO" | "AGENCY";
export const CAROUSEL_PLAN_CODES: readonly CarouselPlanCode[] = ["STARTER", "PRO", "TURBO", "AGENCY"];

export interface CarouselPlanDefinition {
  code: CarouselPlanCode;
  name: string;
  /** Em centavos, preço de tabela. */
  priceCents: number;
  /** Carrosséis concluídos por ciclo de cobrança. */
  carouselsPerCycle: number;
  /** Perfis de Instagram que podem ter projetos neste plano. */
  maxProfiles: number;
  rank: number;
  /** Plano em destaque na tela de planos. */
  highlighted: boolean;
  features: readonly string[];
  /** Diferenciais que AINDA NÃO existem — só podem aparecer como "em breve". */
  upcoming: readonly string[];
}

const BASE_FEATURES = [
  "Temas sugeridos por IA e pautas semanais",
  "Pesquisa com fontes citadas",
  "Capa, fotos e templates Alilu",
  "Legenda e hashtags prontas",
  "Exportação em alta resolução",
  "Publicação e agendamento no Instagram",
] as const;

export const CAROUSEL_PLAN_DEFINITIONS: Record<CarouselPlanCode, CarouselPlanDefinition> = {
  STARTER: {
    code: "STARTER",
    name: "Starter",
    priceCents: 2990,
    carouselsPerCycle: 60,
    maxProfiles: 2,
    rank: 1,
    highlighted: false,
    features: [...BASE_FEATURES, "60 carrosséis por mês", "Até 2 perfis"],
    upcoming: [],
  },
  PRO: {
    code: "PRO",
    name: "Pro",
    priceCents: 4990,
    carouselsPerCycle: 90,
    maxProfiles: 2,
    rank: 2,
    highlighted: true,
    features: ["Tudo do Starter", "90 carrosséis por mês", "Até 2 perfis"],
    upcoming: [],
  },
  TURBO: {
    code: "TURBO",
    name: "Turbo",
    priceCents: 9990,
    carouselsPerCycle: 150,
    maxProfiles: 2,
    rank: 3,
    highlighted: false,
    features: ["Tudo do Pro", "150 carrosséis por mês", "Até 2 perfis"],
    upcoming: [],
  },
  AGENCY: {
    code: "AGENCY",
    name: "Agência",
    priceCents: 19990,
    carouselsPerCycle: 300,
    maxProfiles: 2,
    rank: 4,
    highlighted: false,
    features: ["Tudo do Turbo", "300 carrosséis por mês", "Até 2 perfis"],
    // Não existe arquitetura de equipes/agências hoje.
    upcoming: ["Equipes e múltiplos usuários", "Mais perfis por conta"],
  },
};

/** Percentual de desconto para quem já tem assinatura Alilu paga. REGRA CENTRAL — não repita o número. */
export const EXISTING_CUSTOMER_DISCOUNT_PERCENT = 10;

/** Teste grátis: 1 carrossel concluído por pessoa, sem cartão. */
export const CAROUSEL_FREE_TRIAL = { carousels: 1 } as const;

/** Limites de conteúdo dos slides. */
export const CAROUSEL_LIMITS = {
  minSlides: 5,
  maxSlides: 10,
  defaultSlides: 10,
  headline: 70,
  body: 220,
  cta: 40,
  subtitle: 100,
  topic: 200,
  caption: 2200,
  hashtags: 15,
} as const;

export function isCarouselPlanCode(value: unknown): value is CarouselPlanCode {
  return typeof value === "string" && (CAROUSEL_PLAN_CODES as readonly string[]).includes(value);
}

export function getCarouselPlan(code: CarouselPlanCode): CarouselPlanDefinition {
  return CAROUSEL_PLAN_DEFINITIONS[code];
}

export function listCarouselPlans(): CarouselPlanDefinition[] {
  return CAROUSEL_PLAN_CODES.map((code) => CAROUSEL_PLAN_DEFINITIONS[code]).sort((a, b) => a.rank - b.rank);
}

/** Preço com desconto (centavos, arredondado ao centavo mais próximo). */
export function discountedPriceCents(priceCents: number, percent: number): number {
  const clamped = Math.min(100, Math.max(0, percent));
  return Math.round((priceCents * (100 - clamped)) / 100);
}

export interface CarouselPrice {
  listPriceCents: number;
  priceCents: number;
  discountPercent: number;
}

/** Preço final do plano; `existingCustomer` é decidido SEMPRE no servidor. */
export function carouselPriceFor(code: CarouselPlanCode, existingCustomer: boolean): CarouselPrice {
  const listPriceCents = CAROUSEL_PLAN_DEFINITIONS[code].priceCents;
  const discountPercent = existingCustomer ? EXISTING_CUSTOMER_DISCOUNT_PERCENT : 0;
  return { listPriceCents, priceCents: discountedPriceCents(listPriceCents, discountPercent), discountPercent };
}

/** Normaliza o e-mail para a chave do teste grátis (sem pontos nem +tag no Gmail; minúsculas). */
export function trialEmailKey(email: string): string {
  const [rawLocal = "", rawDomain = ""] = email.trim().toLowerCase().split("@");
  const domain = rawDomain === "googlemail.com" ? "gmail.com" : rawDomain;
  let local = rawLocal.split("+")[0];
  if (domain === "gmail.com") local = local.replace(/\./g, "");
  return `${local}@${domain}`;
}
