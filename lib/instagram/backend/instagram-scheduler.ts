import "server-only";
import { randomUUID, timingSafeEqual } from "node:crypto";
import { claimNextDuePost } from "@/lib/instagram/backend/instagram-post-repository";
import {
  InstagramPublishError,
  LOCK_TTL_SECONDS,
  publishInstagramPublication,
  type PublishOutcome,
} from "@/lib/instagram/backend/instagram-publish-service";
import { logPublicationEvent } from "@/lib/instagram/backend/publication-log";

/**
 * Executor do agendador, independente de provedor: Vercel Cron, GitHub
 * Actions, cron-job.org ou qualquer outro só precisam chamar
 * /api/cron/instagram-publish com `Authorization: Bearer <segredo>`.
 *
 * Cada iteração faz um CLAIM ATÔMICO de UMA publicação vencida (FOR UPDATE
 * SKIP LOCKED + lock com expiração) e a publica pela mesma camada usada em
 * "Publicar agora". Instâncias concorrentes nunca pegam a mesma linha.
 * Um orçamento de tempo impede começar uma publicação nova perto do
 * limite de duração da função.
 */

export interface SchedulerRunResult {
  postId: string;
  status: PublishOutcome | "FAILED";
  error?: string;
}

export interface RunSchedulerOptions {
  limit?: number;
  /** Não inicia novas publicações depois deste tempo (ms desde o início). */
  timeBudgetMs?: number;
}

export const DEFAULT_SCHEDULER_LIMIT = 5;
export const MAX_SCHEDULER_LIMIT = 20;
const DEFAULT_TIME_BUDGET_MS = 30_000;

export async function runInstagramScheduler(options: RunSchedulerOptions = {}): Promise<SchedulerRunResult[]> {
  const limit = Math.min(Math.max(options.limit ?? DEFAULT_SCHEDULER_LIMIT, 1), MAX_SCHEDULER_LIMIT);
  const budget = options.timeBudgetMs ?? DEFAULT_TIME_BUDGET_MS;
  const startedAt = Date.now();
  const results: SchedulerRunResult[] = [];

  while (results.length < limit && Date.now() - startedAt < budget) {
    const lockToken = randomUUID();
    const claimed = await claimNextDuePost(lockToken, LOCK_TTL_SECONDS);
    if (!claimed) break;

    try {
      const status = await publishInstagramPublication(claimed.id, claimed.userId, {
        trigger: "scheduler",
        claimed: { post: claimed, lockToken },
      });
      results.push({ postId: claimed.id, status });
    } catch (error) {
      results.push({
        postId: claimed.id,
        status: "FAILED",
        error: error instanceof InstagramPublishError ? error.message : "Falha ao publicar agendamento.",
      });
    }
  }

  logPublicationEvent({ event: "scheduler.run", claimed: results.length, durationMs: Date.now() - startedAt });
  return results;
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/**
 * Autoriza a chamada do disparador. Aceita `Authorization: Bearer <x>`
 * onde <x> é CRON_SECRET (o que a Vercel Cron envia automaticamente) ou
 * INSTAGRAM_SCHEDULER_SECRET (disparadores externos). Sem nenhum segredo
 * configurado, tudo é recusado. Segredo nunca vai na URL.
 */
export function isSchedulerRequestAuthorized(request: Request): boolean {
  const header = request.headers.get("authorization") ?? "";
  if (!header.startsWith("Bearer ")) return false;
  const provided = header.slice("Bearer ".length).trim();
  if (provided.length < 16) return false;

  const secrets = [process.env.CRON_SECRET, process.env.INSTAGRAM_SCHEDULER_SECRET].filter(
    (value): value is string => typeof value === "string" && value.length >= 16,
  );
  return secrets.some((secret) => safeEqual(provided, secret));
}

export function parseSchedulerLimit(request: Request): number {
  const raw = Number(new URL(request.url).searchParams.get("limit") ?? DEFAULT_SCHEDULER_LIMIT);
  return Number.isFinite(raw) ? Math.min(Math.max(Math.floor(raw), 1), MAX_SCHEDULER_LIMIT) : DEFAULT_SCHEDULER_LIMIT;
}
