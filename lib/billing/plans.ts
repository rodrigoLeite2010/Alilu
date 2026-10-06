/**
 * Catálogo ÚNICO de planos do Alilu — preços, limites e o que cada plano
 * inclui. Importável pelo servidor e pelo navegador (só dados e funções
 * puras). Nunca escreva um preço ou limite em outro lugar: telas, textos
 * de aviso, criação da cobrança no Asaas e as regras do servidor leem
 * daqui.
 *
 * Modelo comercial:
 *   ASSINATURA = publicação automática (Piloto Automático) e, nos planos
 *   com IA, geração de texto/legenda com IA dentro de uma franquia por ciclo.
 *   CRÉDITOS   = IA cara e de custo variável (hoje: vídeo com IA).
 *
 *   Grátis (teste)  7 dias, até 3 publicações automáticas por dia, com IA.
 *   AUTOMATION      R$ 19,00/mês — Piloto Automático com conteúdo MANUAL, sem IA, sem limite.
 *   CREATOR         R$ 24,90/mês — IA: 90 publicações por ciclo (referência de 3 por dia).
 *   PRO             R$ 49,90/mês — IA: 300 publicações por ciclo (referência de 10 por dia).
 *   Importador de Instagram: só planos pagos (os três acima).
 *   Publicar/agendar manualmente (fora do Piloto), Stories e Reels manuais: gratuitos.
 *
 * Mudar um número aqui muda a regra no sistema inteiro.
 */

export type PlanCode = "AUTOMATION" | "CREATOR" | "PRO";

export const PLAN_CODES: readonly PlanCode[] = ["AUTOMATION", "CREATOR", "PRO"];

export interface PlanDefinition {
  code: PlanCode;
  name: string;
  /** Em centavos (mesmo padrão do resto do projeto). */
  priceCents: number;
  /** O plano libera geração com IA (texto/legenda do Piloto e botão de IA do compositor)? */
  includesAi: boolean;
  /** Franquia de publicações com IA por ciclo de cobrança; `null` = plano sem IA. */
  aiPostsPerCycle: number | null;
  /** Ritmo de referência por dia (só aviso — o bloqueio é pelo ciclo); `null` = plano sem IA. */
  aiDailyReference: number | null;
  /** Importador de Instagram liberado? (todos os planos pagos) */
  includesImporter: boolean;
  /** Ordem de "tamanho" do plano — upgrade = ordem maior, downgrade = menor. */
  rank: number;
  /** Itens para a tela de planos (sem inventar nada que não exista). */
  features: readonly string[];
  /** Diferenciais planejados que AINDA NÃO existem — a tela só pode mostrar como "em breve". */
  upcoming: readonly string[];
}

export const PLAN_DEFINITIONS: Record<PlanCode, PlanDefinition> = {
  AUTOMATION: {
    code: "AUTOMATION",
    name: "Automático",
    priceCents: 1900,
    includesAi: false,
    aiPostsPerCycle: null,
    aiDailyReference: null,
    includesImporter: true,
    rank: 1,
    features: [
      "Piloto Automático com o seu texto, sem limite de publicações",
      "Posts, carrosséis, Stories e Reels agendados",
      "Importador de Instagram",
    ],
    upcoming: [],
  },
  CREATOR: {
    code: "CREATOR",
    name: "Criador",
    priceCents: 2490,
    includesAi: true,
    aiPostsPerCycle: 90,
    aiDailyReference: 3,
    includesImporter: true,
    rank: 2,
    features: [
      "Tudo do plano Automático",
      "Textos, legendas e hashtags com IA",
      "90 publicações com IA por ciclo (cerca de 3 por dia)",
    ],
    upcoming: [],
  },
  PRO: {
    code: "PRO",
    name: "Pro",
    priceCents: 4990,
    includesAi: true,
    aiPostsPerCycle: 300,
    aiDailyReference: 10,
    includesImporter: true,
    rank: 3,
    features: [
      "Tudo do plano Criador",
      "300 publicações com IA por ciclo (cerca de 10 por dia)",
    ],
    // Só "em breve": nenhum destes diferenciais existe hoje no produto.
    upcoming: ["Mais de uma conta do Instagram", "Automações avançadas", "Maior histórico", "Prioridade no atendimento"],
  },
};

/** Teste gratuito: começa na primeira publicação automática de verdade (nunca ao abrir a tela). */
export const FREE_TRIAL = {
  days: 7,
  dailyLimit: 3,
  /** O teste libera IA (dentro do limite diário). */
  includesAi: true,
  /** O importador NÃO faz parte do teste — só planos pagos. */
  includesImporter: false,
} as const;

/**
 * Teto de legendas avulsas geradas pelo botão de IA do compositor por dia
 * (o botão não consome a franquia de publicações — só o Piloto consome —,
 * mas precisa de um teto para não virar IA ilimitada de graça).
 */
export const AI_CAPTION_DAILY_CAP = 50;

/** Aviso de franquia quando o uso do ciclo chega a esta fração do limite. */
export const PLAN_USAGE_WARNING_RATIO = 0.8;

export function isPlanCode(value: unknown): value is PlanCode {
  return typeof value === "string" && (PLAN_CODES as readonly string[]).includes(value);
}

export function getPlan(code: PlanCode): PlanDefinition {
  return PLAN_DEFINITIONS[code];
}

/** Todos os planos pagos, do menor para o maior. */
export function listPlans(): PlanDefinition[] {
  return [...PLAN_CODES].map((code) => PLAN_DEFINITIONS[code]).sort((a, b) => a.rank - b.rank);
}

/** Menor plano pago que inclui IA — é o que as mensagens de "faça upgrade" oferecem. */
export function cheapestAiPlan(): PlanDefinition {
  return listPlans().find((plan) => plan.includesAi) ?? PLAN_DEFINITIONS.CREATOR;
}

export function formatPriceBrl(priceCents: number): string {
  return (priceCents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
