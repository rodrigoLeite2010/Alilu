import "server-only";
import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/db/client";
import { invalidateUserStatusCache } from "@/lib/auth/user-status";
import { isAdminEmail } from "@/lib/admin/admin-access";
import { applyWalletMovement, getWallet, listTransactions } from "@/lib/ai-video/backend/wallet-repository";
import { cancelAutomationSubscription } from "@/lib/billing/backend/subscription-service";
import { getSubscriptionByUserId } from "@/lib/billing/backend/automation-subscription-repository";
import { SubscriptionBusinessError, type AutomationSubscriptionRecord } from "@/lib/billing/backend/billing-types";
import { getPlan, isPlanCode, type PlanCode } from "@/lib/billing/plans";

/**
 * Ações manuais do admin sobre um cliente: créditos, plano de cortesia,
 * encerrar plano/assinatura, estender teste, ativar/desativar conta. Toda
 * ação: (1) é validada no servidor, (2) vale só para admin (a rota checa
 * ADMIN_EMAILS), (3) deixa um registro em admin_audit_log com quem fez, em
 * quem e os detalhes. Nenhuma ação apaga dados do cliente.
 */

export class AdminActionError extends Error {}

export interface AdminActor {
  userId: string;
  email: string;
}

export interface TargetUser {
  id: string;
  email: string;
  name: string | null;
  createdAt: Date;
  disabledAt: Date | null;
  disabledReason: string | null;
}

export const MAX_CREDIT_ADJUSTMENT = 100_000;
export const MAX_GRANT_DAYS = 730;
export const MAX_TRIAL_EXTENSION_DAYS = 90;

function reason(value: unknown, required = false): string {
  const text = typeof value === "string" ? value.trim().slice(0, 300) : "";
  if (required && !text) throw new AdminActionError("Informe o motivo (fica no histórico).");
  return text;
}

function integer(value: unknown, label: string, min: number, max: number): number {
  const parsed = typeof value === "number" ? value : typeof value === "string" && value.trim() !== "" ? Number(value) : NaN;
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new AdminActionError(`${label} deve ser um número inteiro entre ${min.toLocaleString("pt-BR")} e ${max.toLocaleString("pt-BR")}.`);
  }
  return parsed;
}

export async function getTargetUser(userId: string): Promise<TargetUser | null> {
  const rows = await getDb()`
    select id, email, name, created_at, disabled_at, disabled_reason from users where id = ${userId}
  `;
  const row = rows[0];
  if (!row) return null;
  return {
    id: String(row.id),
    email: String(row.email),
    name: (row.name as string | null) ?? null,
    createdAt: new Date(row.created_at as string),
    disabledAt: row.disabled_at ? new Date(row.disabled_at as string) : null,
    disabledReason: (row.disabled_reason as string | null) ?? null,
  };
}

async function requireTarget(userId: string): Promise<TargetUser> {
  const target = await getTargetUser(userId);
  if (!target) throw new AdminActionError("Usuário não encontrado.");
  return target;
}

export async function writeAuditLog(
  actor: AdminActor,
  target: Pick<TargetUser, "id" | "email">,
  action: string,
  details: Record<string, unknown>,
): Promise<void> {
  await getDb()`
    insert into admin_audit_log (admin_user_id, admin_email, target_user_id, target_email, action, details)
    values (${actor.userId}, ${actor.email}, ${target.id}, ${target.email}, ${action}, ${JSON.stringify(details)}::jsonb)
  `;
}

/** Dá (positivo) ou tira (negativo) créditos de IA. Nunca deixa o saldo negativo. */
export async function adjustCredits(
  actor: AdminActor,
  userId: string,
  input: { credits: unknown; reason: unknown },
): Promise<{ available: number }> {
  const target = await requireTarget(userId);
  const credits = integer(input.credits, "Créditos", -MAX_CREDIT_ADJUSTMENT, MAX_CREDIT_ADJUSTMENT);
  if (credits === 0) throw new AdminActionError("Informe uma quantidade diferente de zero (negativa para retirar).");
  const why = reason(input.reason, true);

  const result = await applyWalletMovement({
    userId,
    type: "ADMIN_ADJUSTMENT",
    availableDelta: credits,
    reservedDelta: 0,
    referenceType: "admin_adjustment",
    referenceId: randomUUID(),
    description: `Ajuste do administrador: ${why}`,
  });
  if (result.status === "insufficient") {
    const wallet = await getWallet(userId);
    throw new AdminActionError(`Saldo insuficiente para retirar ${Math.abs(credits)} créditos (disponível: ${wallet?.available ?? 0}).`);
  }
  await writeAuditLog(actor, target, credits > 0 ? "CREDITS_GRANTED" : "CREDITS_REMOVED", {
    credits,
    reason: why,
    availableAfter: result.transaction.availableAfter,
  });
  return { available: result.transaction.availableAfter };
}

/**
 * Plano de cortesia: o cliente usa o plano escolhido, sem cobrança, até a
 * data. Não mexe em quem tem assinatura paga ativa (cancele antes). Termina
 * sozinho no vencimento.
 */
export async function grantComplimentaryPlan(
  actor: AdminActor,
  userId: string,
  input: { planCode: unknown; days: unknown; note: unknown },
  now: Date = new Date(),
): Promise<AutomationSubscriptionRecord> {
  const target = await requireTarget(userId);
  if (!isPlanCode(input.planCode)) throw new AdminActionError("Escolha um plano válido.");
  const planCode: PlanCode = input.planCode;
  const days = integer(input.days, "Dias", 1, MAX_GRANT_DAYS);
  const note = reason(input.note, true);
  const end = new Date(`${new Date(now.getTime() + days * 86_400_000).toISOString().slice(0, 10)}T00:00:00.000Z`);

  const rows = await getDb()`
    insert into automation_subscriptions
      (user_id, status, plan_code, monthly_price_cents, complimentary, admin_note, started_at, current_period_ends_at)
    values (${userId}, 'ACTIVE', ${planCode}, 0, true, ${note}, ${now.toISOString()}, ${end.toISOString()})
    on conflict (user_id) do update set
      status = 'ACTIVE',
      plan_code = excluded.plan_code,
      monthly_price_cents = 0,
      complimentary = true,
      admin_note = excluded.admin_note,
      started_at = coalesce(automation_subscriptions.started_at, excluded.started_at),
      current_period_ends_at = excluded.current_period_ends_at,
      canceled_at = null,
      pending_plan_code = null,
      asaas_subscription_id = null,
      updated_at = now()
    where automation_subscriptions.complimentary
       or automation_subscriptions.status not in ('ACTIVE', 'PAST_DUE', 'PENDING_PAYMENT')
    returning user_id
  `;
  if (!rows[0]) {
    throw new AdminActionError(
      "Este cliente tem uma assinatura paga em andamento (ativa, em atraso ou aguardando pagamento). Cancele a assinatura antes de conceder cortesia.",
    );
  }
  await writeAuditLog(actor, target, "PLAN_GRANTED", { planCode, plan: getPlan(planCode).name, days, until: end.toISOString().slice(0, 10), note });
  return (await getSubscriptionByUserId(userId))!;
}

/**
 * Encerra o plano do cliente.
 *  - Cortesia: termina agora.
 *  - Assinatura paga: cancela no Asaas (para novas cobranças); com `immediate`
 *    o acesso também termina agora, senão continua até o fim do período já pago.
 */
export async function endPlan(
  actor: AdminActor,
  userId: string,
  input: { immediate?: unknown; reason: unknown },
  now: Date = new Date(),
): Promise<AutomationSubscriptionRecord> {
  const target = await requireTarget(userId);
  const why = reason(input.reason, true);
  const existing = await getSubscriptionByUserId(userId);
  if (!existing || (existing.status !== "ACTIVE" && existing.status !== "PAST_DUE" && existing.status !== "PENDING_PAYMENT")) {
    throw new AdminActionError("Este cliente não tem plano ou assinatura em andamento para encerrar.");
  }
  const immediate = input.immediate === true;

  if (existing.complimentary) {
    await getDb()`
      update automation_subscriptions
      set status = 'CANCELED', canceled_at = ${now.toISOString()}, current_period_ends_at = ${now.toISOString()}, pending_plan_code = null, updated_at = now()
      where user_id = ${userId} and complimentary
    `;
    await writeAuditLog(actor, target, "PLAN_ENDED", { kind: "complimentary", planCode: existing.planCode, reason: why });
    return (await getSubscriptionByUserId(userId))!;
  }

  try {
    await cancelAutomationSubscription(userId, now);
  } catch (error) {
    if (error instanceof SubscriptionBusinessError) throw new AdminActionError(error.message);
    throw error;
  }
  if (immediate) {
    await getDb()`
      update automation_subscriptions
      set current_period_ends_at = ${now.toISOString()}, updated_at = now()
      where user_id = ${userId} and status = 'CANCELED'
    `;
  }
  await writeAuditLog(actor, target, "SUBSCRIPTION_CANCELED", { planCode: existing.planCode, immediate, reason: why });
  return (await getSubscriptionByUserId(userId))!;
}

/** Estende (ou reabre) o teste grátis em N dias. Só para quem não tem plano pago em andamento. */
export async function extendTrial(
  actor: AdminActor,
  userId: string,
  input: { days: unknown; reason: unknown },
  now: Date = new Date(),
): Promise<AutomationSubscriptionRecord> {
  const target = await requireTarget(userId);
  const days = integer(input.days, "Dias", 1, MAX_TRIAL_EXTENSION_DAYS);
  const why = reason(input.reason, true);
  const nowIso = now.toISOString();

  const rows = await getDb()`
    insert into automation_subscriptions (user_id, status, trial_started_at, trial_ends_at)
    values (${userId}, 'TRIAL', ${nowIso}, ${new Date(now.getTime() + days * 86_400_000).toISOString()})
    on conflict (user_id) do update set
      status = 'TRIAL',
      trial_started_at = coalesce(automation_subscriptions.trial_started_at, ${nowIso}),
      trial_ends_at = greatest(coalesce(automation_subscriptions.trial_ends_at, ${nowIso}::timestamptz), ${nowIso}::timestamptz)
                      + (${days}::int * interval '1 day'),
      updated_at = now()
    where automation_subscriptions.status in ('TRIAL', 'EXPIRED')
       or (automation_subscriptions.status = 'CANCELED'
           and (automation_subscriptions.current_period_ends_at is null or automation_subscriptions.current_period_ends_at <= ${nowIso}::timestamptz))
    returning user_id
  `;
  if (!rows[0]) {
    throw new AdminActionError("Este cliente tem plano pago em andamento — estender o teste só vale para quem não tem plano ativo.");
  }
  await writeAuditLog(actor, target, "TRIAL_EXTENDED", { days, reason: why });
  return (await getSubscriptionByUserId(userId))!;
}

/**
 * Desativa/reativa a conta. Desativada: não entra, a sessão aberta cai em
 * segundos e as automações ativas são pausadas (nada é apagado). Reativar
 * só libera o login — as automações continuam pausadas até o cliente ligá-las.
 */
export async function setUserDisabled(
  actor: AdminActor,
  userId: string,
  input: { disabled: boolean; reason: unknown },
): Promise<{ disabled: boolean; automationsPaused: number }> {
  const target = await requireTarget(userId);
  if (input.disabled) {
    if (userId === actor.userId) throw new AdminActionError("Você não pode desativar a própria conta.");
    if (isAdminEmail(target.email)) throw new AdminActionError("Contas de administrador não podem ser desativadas por aqui.");
  }
  const why = input.disabled ? reason(input.reason, true) : reason(input.reason);
  const db = getDb();

  let automationsPaused = 0;
  if (input.disabled) {
    await db`update users set disabled_at = now(), disabled_reason = ${why}, updated_at = now() where id = ${userId}`;
    const paused = await db`
      update content_automations set status = 'PAUSED', updated_at = now()
      where user_id = ${userId} and status = 'ACTIVE'
      returning id
    `;
    automationsPaused = paused.length;
  } else {
    await db`update users set disabled_at = null, disabled_reason = null, updated_at = now() where id = ${userId}`;
  }
  invalidateUserStatusCache(userId);
  await writeAuditLog(actor, target, input.disabled ? "USER_DISABLED" : "USER_ENABLED", { reason: why, automationsPaused });
  return { disabled: input.disabled, automationsPaused };
}

// ---------------------------------------------------------------------------
// Detalhe do usuário (tela do admin)
// ---------------------------------------------------------------------------

export interface AuditEntry {
  id: string;
  adminEmail: string;
  action: string;
  details: Record<string, unknown>;
  createdAt: Date;
}

export interface UserAdminDetail {
  user: TargetUser;
  subscription: AutomationSubscriptionRecord | null;
  credits: { available: number; reserved: number };
  transactions: Awaited<ReturnType<typeof listTransactions>>;
  audit: AuditEntry[];
  automations: { active: number; total: number };
  instagramConnected: boolean;
  isAdmin: boolean;
}

export async function getUserAdminDetail(userId: string): Promise<UserAdminDetail | null> {
  const user = await getTargetUser(userId);
  if (!user) return null;
  const db = getDb();
  const [subscription, wallet, transactions, auditRows, automations, instagram] = await Promise.all([
    getSubscriptionByUserId(userId),
    getWallet(userId),
    listTransactions(userId, 15),
    db`select id, admin_email, action, details, created_at from admin_audit_log where target_user_id = ${userId} order by created_at desc limit 25`,
    db`select count(*) filter (where status = 'ACTIVE')::int as active, count(*)::int as total from content_automations where user_id = ${userId} and status <> 'ARCHIVED'`,
    db`select 1 from instagram_accounts where user_id = ${userId} limit 1`,
  ]);
  return {
    user,
    subscription,
    credits: { available: wallet?.available ?? 0, reserved: wallet?.reserved ?? 0 },
    transactions,
    audit: auditRows.map((row) => ({
      id: String(row.id),
      adminEmail: String(row.admin_email),
      action: String(row.action),
      details: (row.details as Record<string, unknown>) ?? {},
      createdAt: new Date(row.created_at as string),
    })),
    automations: { active: Number(automations[0]?.active ?? 0), total: Number(automations[0]?.total ?? 0) },
    instagramConnected: instagram.length > 0,
    isAdmin: isAdminEmail(user.email),
  };
}
