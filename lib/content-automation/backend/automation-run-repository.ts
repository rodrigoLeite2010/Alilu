import "server-only";
import { getDb } from "@/lib/db/client";
import type { AutomationRunRecord, AutomationRunStatus } from "./automation-types";

/**
 * Acesso ao banco de automation_runs — a "trava" de idempotência do cron
 * de geração (seção 11/38 do briefing) e o rastreamento de cada execução
 * diária. Mesmo padrão de claim atômico já usado no agendador de
 * publicação (claimNextDuePost em instagram-post-repository.ts): um único
 * UPDATE com subconsulta `FOR UPDATE SKIP LOCKED` e lock com expiração —
 * nunca duas execuções concorrentes do cron geram conteúdo para o mesmo
 * automation_id + run_date.
 */

export const RUN_LOCK_TTL_SECONDS = 5 * 60;

/**
 * Normaliza a coluna `date` (run_date) para "YYYY-MM-DD". O driver de
 * produção (neon() HTTP) devolve colunas `date` como string; o PGlite
 * usado nos testes devolve um `Date` — nunca assumir um formato só.
 */
function normalizeRunDate(value: unknown): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value);
}

function mapRunRow(row: Record<string, unknown>): AutomationRunRecord {
  return {
    id: row.id as string,
    automationId: row.automation_id as string,
    automationDayId: row.automation_day_id as string,
    instagramAccountId: row.instagram_account_id as string,
    runDate: normalizeRunDate(row.run_date),
    status: row.status as AutomationRunStatus,
    publicationId: (row.publication_id as string | null) ?? null,
    generationAttempt: Number(row.generation_attempt),
    errorMessage: (row.error_message as string | null) ?? null,
    startedAt: row.started_at ? new Date(row.started_at as string) : null,
    completedAt: row.completed_at ? new Date(row.completed_at as string) : null,
    nextAttemptAt: row.next_attempt_at ? new Date(row.next_attempt_at as string) : null,
    createdAt: new Date(row.created_at as string),
  };
}

/**
 * Garante a existência da linha do dia para (automationId, runDate) — a
 * CHAVE da idempotência. `on conflict (automation_id, run_date) do
 * nothing` faz com que chamadas concorrentes nunca criem duas linhas; a
 * que perder a corrida simplesmente relê a linha já criada pela outra.
 */
export async function ensureRunForDate(
  automationId: string,
  automationDayId: string,
  instagramAccountId: string,
  runDate: string,
): Promise<AutomationRunRecord> {
  const db = getDb();
  const inserted = await db`
    insert into automation_runs (automation_id, automation_day_id, instagram_account_id, run_date)
    values (${automationId}, ${automationDayId}, ${instagramAccountId}, ${runDate})
    on conflict (automation_id, run_date) do nothing
    returning *
  `;
  if (inserted[0]) return mapRunRow(inserted[0]);

  const existing = await db`
    select * from automation_runs where automation_id = ${automationId} and run_date = ${runDate}
  `;
  return mapRunRow(existing[0]);
}

/**
 * Faz o claim atômico da execução para começar a gerar conteúdo. Só
 * pega runs `PENDING` (ou `FAILED` pronto para retry, via next_attempt_at)
 * sem lock ativo. Retorna `null` se outra instância já pegou (ou se não
 * há nada elegível) — quem chama não deve gerar conteúdo nesse caso.
 */
export async function claimRunForGeneration(
  runId: string,
  lockToken: string,
  lockTtlSeconds: number = RUN_LOCK_TTL_SECONDS,
): Promise<AutomationRunRecord | null> {
  const db = getDb();
  const rows = await db`
    update automation_runs
    set status = 'GENERATING',
        processing_lock_token = ${lockToken},
        processing_lock_expires_at = now() + (${lockTtlSeconds}::int * interval '1 second'),
        started_at = coalesce(started_at, now())
    where id = (
      select id from automation_runs
      where id = ${runId}
        and status in ('PENDING', 'FAILED')
        and (next_attempt_at is null or next_attempt_at <= now())
        and (processing_lock_token is null or processing_lock_expires_at < now())
      for update skip locked
    )
    returning *
  `;
  return rows[0] ? mapRunRow(rows[0]) : null;
}

/** Geração concluída e publicação (DRAFT ou SCHEDULED) já criada em instagram_posts. */
export async function markRunGenerated(
  runId: string,
  lockToken: string,
  publicationId: string,
  status: Extract<AutomationRunStatus, "WAITING_APPROVAL" | "SCHEDULED">,
): Promise<void> {
  const db = getDb();
  await db`
    update automation_runs
    set status = ${status}, publication_id = ${publicationId}, completed_at = now(),
        processing_lock_token = null, processing_lock_expires_at = null, error_message = null
    where id = ${runId} and processing_lock_token = ${lockToken}
  `;
}

/**
 * Geração falhou. Segue o mesmo esquema de retry documentado no briefing
 * (seção 26): até 3 tentativas, backoff 5/15/30 min; depois disso, FAILED
 * definitivo. `attempt` é o número da tentativa que acabou de falhar
 * (1-based).
 */
const GENERATION_BACKOFF_MINUTES = [5, 15, 30];
const MAX_GENERATION_ATTEMPTS = GENERATION_BACKOFF_MINUTES.length;

export function computeNextGenerationRetryAt(attempt: number, now: () => Date = () => new Date()): Date | null {
  if (attempt > MAX_GENERATION_ATTEMPTS) return null;
  const minutes = GENERATION_BACKOFF_MINUTES[attempt - 1];
  return new Date(now().getTime() + minutes * 60_000);
}

export async function markRunFailed(
  runId: string,
  lockToken: string,
  errorMessage: string,
  now: () => Date = () => new Date(),
): Promise<{ status: "FAILED" | "PENDING"; nextAttemptAt: Date | null }> {
  const db = getDb();
  const rows = await db`
    update automation_runs
    set generation_attempt = generation_attempt + 1
    where id = ${runId} and processing_lock_token = ${lockToken}
    returning generation_attempt
  `;
  const attempt = rows[0] ? Number(rows[0].generation_attempt) : MAX_GENERATION_ATTEMPTS + 1;
  const nextAttemptAt = computeNextGenerationRetryAt(attempt, now);
  const status: "FAILED" | "PENDING" = nextAttemptAt ? "PENDING" : "FAILED";

  await db`
    update automation_runs
    set status = ${status}, error_message = ${errorMessage.slice(0, 2000)},
        next_attempt_at = ${nextAttemptAt ? nextAttemptAt.toISOString() : null},
        processing_lock_token = null, processing_lock_expires_at = null,
        completed_at = ${status === "FAILED" ? now().toISOString() : null}
    where id = ${runId} and processing_lock_token = ${lockToken}
  `;
  return { status, nextAttemptAt };
}

/** Cancela runs futuros/pendentes de uma automação (usado ao pausar "e cancelar futuras", seção 30). */
export async function cancelPendingRunsForAutomation(automationId: string): Promise<number> {
  const db = getDb();
  const rows = await db`
    update automation_runs
    set status = 'CANCELLED', completed_at = now()
    where automation_id = ${automationId} and status in ('PENDING', 'GENERATED', 'WAITING_APPROVAL')
    returning id
  `;
  return rows.length;
}

/** Histórico de uma automação (mais recente primeiro), restrito ao dono via join. */
export async function listRunsForAutomationOwnedByUser(
  automationId: string,
  userId: string,
  limit = 50,
): Promise<AutomationRunRecord[]> {
  const db = getDb();
  const rows = await db`
    select r.* from automation_runs r
    join content_automations a on a.id = r.automation_id
    where r.automation_id = ${automationId} and a.user_id = ${userId}
    order by r.run_date desc, r.created_at desc
    limit ${limit}
  `;
  return rows.map(mapRunRow);
}

export async function getRunOwnedByUser(runId: string, userId: string): Promise<AutomationRunRecord | null> {
  const db = getDb();
  const rows = await db`
    select r.* from automation_runs r
    join content_automations a on a.id = r.automation_id
    where r.id = ${runId} and a.user_id = ${userId}
  `;
  return rows[0] ? mapRunRow(rows[0]) : null;
}

/** Última publicação (a linha em instagram_posts que a IA gerou) para o "evitar repetição" (seção 21). */
export interface RecentGenerationSummary {
  runDate: string;
  caption: string;
}

export async function listRecentGenerationsForAutomation(
  automationId: string,
  limit = 7,
): Promise<RecentGenerationSummary[]> {
  const db = getDb();
  const rows = await db`
    select r.run_date, p.caption
    from automation_runs r
    join instagram_posts p on p.id = r.publication_id
    where r.automation_id = ${automationId} and r.publication_id is not null
    order by r.run_date desc
    limit ${limit}
  `;
  return rows.map((row) => ({ runDate: row.run_date as string, caption: (row.caption as string | null) ?? "" }));
}

export async function setRunStatus(runId: string, status: AutomationRunStatus): Promise<void> {
  const db = getDb();
  await db`update automation_runs set status = ${status}, completed_at = now() where id = ${runId}`;
}
