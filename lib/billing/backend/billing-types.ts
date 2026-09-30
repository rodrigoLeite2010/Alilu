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
export const TRIAL_DAYS = 7;
export const TRIAL_DAILY_LIMIT = 3;
/** Em centavos (mesmo padrão de fin_debts/fin_goals neste projeto) — R$ 19,00. */
export const MONTHLY_PRICE_CENTS = 1900;

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
  status: AutomationSubscriptionStatus | "NEW";
  reason: string | null;
  trialEndsAt: Date | null;
  /** `null` quando a assinatura está ACTIVE (sem limite diário nesse caso). */
  remainingToday: number | null;
  currentPeriodEndsAt: Date | null;
}

/** Lançado pelo AutomationAccessService quando o uso não é permitido — o cron nunca chama a IA depois disso. */
export class SubscriptionRequiredError extends Error {}

/** Erro de negócio do checkout/cancelamento (CPF inválido, já tem assinatura ativa, nada para cancelar, etc.) — mensagem já pronta para mostrar ao usuário. */
export class SubscriptionBusinessError extends Error {}
