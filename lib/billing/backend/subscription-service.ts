import "server-only";
import {
  getSubscriptionByUserId,
  saveCheckoutStart,
  markCanceled,
  markReactivated,
} from "./automation-subscription-repository";
import {
  createAsaasCustomer,
  createAsaasSubscription,
  cancelAsaasSubscription,
  listAsaasSubscriptionPayments,
} from "./asaas-client";
import { MONTHLY_PRICE_CENTS, SubscriptionBusinessError, type AutomationSubscriptionRecord } from "./billing-types";

/**
 * Orquestra o checkout e o cancelamento da assinatura do Piloto
 * Automático — a ÚNICA camada que fala com o Asaas para essas duas
 * ações (nunca direto de uma rota de API). Nunca libera acesso sozinha:
 * criar a assinatura no Asaas só deixa o status local como
 * PENDING_PAYMENT — quem libera de verdade é o processamento do Webhook
 * (asaas-webhook-service.ts), depois da confirmação de pagamento.
 */

export interface StartCheckoutInput {
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

  const existing = await getSubscriptionByUserId(userId);
  if (existing?.status === "ACTIVE") {
    throw new SubscriptionBusinessError("Você já tem uma assinatura ativa do Piloto Automático.");
  }

  const asaasCustomerId =
    existing?.asaasCustomerId ??
    (await createAsaasCustomer({ name: input.name, cpfCnpj, email: input.email })).id;

  const reuseExistingSubscription = existing?.status === "PENDING_PAYMENT" && Boolean(existing.asaasSubscriptionId);
  const asaasSubscriptionId = reuseExistingSubscription
    ? (existing!.asaasSubscriptionId as string)
    : (
        await createAsaasSubscription({
          customerId: asaasCustomerId,
          value: MONTHLY_PRICE_CENTS / 100,
          nextDueDate: todayDateStr(now),
          description: "Alilu - Postagens Automáticas com IA",
          // Referência estável de volta ao nosso sistema — o webhook já acha a
          // linha certa pelo asaas_subscription_id, isso é redundância extra.
          externalReference: userId,
        })
      ).id;

  const subscription = await saveCheckoutStart(userId, {
    cpfCnpj,
    asaasCustomerId,
    asaasSubscriptionId,
    monthlyPriceCents: MONTHLY_PRICE_CENTS,
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
    value: MONTHLY_PRICE_CENTS / 100,
    nextDueDate: firstDueDate,
    description: "Alilu - Postagens Automáticas com IA",
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
