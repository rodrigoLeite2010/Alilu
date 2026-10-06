import "server-only";
import { getDb } from "@/lib/db/client";
import { PLAN_DEFINITIONS, isPlanCode, type PlanCode } from "../plans";

/**
 * Lista de usuários do admin com a situação de plano de cada um — somente
 * leitura (consulta). Quem logou, que plano tem, se está pagando, até quando,
 * uso da franquia de IA do ciclo e saldo de créditos. Nunca expõe CPF nem
 * IDs do Asaas.
 */

export const USERS_PAGE_SIZE = 50;

export const STATUS_FILTERS = ["ACTIVE", "PAST_DUE", "PENDING_PAYMENT", "CANCELED", "TRIAL", "EXPIRED", "SEM_ASSINATURA"] as const;
export type StatusFilter = (typeof STATUS_FILTERS)[number];

export interface UsersQuery {
  q?: string | null;
  plan?: string | null;
  status?: string | null;
  page?: number | null;
}

export interface BillingUserRow {
  userId: string;
  email: string;
  name: string | null;
  createdAt: Date;
  status: string | null;
  planCode: PlanCode | null;
  priceCents: number | null;
  pendingPlanCode: PlanCode | null;
  startedAt: Date | null;
  currentPeriodEndsAt: Date | null;
  canceledAt: Date | null;
  trialEndsAt: Date | null;
  aiUsed: number | null;
  aiLimit: number | null;
  credits: number;
}

export interface BillingUsersPage {
  rows: BillingUserRow[];
  total: number;
  page: number;
  pageCount: number;
  filters: { q: string; plan: PlanCode | null; status: StatusFilter | null };
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

function date(value: unknown): Date | null {
  return value ? new Date(value as string) : null;
}

export function normalizeUsersQuery(query: UsersQuery): { q: string; plan: PlanCode | null; status: StatusFilter | null; page: number } {
  const q = (query.q ?? "").trim().slice(0, 100);
  const plan = isPlanCode(query.plan) ? query.plan : null;
  const status = (STATUS_FILTERS as readonly string[]).includes(query.status ?? "") ? (query.status as StatusFilter) : null;
  const page = Number.isFinite(query.page) && (query.page as number) >= 1 ? Math.floor(query.page as number) : 1;
  return { q, plan, status, page };
}

export async function listBillingUsers(query: UsersQuery): Promise<BillingUsersPage> {
  const db = getDb();
  const { q, plan, status, page } = normalizeUsersQuery(query);
  const like = q ? `%${escapeLike(q)}%` : null;
  const offset = (page - 1) * USERS_PAGE_SIZE;

  const [count] = await db`
    select count(*)::int as total
    from users u
    left join automation_subscriptions s on s.user_id = u.id
    where (${like}::text is null or u.email ilike ${like} or coalesce(u.name, '') ilike ${like})
      and (${plan}::text is null or s.plan_code = ${plan})
      and (${status}::text is null
           or (${status} = 'SEM_ASSINATURA' and s.user_id is null)
           or s.status = ${status})
  `;
  const total = Number(count?.total ?? 0);

  const rows = await db`
    select u.id, u.email, u.name, u.created_at,
      s.status, s.plan_code, s.monthly_price_cents, s.pending_plan_code, s.started_at,
      s.current_period_ends_at, s.canceled_at, s.trial_ends_at,
      c.used as ai_used,
      coalesce(w.available, 0)::int as credits
    from users u
    left join automation_subscriptions s on s.user_id = u.id
    left join plan_usage_cycles c
      on c.user_id = u.id
     and s.status = 'ACTIVE'
     and c.cycle_key = to_char(s.current_period_ends_at at time zone 'UTC', 'YYYY-MM-DD')
    left join ai_credit_wallets w on w.user_id = u.id
    where (${like}::text is null or u.email ilike ${like} or coalesce(u.name, '') ilike ${like})
      and (${plan}::text is null or s.plan_code = ${plan})
      and (${status}::text is null
           or (${status} = 'SEM_ASSINATURA' and s.user_id is null)
           or s.status = ${status})
    order by (s.status = 'ACTIVE') desc nulls last, u.created_at desc, u.id
    limit ${USERS_PAGE_SIZE} offset ${offset}
  `;

  return {
    rows: rows.map((row) => {
      const planCode = row.status && isPlanCode(row.plan_code) ? row.plan_code : null;
      const limit = planCode ? PLAN_DEFINITIONS[planCode].aiPostsPerCycle : null;
      return {
        userId: String(row.id),
        email: String(row.email),
        name: (row.name as string | null) ?? null,
        createdAt: new Date(row.created_at as string),
        status: (row.status as string | null) ?? null,
        planCode,
        priceCents: row.status ? Number(row.monthly_price_cents) : null,
        pendingPlanCode: isPlanCode(row.pending_plan_code) ? row.pending_plan_code : null,
        startedAt: date(row.started_at),
        currentPeriodEndsAt: date(row.current_period_ends_at),
        canceledAt: date(row.canceled_at),
        trialEndsAt: date(row.trial_ends_at),
        aiUsed: limit !== null && row.status === "ACTIVE" ? Number(row.ai_used ?? 0) : null,
        aiLimit: limit,
        credits: Number(row.credits ?? 0),
      };
    }),
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / USERS_PAGE_SIZE)),
    filters: { q, plan, status },
  };
}
