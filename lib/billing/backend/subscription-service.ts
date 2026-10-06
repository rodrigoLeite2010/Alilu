import "server-only";
import {
  getSubscriptionByUserId,
  saveCheckoutStart,
  markCanceled,
  markReactivated,
  setPendingPlan,
} from "./automation-subscription-repository";
import {
  createAsaasCustomer,
  createAsaasSubscription,
  cancelAsaasSubscription,
  listAsaasSubscriptionPayments,
  createAsaasPayment,
  updateAsaasSubscriptionValue,
} from "./asaas-client";
import { SubscriptionBusinessError, type AutomationSubscriptionRecord } from "./billing-types";
import { getPlan, formatPriceBrl, type PlanCode } from "../plans";

/**
 * Orquestra o checkout e o cancelamento da assinatura do Piloto
 * Automático — a ÚNICA camada que fala com o Asaas para essas duas
 * ações (nunca direto de uma rota de API). Nunca libera acesso sozinha:
 * criar a assinatura no Asaas só deixa o status local como
 * PENDING_PAYMENT — quem libera de verdade é o processamento do Webhook
 * (asaas-webhook-service.ts), depois da confirmação de pagamento.
 */

/** Prefixo da referência das cobranças proporcionais de upgrade (lido pelo webhook). */
export const PLAN_UPGRADE_REFERENCE_PREFIX = "plan-upgrade:";
/** Menor cobrança que o Asaas aceita (R$ 5,00). */
export const MIN_CHARGE_CENTS = 500;
const BILLING_CYCLE_DAYS = 30;

export function planUpgradeReference(userId: string, planCode: PlanCode): string {
  return `${PLAN_UPGRADE_REFERENCE_PREFIX}${userId}:${planCode}`;
}

/** Lê "plan-upgrade:<userId>:<PLANO>" — `null` se não for uma cobrança de upgrade. */
export function parsePlanUpgradeReference(ref: string | null): { userId: string; planCode: PlanCode } | null {
  if (!ref || !ref.startsWith(PLAN_UPGRADE_REFERENCE_PREFIX)) return null;
  const rest = ref.slice(PLAN_UPGRADE_REFERENCE_PREFIX.length);
  const idx = rest.lastIndexOf(":");
  if (idx <= 0) return null;
  const planCode = rest.slice(idx + 1);
  if (planCode !== "AUTOMATION" && planCode !== "CREATOR" && planCode !== "PRO") return null;
  return { userId: rest.slice(0, idx), planCode };
}

/**
 * Valor do upgrade: a diferença de preço proporcional aos dias que faltam
 * para o fim do período já pago (ciclo de 30 dias), nunca menos que o
 * mínimo do Asaas. O ciclo seguinte já vem no preço do plano novo.
 */
export function computeUpgradeProrationCents(
  currentPriceCents: number,
  newPriceCents: number,
  periodEndsAt: Date,
  now: Date,
): number {
  const msLeft = Math.max(0, periodEndsAt.getTime() - now.getTime());
  const daysLeft = Math.min(BILLING_CYCLE_DAYS, Math.max(1, Math.ceil(msLeft / 86_400_000)));
  const raw = Math.round(((newPriceCents - currentPriceCents) * daysLeft) / BILLING_CYCLE_DAYS);
  return Math.max(MIN_CHARGE_CENTS, raw);
}

export interface StartCheckoutInput {
  /** Plano que está sendo contratado. */
  planCode: PlanCode;
  name: string;
  /** Com ou sem pontuação — normalizado aqui antes de ir para o Asaas. */
  cpfCnpj: string;
  email?: string;
}

export interface CheckoutResult {
  /** Link do checkout hospedado do Asaas — para onde o usuário deve ser redirecionado para escolher Pix/Boleto/Cartão. */
  checkoutUrl: string;
  subscription: AutomationSubscriptionRecord;
}

function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

function todayDateStr(now: Date): string {
  return now.toISOString().slice(0, 10);
}

/**
 * Inicia (ou retoma) o checkout da assinatura. Reaproveita o
 * AsaasCustomerId já existente em vez de duplicar o cliente no Asaas; se
 * já existe uma assinatura PENDING_PAYMENT (a pessoa clicou duas vezes,
 * ou voltou sem pagar), reaproveita a mesma assinatura do Asaas em vez
 * de criar outra.
 */
export async function startAutomationCheckout(
  userId: string,
  input: StartCheckoutInput,
  now: Date = new Date(),
): Promise<CheckoutResult> {
  const cpfCnpj = onlyDigits(input.cpfCnpj);
  if (cpfCnpj.length !== 11 && cpfCnpj.length !== 14) {
    throw new SubscriptionBusinessError("CPF ou CNPJ inválido.");
  }

  const plan = getPlan(input.planCode);
  const existing = await getSubscriptionByUserId(userId);
  if (existing?.status === "ACTIVE") {
    throw new SubscriptionBusinessError(
      existing.complimentary
        ? `Você tem um plano de cortesia ativo${existing.currentPeriodEndsAt ? ` até ${existing.currentPeriodEndsAt.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}` : ""}. Assine quando ele terminar.`
        : "Você já tem uma assinatura ativa. Para mudar de plano, use a opção de trocar de plano.",
    );
  }

  const asaasCustomerId =
    existing?.asaasCustomerId ??
    (await createAsaasCustomer({ name: input.name, cpfCnpj, email: input.email })).id;

  // Reaproveita a cobrança pendente só se for do MESMO plano; se a pessoa
  // trocou de ideia (ex.: de R$ 19 para o Criador), cancela a pendente
  // para não deixar duas assinaturas abertas no Asaas.
  const canReuse =
    existing?.status === "PENDING_PAYMENT" &&
    Boolean(existing.asaasSubscriptionId) &&
    existing.planCode === plan.code &&
    existing.monthlyPriceCents === plan.priceCents;
  if (existing?.status === "PENDING_PAYMENT" && existing.asaasSubscriptionId && !canReuse) {
    await cancelAsaasSubscription(existing.asaasSubscriptionId).catch(() => undefined);
  }
  const asaasSubscriptionId = canReuse
    ? (existing!.asaasSubscriptionId as string)
    : (
        await createAsaasSubscription({
          customerId: asaasCustomerId,
          value: plan.priceCents / 100,
          nextDueDate: todayDateStr(now),
          description: `Alilu - Plano ${plan.name}`,
          // Referência estável de volta ao nosso sistema — o webhook já acha a
          // linha certa pelo asaas_subscription_id, isso é redundância extra.
          externalReference: userId,
        })
      ).id;

  const subscription = await saveCheckoutStart(userId, {
    cpfCnpj,
    asaasCustomerId,
    asaasSubscriptionId,
    monthlyPriceCents: plan.priceCents,
    planCode: plan.code,
  });

  const payments = await listAsaasSubscriptionPayments(asaasSubscriptionId);
  const checkoutUrl = payments[0]?.invoiceUrl;
  if (!checkoutUrl) {
    throw new SubscriptionBusinessError(
      "Não foi possível gerar o link de pagamento agora. Tente novamente em instantes.",
    );
  }

  return { checkoutUrl, subscription };
}

/**
 * Cancela a assinatura: para novas cobranças no Asaas primeiro, só
 * depois marca localmente (nunca o contrário — evitaria cancelar aqui
 * enquanto o Asaas continua cobrando). O acesso ao Piloto continua até
 * current_period_ends_at (o fim do período já pago) — ver
 * AutomationAccessService, que já trata o status CANCELED dessa forma.
 */
export async function cancelAutomationSubscription(
  userId: string,
  now: Date = new Date(),
): Promise<AutomationSubscriptionRecord> {
  const existing = await getSubscriptionByUserId(userId);
  if (!existing || !existing.asaasSubscriptionId) {
    throw new SubscriptionBusinessError("Você não tem uma assinatura para cancelar.");
  }
  if (existing.status === "CANCELED" || existing.status === "EXPIRED") {
    throw new SubscriptionBusinessError("Essa assinatura já está cancelada.");
  }

  await cancelAsaasSubscription(existing.asaasSubscriptionId);

  const updated = await markCanceled(userId, now);
  if (!updated) {
    throw new SubscriptionBusinessError("Não foi possível registrar o cancelamento. Tente novamente.");
  }
  return updated;
}

/**
 * Reativa uma assinatura cancelada que ainda está dentro do período já
 * pago — sem cobrar nada agora e sem cortar o acesso. A assinatura antiga
 * foi removida no Asaas (DELETE /subscriptions/{id} não tem volta), então
 * criamos uma NOVA para o mesmo cliente, com a 1ª cobrança marcada para o
 * dia em que o período pago termina (current_period_ends_at). Assim o
 * usuário não paga duas vezes pelo mesmo mês.
 *
 * Diferente do checkout, aqui o status vai direto para ACTIVE: o acesso
 * até current_period_ends_at já foi pago e confirmado por Webhook antes do
 * cancelamento. Se a cobrança nova não for paga no vencimento, o Webhook
 * PAYMENT_OVERDUE bloqueia normalmente (PAST_DUE).
 *
 * Período pago já acabou → não é reativação: o usuário usa o checkout
 * normal ("Assinar por R$ 19/mês"), que cobra na hora.
 */
export async function reactivateAutomationSubscription(
  userId: string,
  now: Date = new Date(),
): Promise<AutomationSubscriptionRecord> {
  const existing = await getSubscriptionByUserId(userId);
  if (!existing || existing.status !== "CANCELED") {
    throw new SubscriptionBusinessError("Não há assinatura cancelada para reativar.");
  }
  if (!existing.currentPeriodEndsAt || existing.currentPeriodEndsAt <= now) {
    throw new SubscriptionBusinessError(
      "O período já pago terminou. Assine novamente para continuar usando o Piloto Automático.",
    );
  }
  if (!existing.asaasCustomerId) {
    throw new SubscriptionBusinessError(
      "Não foi possível reativar automaticamente. Assine novamente para continuar.",
    );
  }

  // current_period_ends_at vem do nextDueDate do Asaas (meia-noite UTC do
  // dia da próxima cobrança) — a parte de data é exatamente esse dia.
  const nextDueDate = existing.currentPeriodEndsAt.toISOString().slice(0, 10);
  const firstDueDate = nextDueDate > todayDateStr(now) ? nextDueDate : todayDateStr(now);

  const created = await createAsaasSubscription({
    customerId: existing.asaasCustomerId,
    value: getPlan(existing.planCode).priceCents / 100,
    nextDueDate: firstDueDate,
    description: `Alilu - Plano ${getPlan(existing.planCode).name}`,
    externalReference: userId,
  });

  const updated = await markReactivated(userId, created.id, now);
  if (!updated) {
    // A linha mudou entre a leitura e a gravação (ex.: o período acabou
    // exatamente agora) — desfaz no Asaas para não deixar uma assinatura
    // órfã gerando cobrança.
    await cancelAsaasSubscription(created.id).catch(() => undefined);
    throw new SubscriptionBusinessError("Não foi possível reativar agora. Tente novamente.");
  }
  return updated;
}

export type ChangePlanResult =
  | {
      kind: "upgrade";
      /** Cobrança proporcional (Pix/Boleto/Cartão) — o plano novo só vale depois que ela for paga. */
      checkoutUrl: string;
      amountCents: number;
      subscription: AutomationSubscriptionRecord;
    }
  | { kind: "downgrade"; subscription: AutomationSubscriptionRecord };

/**
 * Troca de plano de quem já tem assinatura ACTIVE:
 *  - UPGRADE (plano maior): vale já, mas só depois de paga a diferença
 *    proporcional ao tempo que falta no ciclo — a cobrança avulsa é
 *    criada aqui e o webhook libera o plano novo ao confirmá-la. O preço
 *    da assinatura sobe para o ciclo seguinte quando o upgrade é
 *    confirmado (webhook).
 *  - DOWNGRADE (plano menor): nada muda agora (o ciclo já foi pago); o
 *    valor do próximo ciclo no Asaas cai já, e o plano troca quando o
 *    pagamento do próximo ciclo for confirmado.
 * Escolher o plano que já está em vigor com um downgrade agendado cancela
 * o agendamento.
 */
export async function changeAutomationPlan(
  userId: string,
  planCode: PlanCode,
  now: Date = new Date(),
): Promise<ChangePlanResult> {
  const existing = await getSubscriptionByUserId(userId);
  if (!existing || existing.status !== "ACTIVE" || !existing.asaasSubscriptionId || !existing.asaasCustomerId) {
    throw new SubscriptionBusinessError(
      "Você precisa ter uma assinatura ativa para trocar de plano. Escolha um plano para assinar.",
    );
  }
  const current = getPlan(existing.planCode);
  const target = getPlan(planCode);

  if (target.code === current.code) {
    if (!existing.pendingPlanCode) {
      throw new SubscriptionBusinessError(`Você já está no plano ${current.name}.`);
    }
    return { kind: "downgrade", subscription: await cancelScheduledPlanChange(userId) };
  }

  if (target.rank > current.rank) {
    if (!existing.currentPeriodEndsAt) {
      throw new SubscriptionBusinessError("Não foi possível calcular a diferença agora. Tente novamente em instantes.");
    }
    const amountCents = computeUpgradeProrationCents(
      existing.monthlyPriceCents,
      target.priceCents,
      existing.currentPeriodEndsAt,
      now,
    );
    const payment = await createAsaasPayment({
      customerId: existing.asaasCustomerId,
      value: amountCents / 100,
      dueDate: todayDateStr(now),
      description: `Alilu - Upgrade para o plano ${target.name} (diferença até ${existing.currentPeriodEndsAt
        .toISOString()
        .slice(0, 10)}, ${formatPriceBrl(amountCents)})`,
      externalReference: planUpgradeReference(userId, target.code),
    });
    if (!payment.invoiceUrl) {
      throw new SubscriptionBusinessError(
        "Não foi possível gerar o link de pagamento agora. Tente novamente em instantes.",
      );
    }
    return { kind: "upgrade", checkoutUrl: payment.invoiceUrl, amountCents, subscription: existing };
  }

  // Downgrade: o próximo ciclo já nasce no preço menor.
  await updateAsaasSubscriptionValue(existing.asaasSubscriptionId, target.priceCents / 100);
  const updated = await setPendingPlan(userId, target.code);
  if (!updated) {
    // Mudou de status no meio do caminho — volta o valor para não cobrar a menos sem trocar o plano.
    await updateAsaasSubscriptionValue(existing.asaasSubscriptionId, existing.monthlyPriceCents / 100).catch(
      () => undefined,
    );
    throw new SubscriptionBusinessError("Não foi possível agendar a troca agora. Tente novamente.");
  }
  return { kind: "downgrade", subscription: updated };
}

/** Desfaz um downgrade agendado: o plano atual segue no próximo ciclo. */
export async function cancelScheduledPlanChange(userId: string): Promise<AutomationSubscriptionRecord> {
  const existing = await getSubscriptionByUserId(userId);
  if (!existing || existing.status !== "ACTIVE" || !existing.pendingPlanCode || !existing.asaasSubscriptionId) {
    throw new SubscriptionBusinessError("Não há troca de plano agendada.");
  }
  await updateAsaasSubscriptionValue(existing.asaasSubscriptionId, existing.monthlyPriceCents / 100);
  const updated = await setPendingPlan(userId, null);
  if (!updated) throw new SubscriptionBusinessError("Não foi possível desfazer a troca agora. Tente novamente.");
  return updated;
}
