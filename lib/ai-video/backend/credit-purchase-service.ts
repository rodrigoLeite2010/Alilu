import "server-only";
import {
  createAsaasCustomer,
  createAsaasPayment,
  refundAsaasPayment,
  AsaasApiError,
  type AsaasPayment,
} from "@/lib/billing/backend/asaas-client";
import { SITE_URL } from "@/lib/seo/site";
import { getBillingCustomer, saveBillingCustomer } from "@/lib/billing/backend/billing-customer-repository";
import { getSubscriptionByUserId } from "@/lib/billing/backend/automation-subscription-repository";
import { analyzePackage, worstCostPerCredit } from "../pricing";
import { getActivePricingConfig, getPackageByCode, listModelPricing } from "./pricing-repository";
import { applyWalletMovement, debitUpToAvailable } from "./wallet-repository";
import {
  attachAsaasPayment,
  findReusablePendingPurchase,
  getPurchaseByAsaasPaymentId,
  getPurchaseForUser,
  insertPurchase,
  transitionPurchase,
  type CreditPurchaseRecord,
} from "./credit-purchase-repository";

/**
 * Compra de créditos Alilu via Asaas (pré-pago).
 *
 *   escolher pacote → cobrança avulsa no Asaas → pessoa paga →
 *   Webhook CONFIRMED/RECEIVED (validado e consultado de volta no Asaas) →
 *   compra PAID + lançamento PURCHASE (uma única vez) → saldo aumenta.
 *
 * Créditos NUNCA entram porque o checkout foi criado, porque a pessoa
 * voltou da página de pagamento ou porque o front disse que pagou.
 * Créditos são direito de uso: sem saque, transferência ou conversão em
 * dinheiro — a única volta é o reembolso da compra (créditos ainda não
 * usados, dentro do prazo de arrependimento).
 */

export class CreditPurchaseError extends Error {
  constructor(message: string, readonly httpStatus = 400) {
    super(message);
    this.name = "CreditPurchaseError";
  }
}

function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

function dueDateStr(now: Date): string {
  // Vencimento amanhã: dá tempo do boleto/Pix sem deixar a cobrança aberta por muito tempo.
  return new Date(now.getTime() + 24 * 3600_000).toISOString().slice(0, 10);
}

export interface StartCreditCheckoutInput {
  packageCode: string;
  name: string;
  cpfCnpj: string;
  email?: string;
  /** Caminho interno para onde voltar depois de pagar (ex.: a tela de geração). Já validado na rota. */
  returnTo?: string | null;
  /** Custo da geração que trouxe a pessoa até aqui. */
  requiredCredits?: number | null;
}

/** Página do Alilu para onde o Asaas manda a pessoa depois de pagar. */
export function buildCreditSuccessUrl(purchaseId: string, returnTo?: string | null, requiredCredits?: number | null): string {
  const params = new URLSearchParams({ pagamento: purchaseId });
  if (returnTo && returnTo.startsWith("/") && !returnTo.startsWith("//")) params.set("voltar", returnTo);
  if (requiredCredits && requiredCredits > 0) params.set("custo", String(Math.round(requiredCredits)));
  return `${SITE_URL.replace(/\/$/, "")}/minha-conta/creditos-ia?${params}`;
}

async function resolveAsaasCustomerId(userId: string, input: StartCreditCheckoutInput): Promise<string> {
  const existing = await getBillingCustomer(userId);
  if (existing) return existing.asaasCustomerId;

  // Já é cliente pela assinatura do Piloto? Reaproveita (nunca duplica o cliente no Asaas).
  const subscription = await getSubscriptionByUserId(userId);
  if (subscription?.asaasCustomerId && subscription.cpfCnpj) {
    await saveBillingCustomer({ userId, asaasCustomerId: subscription.asaasCustomerId, cpfCnpj: subscription.cpfCnpj });
    return subscription.asaasCustomerId;
  }

  const cpfCnpj = onlyDigits(input.cpfCnpj ?? "");
  if (cpfCnpj.length !== 11 && cpfCnpj.length !== 14) throw new CreditPurchaseError("CPF ou CNPJ inválido.");
  if (!input.name?.trim()) throw new CreditPurchaseError("Informe o nome completo.");
  const customer = await createAsaasCustomer({ name: input.name.trim(), cpfCnpj, email: input.email?.trim() || undefined });
  await saveBillingCustomer({ userId, asaasCustomerId: customer.id, cpfCnpj });
  return customer.id;
}

/** Já existe cliente Asaas para este usuário? (a tela só pede nome/CPF quando não existe) */
export async function hasBillingCustomer(userId: string): Promise<boolean> {
  if (await getBillingCustomer(userId)) return true;
  const subscription = await getSubscriptionByUserId(userId);
  return Boolean(subscription?.asaasCustomerId && subscription.cpfCnpj);
}

export async function startCreditCheckout(
  userId: string,
  input: StartCreditCheckoutInput,
  now: Date = new Date(),
): Promise<{ checkoutUrl: string; purchaseId: string }> {
  const pkg = await getPackageByCode(String(input.packageCode ?? ""));
  if (!pkg || !pkg.isActive) throw new CreditPurchaseError("Pacote indisponível.");

  // Nunca vende um pacote abaixo da margem mínima (preço ou custo mudou e o admin ainda não ajustou).
  const config = await getActivePricingConfig();
  const analysis = analyzePackage(config, pkg, worstCostPerCredit(config, await listModelPricing()));
  if (analysis.belowMinimum) {
    console.error("[ai-video] pacote abaixo da margem mínima bloqueado", { packageCode: pkg.code, marginPct: analysis.worstCaseMarginPct });
    throw new CreditPurchaseError("Este pacote está temporariamente indisponível.", 503);
  }

  const reusable = await findReusablePendingPurchase(userId, pkg.id, new Date(now.getTime() - 24 * 3600_000));
  if (reusable?.invoiceUrl) return { checkoutUrl: reusable.invoiceUrl, purchaseId: reusable.id };

  const customerId = await resolveAsaasCustomerId(userId, input);
  const purchase = await insertPurchase({
    userId,
    packageId: pkg.id,
    packageName: pkg.name,
    credits: pkg.credits,
    bonusCredits: pkg.bonusCredits,
    priceCents: pkg.priceCents,
  });
  const paymentInput = {
    customerId,
    value: pkg.priceCents / 100,
    dueDate: dueDateStr(now),
    description: `Alilu - ${pkg.credits + pkg.bonusCredits} créditos de IA (${pkg.name})`,
    externalReference: purchase.id,
  };
  let payment;
  try {
    payment = await createAsaasPayment({
      ...paymentInput,
      callback: { successUrl: buildCreditSuccessUrl(purchase.id, input.returnTo, input.requiredCredits), autoRedirect: true },
    });
  } catch (error) {
    // Domínio da successUrl ainda não cadastrado no Asaas (Minha Conta › Informações):
    // não trava a venda — cria sem o retorno automático e avisa no log.
    if (!(error instanceof AsaasApiError) || error.status !== 400) throw error;
    console.warn("[ai-video] Asaas recusou o callback de retorno; criando cobrança sem redirecionamento", {
      purchaseId: purchase.id,
      message: error.message.slice(0, 200),
    });
    payment = await createAsaasPayment(paymentInput);
  }
  await attachAsaasPayment(purchase.id, payment.id, payment.invoiceUrl);
  if (!payment.invoiceUrl) throw new CreditPurchaseError("Não foi possível gerar o link de pagamento agora. Tente novamente.", 502);

  console.info("[ai-video] checkout de créditos criado", { userId, purchaseId: purchase.id, packageCode: pkg.code, asaasPaymentId: payment.id });
  return { checkoutUrl: payment.invoiceUrl, purchaseId: purchase.id };
}

const PAID_PAYMENT_STATUSES = new Set(["CONFIRMED", "RECEIVED", "RECEIVED_IN_CASH"]);

async function creditPurchase(purchase: CreditPurchaseRecord): Promise<void> {
  const total = purchase.credits + purchase.bonusCredits;
  await applyWalletMovement({
    userId: purchase.userId,
    type: "PURCHASE",
    availableDelta: total,
    reservedDelta: 0,
    referenceType: "ai_credit_purchase",
    referenceId: purchase.id,
    description: `Compra — pacote ${purchase.packageName}`,
  });
}

/**
 * Evento de pagamento do Webhook (já autenticado e com o pagamento
 * consultado de volta no Asaas) de uma cobrança SEM assinatura. Devolve
 * `false` se o pagamento não é de uma compra de créditos.
 */
export async function handleCreditPurchasePaymentEvent(eventType: string, payment: AsaasPayment, now: Date = new Date()): Promise<boolean> {
  const purchase = await getPurchaseByAsaasPaymentId(payment.id);
  if (!purchase) return false;

  if (eventType === "PAYMENT_CONFIRMED" || eventType === "PAYMENT_RECEIVED") {
    if (!PAID_PAYMENT_STATUSES.has(payment.status)) return true; // o Asaas não confirma o que o evento diz — ignora.
    await transitionPurchase(purchase.id, ["PENDING", "CANCELED"], "PAID", now);
    const current = (await getPurchaseByAsaasPaymentId(payment.id))!;
    // Idempotente pela referência: reentrega do webhook ou PAYMENT_RECEIVED depois de
    // PAYMENT_CONFIRMED nunca creditam duas vezes.
    if (current.status === "PAID") await creditPurchase(current);
    console.info("[ai-video] compra de créditos confirmada", { purchaseId: purchase.id, userId: purchase.userId, credits: purchase.credits + purchase.bonusCredits });
    return true;
  }

  if (eventType === "PAYMENT_DELETED") {
    await transitionPurchase(purchase.id, ["PENDING"], "CANCELED", now);
    return true;
  }

  if (eventType === "PAYMENT_REFUNDED" || eventType === "PAYMENT_CHARGEBACK_REQUESTED") {
    const isChargeback = eventType === "PAYMENT_CHARGEBACK_REQUESTED";
    const moved = await transitionPurchase(purchase.id, ["PAID"], isChargeback ? "CHARGEBACK" : "REFUNDED", now);
    if (moved || purchase.status === "REFUNDED" || purchase.status === "CHARGEBACK") {
      const result = await debitUpToAvailable({
        userId: purchase.userId,
        type: isChargeback ? "CHARGEBACK" : "PURCHASE_REFUND",
        credits: purchase.credits + purchase.bonusCredits,
        referenceType: "ai_credit_purchase",
        referenceId: purchase.id,
        description: isChargeback ? `Contestação — pacote ${purchase.packageName}` : `Reembolso — pacote ${purchase.packageName}`,
      });
      if (result.unrecovered > 0) {
        console.error("[ai-video] estorno/chargeback com créditos já usados", { purchaseId: purchase.id, userId: purchase.userId, unrecovered: result.unrecovered });
      }
    }
    return true;
  }

  return true;
}

/**
 * Reembolso pedido pelo usuário (direito de arrependimento): só compra
 * paga, dentro do prazo configurado e com TODOS os créditos dela ainda
 * disponíveis (nenhum usado). Os créditos saem PRIMEIRO (atômico — não dá
 * para gastá-los durante o estorno); se o Asaas recusar o estorno, eles
 * voltam.
 */
export async function requestPurchaseRefund(userId: string, purchaseId: string, now: Date = new Date()): Promise<CreditPurchaseRecord> {
  const purchase = await getPurchaseForUser(purchaseId, userId);
  if (!purchase || purchase.status !== "PAID" || !purchase.asaasPaymentId || !purchase.paidAt) {
    throw new CreditPurchaseError("Esta compra não pode ser reembolsada.");
  }
  const config = await getActivePricingConfig();
  if (now.getTime() - purchase.paidAt.getTime() > config.purchaseRefundWindowDays * 24 * 3600_000) {
    throw new CreditPurchaseError(`O prazo de reembolso (${config.purchaseRefundWindowDays} dias) desta compra terminou.`);
  }

  const total = purchase.credits + purchase.bonusCredits;
  const debit = await applyWalletMovement({
    userId,
    type: "PURCHASE_REFUND",
    availableDelta: -total,
    reservedDelta: 0,
    referenceType: "ai_credit_purchase",
    referenceId: purchase.id,
    description: `Reembolso — pacote ${purchase.packageName}`,
  });
  if (debit.status === "insufficient") {
    throw new CreditPurchaseError("Só é possível reembolsar uma compra cujos créditos ainda não foram usados.");
  }
  if (debit.status === "duplicate") {
    // Pedido repetido (clique duplo) ou tentativa anterior que o Asaas recusou: não estorna de novo.
    const current = (await getPurchaseForUser(purchaseId, userId))!;
    if (current.status === "PAID") {
      throw new CreditPurchaseError("O reembolso desta compra já foi solicitado. Se ele não for concluído, fale com o suporte.", 409);
    }
    return current;
  }

  try {
    await refundAsaasPayment(purchase.asaasPaymentId);
  } catch (error) {
    await applyWalletMovement({
      userId,
      type: "ADMIN_ADJUSTMENT",
      availableDelta: total,
      reservedDelta: 0,
      referenceType: "ai_credit_purchase_refund_rollback",
      referenceId: purchase.id,
      description: "Estorno recusado pelo meio de pagamento — créditos devolvidos",
    });
    console.error("[ai-video] estorno recusado pelo Asaas", { purchaseId, message: (error as Error)?.message });
    throw new CreditPurchaseError(
      "Não foi possível estornar automaticamente (pagamentos por boleto, por exemplo, precisam de atendimento). Fale com o suporte.",
      502,
    );
  }
  return (await transitionPurchase(purchase.id, ["PAID"], "REFUNDED", now)) ?? purchase;
}
