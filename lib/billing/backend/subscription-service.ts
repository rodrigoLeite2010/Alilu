import "server-only";
import {
  getSubscriptionByUserId,
  saveCheckoutStart,
  markCanceled,
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
