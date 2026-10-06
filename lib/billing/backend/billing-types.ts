/**
 * Tipos e constantes da monetização do Piloto Automático de Conteúdo —
 * SOMENTE essa funcionalidade é paga; o resto do Alilu continua
 * gratuito (ver automation-access-service.ts, o único ponto do cron que
 * consulta este módulo).
 *
 * Espelham o CHECK de status da migração db/migrations/0017_automation_
 * billing.sql — qualquer novo valor precisa ser adicionado nos dois
 * lugares.
 */

import { FREE_TRIAL, PLAN_DEFINITIONS, type PlanCode } from "../plans";

export type AutomationSubscriptionStatus =
  | "TRIAL"
  | "PENDING_PAYMENT"
  | "ACTIVE"
  | "PAST_DUE"
  | "CANCELED"
  | "EXPIRED";

/**
 * Regras de negócio configuráveis (nunca espalhar estes números pelo
 * código — importar sempre daqui). Mudar um valor aqui muda a regra em
 * todo o sistema (serviço de acesso, tela do Piloto, criação da
 * assinatura no Asaas).
 */
export const TRIAL_DAYS = FREE_TRIAL.days;
export const TRIAL_DAILY_LIMIT = FREE_TRIAL.dailyLimit;
/** Em centavos — preço do plano AUTOMATION (R$ 19,00). Os demais planos e limites vivem em ../plans.ts. */
export const MONTHLY_PRICE_CENTS = PLAN_DEFINITIONS.AUTOMATION.priceCents;

export interface AutomationSubscriptionRecord {
  id: string;
  userId: string;
  status: AutomationSubscriptionStatus;
  trialStartedAt: Date | null;
  trialEndsAt: Date | null;
  /** "YYYY-MM-DD" — a que dia civil `trialUsageCount` se refere. */
  trialUsageDate: string | null;
  trialUsageCount: number;
  asaasCustomerId: string | null;
  asaasSubscriptionId: string | null;
  /** Só dígitos — coletado uma vez no checkout (o Asaas exige para criar o customer). */
  cpfCnpj: string | null;
  monthlyPriceCents: number;
  /** Plano contratado (só vale quando a assinatura está paga; durante o teste não tem efeito). */
  planCode: PlanCode;
  /** Troca de plano agendada para o próximo ciclo (downgrade), ou `null`. */
  pendingPlanCode: PlanCode | null;
  startedAt: Date | null;
  currentPeriodEndsAt: Date | null;
  canceledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Resultado de `AutomationAccessService.canUseAutomation` — o que a tela
 * do Piloto Automático precisa para se desenhar (banner de trial, aviso
 * de limite, tela de "assine para continuar") sem reimplementar a regra
 * de negócio no frontend.
 */
export interface AutomationAccessResult {
  allowed: boolean;
  /** "NEW" = usuário nunca usou o Piloto ainda — o trial começaria agora, na próxima utilização real. */
  status: AutomationSubscriptionStatus | "NEW" | "EXEMPT";
  reason: string | null;
  trialEndsAt: Date | null;
  /** `null` quando a assinatura está ACTIVE (sem limite diário nesse caso). */
  remainingToday: number | null;
  currentPeriodEndsAt: Date | null;
  /** Por que foi negado (`null` quando permitido) — a tela escolhe o aviso/botão por aqui. */
  code: AccessDenialCode | null;
}

/**
 * Por que um recurso pago foi negado — a tela escolhe o aviso/botão por
 * este código (nunca pela mensagem). `LOGIN_REQUIRED` é devolvido pelas
 * rotas de API quando não há sessão.
 */
export type AccessDenialCode =
  | "LOGIN_REQUIRED"
  | "SUBSCRIPTION_REQUIRED"
  | "TRIAL_ENDED"
  | "TRIAL_DAILY_LIMIT"
  | "PAYMENT_PENDING"
  | "PAYMENT_OVERDUE"
  | "AI_PLAN_REQUIRED"
  | "PLAN_LIMIT_REACHED"
  | "AI_DAILY_CAP"
  | "PAID_PLAN_REQUIRED";

/** Lançado pelo AutomationAccessService quando o uso não é permitido — o cron nunca chama a IA depois disso. */
export class SubscriptionRequiredError extends Error {
  code: AccessDenialCode;
  constructor(message: string, code: AccessDenialCode = "SUBSCRIPTION_REQUIRED") {
    super(message);
    this.name = "SubscriptionRequiredError";
    this.code = code;
  }
}

/** Erro de negócio do checkout/cancelamento (CPF inválido, já tem assinatura ativa, nada para cancelar, etc.) — mensagem já pronta para mostrar ao usuário. */
export class SubscriptionBusinessError extends Error {}
