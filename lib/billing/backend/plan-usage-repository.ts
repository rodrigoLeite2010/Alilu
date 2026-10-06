import "server-only";
import { getDb } from "@/lib/db/client";

/**
 * Franquia de publicações com IA por ciclo de cobrança (plan_usage_cycles
 * + plan_usage_events).
 *
 * Mesma técnica da carteira de créditos (wallet-repository.ts): o driver
 * HTTP do Neon não faz BEGIN/COMMIT com vários comandos, então cada
 * movimentação é UM único comando SQL — o contador e o registro do evento
 * mudam juntos ou não mudam. O WHERE do UPDATE garante que o contador
 * nunca passa do limite (requisições simultâneas são serializadas pela
 * trava de linha do Postgres) e a chave única (user, tipo, referência)
 * garante que retry/clique duplo/reprocessamento nunca contam duas vezes.
 */

export interface PlanUsageReference {
  userId: string;
  referenceType: string;
  referenceId: string;
}

export type ReservePlanUsageResult =
  | { status: "reserved"; used: number }
  | { status: "duplicate" }
  | { status: "limit" };

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: unknown }).code === "23505";
}

async function ensureCycle(userId: string, cycleKey: string, planCode: string): Promise<void> {
  const db = getDb();
  await db`
    insert into plan_usage_cycles (user_id, cycle_key, plan_code)
    values (${userId}, ${cycleKey}, ${planCode})
    on conflict (user_id, cycle_key) do nothing
  `;
}

/** Quantas publicações com IA já foram usadas neste ciclo. */
export async function getCycleUsed(userId: string, cycleKey: string): Promise<number> {
  const db = getDb();
  const rows = await db`select used from plan_usage_cycles where user_id = ${userId} and cycle_key = ${cycleKey}`;
  return rows[0] ? Number(rows[0].used) : 0;
}

/** Quantas reservas ativas o usuário fez desde `since` (referência diária — só aviso, nunca bloqueio). */
export async function countReservedSince(userId: string, since: Date): Promise<number> {
  const db = getDb();
  const rows = await db`
    select count(*) as total from plan_usage_events
    where user_id = ${userId} and status = 'RESERVED' and created_at >= ${since.toISOString()}
  `;
  return Number(rows[0]?.total ?? 0);
}

/**
 * Reserva 1 publicação da franquia do ciclo. `limit` vem do catálogo de
 * planos. "limit" = franquia esgotada; "duplicate" = esta mesma referência
 * já tem uma reserva ativa (não conta de novo). Uma referência que foi
 * devolvida (RELEASED) volta a poder reservar — é o caminho do retry do cron.
 */
export async function reservePlanUsage(
  input: PlanUsageReference & { cycleKey: string; planCode: string; limit: number },
): Promise<ReservePlanUsageResult> {
  await ensureCycle(input.userId, input.cycleKey, input.planCode);
  const db = getDb();
  try {
    const rows = await db`
      with upd as (
        update plan_usage_cycles
        set used = used + 1, plan_code = ${input.planCode}, updated_at = now()
        where user_id = ${input.userId} and cycle_key = ${input.cycleKey} and used < ${input.limit}
        returning used
      )
      insert into plan_usage_events (user_id, cycle_key, reference_type, reference_id)
      select ${input.userId}, ${input.cycleKey}, ${input.referenceType}, ${input.referenceId} from upd
      returning (select used from upd) as used
    `;
    if (rows.length === 0) return { status: "limit" };
    return { status: "reserved", used: Number(rows[0].used) };
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    // A referência já existe (o comando inteiro foi desfeito, o contador não mexeu).
  }

  // Já existe: ativa = duplicado de verdade; devolvida = nova tentativa legítima.
  const rows = await db`
    with upd as (
      update plan_usage_cycles
      set used = used + 1, plan_code = ${input.planCode}, updated_at = now()
      where user_id = ${input.userId} and cycle_key = ${input.cycleKey} and used < ${input.limit}
        and exists (
          select 1 from plan_usage_events
          where user_id = ${input.userId} and reference_type = ${input.referenceType}
            and reference_id = ${input.referenceId} and status = 'RELEASED'
        )
      returning used
    ),
    ev as (
      update plan_usage_events
      set status = 'RESERVED', cycle_key = ${input.cycleKey}, updated_at = now()
      where user_id = ${input.userId} and reference_type = ${input.referenceType}
        and reference_id = ${input.referenceId} and status = 'RELEASED'
        and exists (select 1 from upd)
      returning id
    )
    select used from upd
  `;
  if (rows.length > 0) return { status: "reserved", used: Number(rows[0].used) };

  const existing = await db`
    select status from plan_usage_events
    where user_id = ${input.userId} and reference_type = ${input.referenceType} and reference_id = ${input.referenceId}
  `;
  if (existing[0]?.status === "RESERVED") return { status: "duplicate" };
  return { status: "limit" };
}

/**
 * Devolve a reserva (geração falhou por erro nosso): o contador desce 1 e o
 * evento vira RELEASED. Idempotente — devolver duas vezes devolve uma só.
 * `true` se devolveu agora.
 */
export async function releasePlanUsage(reference: PlanUsageReference): Promise<boolean> {
  const db = getDb();
  const rows = await db`
    with ev as (
      update plan_usage_events
      set status = 'RELEASED', updated_at = now()
      where user_id = ${reference.userId} and reference_type = ${reference.referenceType}
        and reference_id = ${reference.referenceId} and status = 'RESERVED'
      returning cycle_key
    ),
    upd as (
      update plan_usage_cycles
      set used = greatest(used - 1, 0), updated_at = now()
      where user_id = ${reference.userId} and cycle_key in (select cycle_key from ev)
      returning 1
    )
    select count(*) as released from ev
  `;
  return Number(rows[0]?.released ?? 0) > 0;
}
