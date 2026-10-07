import "server-only";
import {
  cancelAsaasSubscription,
  createAsaasCustomer,
  createAsaasPayment,
  createAsaasSubscription,
  listAsaasSubscriptionPayments,
  updateAsaasSubscriptionValue,
} from "@/lib/billing/backend/asaas-client";
import { getSubscriptionByUserId as getAutomationSubscription } from "@/lib/billing/backend/automation-subscription-repository";
import { SubscriptionBusinessError } from "@/lib/billing/backend/billing-types";
import { computeUpgradeProrationCents } from "@/lib/billing/backend/subscription-service";
import { formatPriceBrl } from "@/lib/billing/plans";
import {
  carouselPriceFor,
  discountedPriceCents,
  getCarouselPlan,
  listCarouselPlans,
  type CarouselPlanCode,
  type CarouselPrice,
} from "../carousel-plans";
import { getCarouselAccess, isExistingAliluCustomer, type CarouselAccess } from "./carousel-access-service";
import {
  getCarouselSubscription,
  grantCarouselComplimentary,
  markCarouselCanceled,
  markCarouselReactivated,
  saveCarouselCheckoutStart,
  setCarouselPendingPlan,
  endCarouselComplimentary,
  type CarouselSubscriptionRecord,
} from "./carousel-billing-repository";

/**
 * Orquestra assinatura do Carrossel no Asaas (única camada que fala com o
 * Asaas para isso). O preço e o desconto de cliente Alilu são calculados
 * AQUI, no servidor — o navegador só informa o código do plano. Nunca libera
 * acesso por conta própria: só o webhook confirma pagamento.
 */

export const CAROUSEL_UPGRADE_REFERENCE_PREFIX = "carousel-upgrade:";
const SUBSCRIPTION_REFERENCE_PREFIX = "carousel:";

export function carouselUpgradeReference(userId: string, planCode: CarouselPlanCode): string {
  return `${CAROUSEL_UPGRADE_REFERENCE_PREFIX}${userId}:${planCode}`;
}

export function parseCarouselUpgradeReference(ref: string | null): { userId: string; planCode: CarouselPlanCode } | null {
  if (!ref || !ref.startsWith(CAROUSEL_UPGRADE_REFERENCE_PREFIX)) return null;
  const rest = ref.slice(CAROUSEL_UPGRADE_REFERENCE_PREFIX.length);
  const idx = rest.lastIndexOf(":");
  if (idx <= 0) return null;
  const code = rest.slice(idx + 1);
  if (code !== "STARTER" && code !== "PRO" && code !== "TURBO" && code !== "AGENCY") return null;
  return { userId: rest.slice(0, idx), planCode: code };
}

export function isCarouselSubscriptionReference(ref: string | null): boolean {
  return Boolean(ref && ref.startsWith(SUBSCRIPTION_REFERENCE_PREFIX));
}

const onlyDigits = (value: string): string => value.replace(/\D/g, "");
const todayStr = (now: Date): string => now.toISOString().slice(0, 10);

export interface CarouselCheckoutInput {
  planCode: CarouselPlanCode;
  name: string;
  cpfCnpj: string;
  email?: string;
}

export interface CarouselCheckoutResult {
  checkoutUrl: string;
  subscription: CarouselSubscriptionRecord;
  price: CarouselPrice;
}

export async function startCarouselCheckout(userId: string, input: CarouselCheckoutInput, now: Date = new Date()): Promise<CarouselCheckoutResult> {
  const cpfCnpj = onlyDigits(input.cpfCnpj);
  if (cpfCnpj.length !== 11 && cpfCnpj.length !== 14) throw new SubscriptionBusinessError("CPF ou CNPJ inválido.");
  const name = input.name.trim();
  if (!name) throw new SubscriptionBusinessError("Informe o nome para a cobrança.");

  const plan = getCarouselPlan(input.planCode);
  const existing = await getCarouselSubscription(userId);
  if (existing?.status === "ACTIVE" && !(existing.complimentary && (!existing.currentPeriodEndsAt || existing.currentPeriodEndsAt <= now))) {
    throw new SubscriptionBusinessError(
      existing.complimentary
        ? "Você tem um plano de cortesia ativo. Assine quando ele terminar."
        : "Você já tem uma assinatura ativa. Para mudar de plano, use a opção de trocar de plano.",
    );
  }

  // Desconto decidido no servidor (assinatura paga do Piloto em vigor), nunca pelo navegador.
  const price = carouselPriceFor(plan.code, await isExistingAliluCustomer(userId, now));

  const automation = await getAutomationSubscription(userId);
  const customerId = existing?.asaasCustomerId ?? automation?.asaasCustomerId ?? (await createAsaasCustomer({ name, cpfCnpj, email: input.email })).id;

  const canReuse =
    existing?.status === "PENDING_PAYMENT" &&
    Boolean(existing.asaasSubscriptionId) &&
    existing.planCode === plan.code &&
    existing.priceCents === price.priceCents;
  if (existing?.status === "PENDING_PAYMENT" && existing.asaasSubscriptionId && !canReuse) {
    await cancelAsaasSubscription(existing.asaasSubscriptionId).catch(() => undefined);
  }
  const asaasSubscriptionId = canReuse
    ? (existing!.asaasSubscriptionId as string)
    : (
        await createAsaasSubscription({
          customerId,
          value: price.priceCents / 100,
          nextDueDate: todayStr(now),
          description: `Alilu - Carrossel Inteligente ${plan.name}${price.discountPercent ? ` (${price.discountPercent}% cliente Alilu)` : ""}`,
          externalReference: `${SUBSCRIPTION_REFERENCE_PREFIX}${userId}`,
        })
      ).id;

  const subscription = await saveCarouselCheckoutStart(userId, {
    planCode: plan.code,
    listPriceCents: price.listPriceCents,
    priceCents: price.priceCents,
    discountPercent: price.discountPercent,
    cpfCnpj,
    asaasCustomerId: customerId,
    asaasSubscriptionId,
  });
  if (!subscription) {
    if (!canReuse) await cancelAsaasSubscription(asaasSubscriptionId).catch(() => undefined);
    throw new SubscriptionBusinessError("Não foi possível iniciar a assinatura agora. Tente novamente.");
  }

  const payments = await listAsaasSubscriptionPayments(asaasSubscriptionId);
  const checkoutUrl = payments[0]?.invoiceUrl;
  if (!checkoutUrl) throw new SubscriptionBusinessError("Não foi possível gerar o link de pagamento agora. Tente novamente em instantes.");
  return { checkoutUrl, subscription, price };
}

/** Para novas cobranças no Asaas primeiro; o acesso segue até o fim do período já pago. */
export async function cancelCarouselSubscription(userId: string, now: Date = new Date()): Promise<CarouselSubscriptionRecord> {
  const existing = await getCarouselSubscription(userId);
  if (!existing || !existing.asaasSubscriptionId) throw new SubscriptionBusinessError("Você não tem uma assinatura para cancelar.");
  if (existing.status === "CANCELED" || existing.status === "EXPIRED") throw new SubscriptionBusinessError("Essa assinatura já está cancelada.");
  await cancelAsaasSubscription(existing.asaasSubscriptionId);
  const updated = await markCarouselCanceled(userId, now);
  if (!updated) throw new SubscriptionBusinessError("Não foi possível registrar o cancelamento. Tente novamente.");
  return updated;
}

/** Reativa dentro do período já pago: nova assinatura no Asaas cobrando só quando o período acaba. */
export async function reactivateCarouselSubscription(userId: string, now: Date = new Date()): Promise<CarouselSubscriptionRecord> {
  const existing = await getCarouselSubscription(userId);
  if (!existing || existing.status !== "CANCELED") throw new SubscriptionBusinessError("Não há assinatura cancelada para reativar.");
  if (!existing.currentPeriodEndsAt || existing.currentPeriodEndsAt <= now) {
    throw new SubscriptionBusinessError("O período já pago terminou. Assine novamente para continuar.");
  }
  if (!existing.asaasCustomerId) throw new SubscriptionBusinessError("Não foi possível reativar automaticamente. Assine novamente para continuar.");
  const nextDueDate = existing.currentPeriodEndsAt.toISOString().slice(0, 10);
  const created = await createAsaasSubscription({
    customerId: existing.asaasCustomerId,
    value: existing.priceCents / 100,
    nextDueDate: nextDueDate > todayStr(now) ? nextDueDate : todayStr(now),
    description: `Alilu - Carrossel Inteligente ${getCarouselPlan(existing.planCode).name}`,
    externalReference: `${SUBSCRIPTION_REFERENCE_PREFIX}${userId}`,
  });
  const updated = await markCarouselReactivated(userId, created.id, now);
  if (!updated) {
    await cancelAsaasSubscription(created.id).catch(() => undefined);
    throw new SubscriptionBusinessError("Não foi possível reativar agora. Tente novamente.");
  }
  return updated;
}

export type ChangeCarouselPlanResult =
  | { kind: "upgrade"; checkoutUrl: string; amountCents: number; subscription: CarouselSubscriptionRecord }
  | { kind: "downgrade"; subscription: CarouselSubscriptionRecord };

/** Mantém o percentual de desconto contratado ao trocar de plano. */
export function priceAfterChange(sub: CarouselSubscriptionRecord, target: CarouselPlanCode): { listPriceCents: number; priceCents: number } {
  const listPriceCents = getCarouselPlan(target).priceCents;
  return { listPriceCents, priceCents: discountedPriceCents(listPriceCents, sub.discountPercent) };
}

export async function changeCarouselPlan(userId: string, planCode: CarouselPlanCode, now: Date = new Date()): Promise<ChangeCarouselPlanResult> {
  const existing = await getCarouselSubscription(userId);
  if (!existing || existing.status !== "ACTIVE" || existing.complimentary || !existing.asaasSubscriptionId || !existing.asaasCustomerId) {
    throw new SubscriptionBusinessError("Você precisa ter uma assinatura ativa para trocar de plano. Escolha um plano para assinar.");
  }
  const current = getCarouselPlan(existing.planCode);
  const target = getCarouselPlan(planCode);

  if (target.code === current.code) {
    if (!existing.pendingPlanCode) throw new SubscriptionBusinessError(`Você já está no plano ${current.name}.`);
    return { kind: "downgrade", subscription: await cancelScheduledCarouselPlanChange(userId) };
  }

  const next = priceAfterChange(existing, target.code);
  if (target.rank > current.rank) {
    if (!existing.currentPeriodEndsAt) throw new SubscriptionBusinessError("Não foi possível calcular a diferença agora. Tente novamente em instantes.");
    const amountCents = computeUpgradeProrationCents(existing.priceCents, next.priceCents, existing.currentPeriodEndsAt, now);
    const payment = await createAsaasPayment({
      customerId: existing.asaasCustomerId,
      value: amountCents / 100,
      dueDate: todayStr(now),
      description: `Alilu - Upgrade do Carrossel para o plano ${target.name} (${formatPriceBrl(amountCents)} até ${existing.currentPeriodEndsAt.toISOString().slice(0, 10)})`,
      externalReference: carouselUpgradeReference(userId, target.code),
    });
    if (!payment.invoiceUrl) throw new SubscriptionBusinessError("Não foi possível gerar o link de pagamento agora. Tente novamente em instantes.");
    return { kind: "upgrade", checkoutUrl: payment.invoiceUrl, amountCents, subscription: existing };
  }

  await updateAsaasSubscriptionValue(existing.asaasSubscriptionId, next.priceCents / 100);
  const updated = await setCarouselPendingPlan(userId, target.code);
  if (!updated) {
    await updateAsaasSubscriptionValue(existing.asaasSubscriptionId, existing.priceCents / 100).catch(() => undefined);
    throw new SubscriptionBusinessError("Não foi possível agendar a troca agora. Tente novamente.");
  }
  return { kind: "downgrade", subscription: updated };
}

export async function cancelScheduledCarouselPlanChange(userId: string): Promise<CarouselSubscriptionRecord> {
  const existing = await getCarouselSubscription(userId);
  if (!existing || existing.status !== "ACTIVE" || !existing.pendingPlanCode || !existing.asaasSubscriptionId) {
    throw new SubscriptionBusinessError("Não há troca de plano agendada.");
  }
  await updateAsaasSubscriptionValue(existing.asaasSubscriptionId, existing.priceCents / 100);
  const updated = await setCarouselPendingPlan(userId, null);
  if (!updated) throw new SubscriptionBusinessError("Não foi possível desfazer a troca agora. Tente novamente.");
  return updated;
}

// ---------------------------------------------------------------------------
// Estado para a tela de planos (nunca confia no navegador)
// ---------------------------------------------------------------------------
export interface CarouselPlanOffer {
  code: CarouselPlanCode;
  name: string;
  carouselsPerCycle: number;
  maxProfiles: number;
  highlighted: boolean;
  features: readonly string[];
  upcoming: readonly string[];
  listPriceCents: number;
  priceCents: number;
  discountPercent: number;
  current: boolean;
}

export interface CarouselBillingState {
  access: CarouselAccess;
  subscription: CarouselSubscriptionRecord | null;
  existingAliluCustomer: boolean;
  plans: CarouselPlanOffer[];
}

export async function getCarouselBillingState(userId: string, now: Date = new Date()): Promise<CarouselBillingState> {
  const [access, subscription, existing] = await Promise.all([getCarouselAccess(userId, now), getCarouselSubscription(userId), isExistingAliluCustomer(userId, now)]);
  const paying = subscription !== null && (subscription.status === "ACTIVE" || subscription.status === "PAST_DUE");
  const plans = listCarouselPlans().map((plan) => {
    // Quem já assina mantém o desconto contratado; novos clientes veem o desconto vigente.
    const price = paying && subscription ? priceAfterChange(subscription, plan.code) : carouselPriceFor(plan.code, existing);
    const discountPercent = paying && subscription ? subscription.discountPercent : existing ? carouselPriceFor(plan.code, true).discountPercent : 0;
    return {
      code: plan.code,
      name: plan.name,
      carouselsPerCycle: plan.carouselsPerCycle,
      maxProfiles: plan.maxProfiles,
      highlighted: plan.highlighted,
      features: plan.features,
      upcoming: plan.upcoming,
      listPriceCents: plan.priceCents,
      priceCents: price.priceCents,
      discountPercent,
      current: paying && subscription?.planCode === plan.code,
    };
  });
  return { access, subscription, existingAliluCustomer: existing, plans };
}

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------
export async function adminGrantCarouselPlan(userId: string, planCode: CarouselPlanCode, days: number, note: string | null, now: Date = new Date()): Promise<CarouselSubscriptionRecord> {
  if (!Number.isInteger(days) || days < 1 || days > 365) throw new SubscriptionBusinessError("A cortesia pode durar de 1 a 365 dias.");
  const plan = getCarouselPlan(planCode);
  const endsAt = new Date(now.getTime() + days * 86_400_000);
  const granted = await grantCarouselComplimentary({ userId, planCode, listPriceCents: plan.priceCents, endsAt, note: note?.trim().slice(0, 200) || null, now });
  if (!granted) throw new SubscriptionBusinessError("Esse cliente tem uma assinatura paga ativa; não é possível sobrepor com cortesia.");
  return granted;
}

export async function adminEndCarouselComplimentary(userId: string, now: Date = new Date()): Promise<boolean> {
  return endCarouselComplimentary(userId, now);
}
