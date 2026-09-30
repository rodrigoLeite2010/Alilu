import "server-only";
import { getDb } from "@/lib/db/client";
import type { AutomationSubscriptionRecord, AutomationSubscriptionStatus } from "./billing-types";

/**
 * Acesso a automation_subscriptions — 1 linha por usuário (não por
 * automação: "3 por dia" soma todas as automações dele). Mesmo padrão de
 * claim atômico já usado em automation-run-repository.ts: um único
 * INSERT ... ON CONFLICT ... DO UPDATE ... WHERE ... RETURNING * —
 * necessário porque getDb() usa o driver HTTP do Neon, que não suporta
 * BEGIN/COMMIT explícito nesta camada. A cláusula WHERE do DO UPDATE é
 * quem garante a exclusão mútua: se a condição falhar, o Postgres não
 * atualiza a linha e RETURNING não devolve nada — 5 requisições
 * concorrentes disputam o lock de linha do UPDATE e são serializadas
 * pelo próprio Postgres, nunca todas passam quando o limite já foi
 * atingido.
 */

function normalizeDate(value: unknown): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value);
}

function mapSubscriptionRow(row: Record<string, unknown>): AutomationSubscriptionRecord {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    status: row.status as AutomationSubscriptionStatus,
    trialStartedAt: row.trial_started_at ? new Date(row.trial_started_at as string) : null,
    trialEndsAt: row.trial_ends_at ? new Date(row.trial_ends_at as string) : null,
    trialUsageDate: row.trial_usage_date ? normalizeDate(row.trial_usage_date) : null,
    trialUsageCount: Number(row.trial_usage_count),
    asaasCustomerId: (row.asaas_customer_id as string | null) ?? null,
    asaasSubscriptionId: (row.asaas_subscription_id as string | null) ?? null,
    cpfCnpj: (row.cpf_cnpj as string | null) ?? null,
    monthlyPriceCents: Number(row.monthly_price_cents),
    startedAt: row.started_at ? new Date(row.started_at as string) : null,
    currentPeriodEndsAt: row.current_period_ends_at ? new Date(row.current_period_ends_at as string) : null,
    canceledAt: row.canceled_at ? new Date(row.canceled_at as string) : null,
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  };
}

export async function getSubscriptionByUserId(userId: string): Promise<AutomationSubscriptionRecord | null> {
  const db = getDb();
  const rows = await db`select * from automation_subscriptions where user_id = ${userId}`;
  return rows[0] ? mapSubscriptionRow(rows[0]) : null;
}

/** Usado pelo processamento do Webhook do Asaas para achar a linha certa a partir do evento recebido. */
export async function getByAsaasSubscriptionId(asaasSubscriptionId: string): Promise<AutomationSubscriptionRecord | null> {
  const db = getDb();
  const rows = await db`select * from automation_subscriptions where asaas_subscription_id = ${asaasSubscriptionId}`;
  return rows[0] ? mapSubscriptionRow(rows[0]) : null;
}

export interface SaveCheckoutStartInput {
  cpfCnpj: string;
  asaasCustomerId: string;
  asaasSubscriptionId: string;
  monthlyPriceCents: number;
}

/**
 * Grava o início do checkout — status PENDING_PAYMENT com os IDs do
 * Asaas. Nunca libera acesso sozinho (não muda status para ACTIVE): só o
 * processamento do Webhook faz isso, depois da confirmação de pagamento.
 * Cria a linha (usuário que nunca usou o trial e foi direto assinar) ou
 * atualiza a existente, sem tocar nos campos de trial.
 */
export async function saveCheckoutStart(
  userId: string,
  input: SaveCheckoutStartInput,
): Promise<AutomationSubscriptionRecord> {
  const db = getDb();
  const rows = await db`
    insert into automation_subscriptions (user_id, status, cpf_cnpj, asaas_customer_id, asaas_subscription_id, monthly_price_cents)
    values (${userId}, 'PENDING_PAYMENT', ${input.cpfCnpj}, ${input.asaasCustomerId}, ${input.asaasSubscriptionId}, ${input.monthlyPriceCents})
    on conflict (user_id) do update
    set status = 'PENDING_PAYMENT',
        cpf_cnpj = ${input.cpfCnpj},
        asaas_customer_id = ${input.asaasCustomerId},
        asaas_subscription_id = ${input.asaasSubscriptionId},
        monthly_price_cents = ${input.monthlyPriceCents},
        updated_at = now()
    returning *
  `;
  return mapSubscriptionRow(rows[0]);
}

/**
 * Cancela localmente — SÓ chamar depois de cancelar no Asaas com
 * sucesso (subscription-service.ts). Não apaga nada, não muda
 * current_period_ends_at: o acesso continua até o fim do período já
 * pago (visto pelo AutomationAccessService), e só vira EXPIRED quando
 * esse período passar. Devolve null se não havia assinatura paga para
 * cancelar (TRIAL/NEW/já CANCELED/EXPIRED).
 */
export async function markCanceled(userId: string, now: Date): Promise<AutomationSubscriptionRecord | null> {
  const db = getDb();
  const rows = await db`
    update automation_subscriptions
    set status = 'CANCELED', canceled_at = ${now.toISOString()}, updated_at = now()
    where user_id = ${userId} and status in ('ACTIVE', 'PAST_DUE', 'PENDING_PAYMENT')
    returning *
  `;
  return rows[0] ? mapSubscriptionRow(rows[0]) : null;
}

/**
 * Libera o acesso (status ACTIVE) depois de um PAYMENT_CONFIRMED/
 * PAYMENT_RECEIVED confirmado pelo processamento do Webhook —
 * asaas-webhook-service.ts é o ÚNICO chamador. started_at só é gravado
 * na primeira vez (coalesce); current_period_ends_at é sempre atualizado
 * (cobre tanto a 1ª confirmação quanto toda renovação mensal seguinte).
 * Nunca reativa uma assinatura já CANCELED por aqui (proteção contra um
 * evento atrasado chegar depois do usuário já ter cancelado).
 */
export async function markActiveFromPayment(
  asaasSubscriptionId: string,
  currentPeriodEndsAt: Date | null,
  now: Date,
): Promise<AutomationSubscriptionRecord | null> {
  const db = getDb();
  const rows = await db`
    update automation_subscriptions
    set status = 'ACTIVE',
        started_at = coalesce(started_at, ${now.toISOString()}),
        current_period_ends_at = ${currentPeriodEndsAt ? currentPeriodEndsAt.toISOString() : null},
        updated_at = now()
    where asaas_subscription_id = ${asaasSubscriptionId} and status != 'CANCELED'
    returning *
  `;
  return rows[0] ? mapSubscriptionRow(rows[0]) : null;
}

/** PAYMENT_OVERDUE confirmado pelo Webhook — bloqueia novos usos, nunca apaga nada já criado/agendado. */
export async function markPastDue(asaasSubscriptionId: string): Promise<AutomationSubscriptionRecord | null> {
  const db = getDb();
  const rows = await db`
    update automation_subscriptions
    set status = 'PAST_DUE', updated_at = now()
    where asaas_subscription_id = ${asaasSubscriptionId} and status in ('ACTIVE', 'PENDING_PAYMENT')
    returning *
  `;
  return rows[0] ? mapSubscriptionRow(rows[0]) : null;
}

/**
 * Mesmo efeito de markCanceled, mas localizado pelo asaas_subscription_id
 * (usado quando o Webhook manda SUBSCRIPTION_DELETED/SUBSCRIPTION_
 * INACTIVATED em vez de um evento de pagamento). canceled_at só é
 * gravado se ainda não havia um (coalesce) — evita sobrescrever a hora
 * real do cancelamento pedido pelo usuário com a hora, possivelmente
 * mais tardia, em que o Webhook confirmou.
 */
export async function markCanceledByAsaasSubscriptionId(
  asaasSubscriptionId: string,
  now: Date,
): Promise<AutomationSubscriptionRecord | null> {
  const db = getDb();
  const rows = await db`
    update automation_subscriptions
    set status = 'CANCELED', canceled_at = coalesce(canceled_at, ${now.toISOString()}), updated_at = now()
    where asaas_subscription_id = ${asaasSubscriptionId} and status in ('ACTIVE', 'PAST_DUE', 'PENDING_PAYMENT')
    returning *
  `;
  return rows[0] ? mapSubscriptionRow(rows[0]) : null;
}

/**
 * Reserva atomicamente 1 uso do Piloto Automático para hoje. Duas
 * situações criam/atualizam a linha no mesmo statement:
 *  - usuário nunca usou o Piloto (linha ainda não existe): o INSERT
 *    inicial cria a linha já em TRIAL, com trial_started_at/trial_ends_at
 *    calculados a partir de `now` (o trial começa no primeiro uso real,
 *    nunca na primeira visita à tela — TESTE 1).
 *  - usuário já em TRIAL, dentro do prazo e do limite diário: o DO
 *    UPDATE reseta a contagem se `today` for um dia novo, ou soma 1 se
 *    ainda for o mesmo dia (TESTE 2/3/4).
 * Qualquer outra situação (trial expirado, status diferente de TRIAL,
 * limite do dia já atingido) faz a cláusula WHERE do DO UPDATE falhar:
 * o Postgres não atualiza a linha, RETURNING não devolve nada, e a
 * função devolve `null` — quem chama deve negar o uso.
 *
 * Usuários com status ACTIVE/PENDING_PAYMENT/PAST_DUE/CANCELED/EXPIRED
 * nunca passam por aqui: AutomationAccessService só chama esta função
 * quando o status atual é TRIAL (ou a linha ainda não existe).
 */
export async function reserveTrialUsage(
  userId: string,
  now: Date,
  trialDays: number,
  dailyLimit: number,
): Promise<AutomationSubscriptionRecord | null> {
  const db = getDb();
  const nowIso = now.toISOString();
  const today = nowIso.slice(0, 10);
  const trialEndsAtIso = new Date(now.getTime() + trialDays * 24 * 60 * 60 * 1000).toISOString();

  const rows = await db`
    insert into automation_subscriptions (
      user_id, status, trial_started_at, trial_ends_at, trial_usage_date, trial_usage_count
    )
    values (${userId}, 'TRIAL', ${nowIso}, ${trialEndsAtIso}, ${today}, 1)
    on conflict (user_id) do update
    set trial_usage_count = case
          when automation_subscriptions.trial_usage_date is distinct from ${today} then 1
          else automation_subscriptions.trial_usage_count + 1
        end,
        trial_usage_date = ${today},
        updated_at = now()
    where automation_subscriptions.status = 'TRIAL'
      and automation_subscriptions.trial_ends_at > ${nowIso}
      and (
        automation_subscriptions.trial_usage_date is distinct from ${today}
        or automation_subscriptions.trial_usage_count < ${dailyLimit}
      )
    returning *
  `;
  return rows[0] ? mapSubscriptionRow(rows[0]) : null;
}

/**
 * Devolve 1 uso reservado quando a geração falha depois da reserva (o
 * "release on internal failure" pedido no briefing) — nunca deixa o
 * usuário perder uma vaga do dia por um erro nosso (ex.: IA fora do ar).
 * Só mexe na linha se ainda for o mesmo dia civil da reserva e status
 * ainda for TRIAL; caso contrário não faz nada (idempotente/seguro).
 */
export async function releaseTrialUsage(userId: string, today: string): Promise<void> {
  const db = getDb();
  await db`
    update automation_subscriptions
    set trial_usage_count = greatest(trial_usage_count - 1, 0), updated_at = now()
    where user_id = ${userId}
      and status = 'TRIAL'
      and trial_usage_date = ${today}
      and trial_usage_count > 0
  `;
}
