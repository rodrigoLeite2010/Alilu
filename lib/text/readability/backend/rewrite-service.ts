import "server-only";
import { isAdminEmail } from "@/lib/admin/admin-access";
import { AIProviderConfigError, AIProviderRequestError } from "@/lib/content-automation/backend/ai-provider";
import { getContentAIProvider } from "@/lib/content-automation/backend/provider-factory";
import { getDb } from "@/lib/db/client";
import { analyzeReadability, type ReadabilityResult } from "../analyze";
import {
  REWRITE_DAILY_LIMIT,
  REWRITE_MAX_CHARACTERS,
  isRewriteAudience,
  isRewriteGoal,
  type RewriteAudience,
  type RewriteGoal,
} from "../rewrite-options";
import { buildRewritePrompt, findMissingFacts, parseRewriteContent } from "../rewrite-prompt";

/**
 * Reescrita com IA da Legibilidade. Separada da análise: com a IA
 * desligada (READABILITY_AI_DISABLED=true) ou sem provedor configurado, a
 * análise continua igual. Depois da reescrita, o texto novo passa de novo
 * pelo MESMO cálculo determinístico (antes × depois).
 */

export class RewriteError extends Error {
  constructor(message: string, readonly code: string, readonly status: number) {
    super(message);
    this.name = "RewriteError";
  }
}

export function isRewriteEnabled(): boolean {
  return process.env.READABILITY_AI_DISABLED !== "true";
}

export interface RewriteQuota {
  used: number;
  limit: number;
  unlimited: boolean;
}

function startOfUtcDay(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export async function getRewriteQuota(userId: string, email: string | null | undefined, now = new Date()): Promise<RewriteQuota> {
  const db = getDb();
  const [row] = await db`
    select count(*)::int as total from readability_rewrites
    where user_id = ${userId} and success = true and created_at >= ${startOfUtcDay(now).toISOString()}
  `;
  return { used: Number(row?.total ?? 0), limit: REWRITE_DAILY_LIMIT, unlimited: isAdminEmail(email) };
}

export interface ScoreSummary {
  score: number | null;
  levelLabel: string | null;
  words: number;
  complexWords: number;
  longSentences: number;
}

function summarize(result: ReadabilityResult): ScoreSummary {
  return { score: result.score, levelLabel: result.levelLabel, words: result.words, complexWords: result.complexWords, longSentences: result.longSentences };
}

export interface RewriteResult {
  text: string;
  parts: { hook: string; body: string; cta: string } | null;
  before: ScoreSummary;
  after: ScoreSummary;
  /** false quando a nova versão não ficou mais simples (nota igual ou menor). */
  improved: boolean;
  /** Números/links/e-mails do original que não aparecem na nova versão. */
  missingFacts: string[];
  quota: RewriteQuota;
}

async function recordUsage(entry: {
  userId: string;
  goal: string;
  audience: string;
  characterCount: number;
  success: boolean;
  errorCode: string | null;
  durationMs: number;
  scoreBefore: number | null;
  scoreAfter: number | null;
}): Promise<void> {
  try {
    const db = getDb();
    await db`
      insert into readability_rewrites (user_id, goal, audience, character_count, success, error_code, duration_ms, score_before, score_after)
      values (${entry.userId}, ${entry.goal}, ${entry.audience}, ${entry.characterCount}, ${entry.success}, ${entry.errorCode}, ${entry.durationMs}, ${entry.scoreBefore}, ${entry.scoreAfter})
    `;
  } catch (error) {
    console.error(JSON.stringify({ scope: "readability", event: "usage_record_failed", message: error instanceof Error ? error.message : String(error) }));
  }
  // Nunca o texto: só metadados.
  console.info(JSON.stringify({ scope: "readability", operation: "rewrite", userId: entry.userId, goal: entry.goal, characterCount: entry.characterCount, durationMs: entry.durationMs, success: entry.success, errorCode: entry.errorCode }));
}

export async function rewriteText(
  user: { userId: string; email: string | null | undefined },
  input: { text?: unknown; goal?: unknown; audience?: unknown },
): Promise<RewriteResult> {
  if (!isRewriteEnabled()) throw new RewriteError("A reescrita com IA está desativada no momento. A análise continua disponível.", "DISABLED", 503);
  const text = typeof input.text === "string" ? input.text.trim() : "";
  if (!text) throw new RewriteError("Digite um texto para simplificar.", "EMPTY", 400);
  if (text.length > REWRITE_MAX_CHARACTERS) {
    throw new RewriteError(`Para reescrever com IA, use até ${REWRITE_MAX_CHARACTERS.toLocaleString("pt-BR")} caracteres por vez.`, "TOO_LONG", 413);
  }
  const goal: RewriteGoal = isRewriteGoal(input.goal) ? input.goal : "simplify";
  const audience: RewriteAudience = isRewriteAudience(input.audience) ? input.audience : "general";

  const quota = await getRewriteQuota(user.userId, user.email);
  if (!quota.unlimited && quota.used >= quota.limit) {
    throw new RewriteError(`Você atingiu o limite de ${quota.limit} reescritas com IA por hoje. A análise continua liberada.`, "DAILY_LIMIT", 429);
  }

  const before = analyzeReadability(text);
  const startedAt = Date.now();
  const fail = async (code: string, message: string, status: number): Promise<never> => {
    await recordUsage({ userId: user.userId, goal, audience, characterCount: text.length, success: false, errorCode: code, durationMs: Date.now() - startedAt, scoreBefore: before.score, scoreAfter: null });
    throw new RewriteError(message, code, status);
  };

  let content: Record<string, unknown>;
  try {
    const provider = getContentAIProvider();
    if (!provider.rewriteText) return fail("NOT_SUPPORTED", "A reescrita com IA não está disponível agora.", 503);
    // Saída proporcional ao texto (pt-BR ≈ 3,5 caracteres por token), com folga.
    const maxOutputTokens = Math.min(4000, Math.max(600, Math.ceil(text.length / 2.5)));
    ({ content } = await provider.rewriteText({ prompt: buildRewritePrompt(text, goal, audience), maxOutputTokens }));
  } catch (error) {
    if (error instanceof RewriteError) throw error;
    if (error instanceof AIProviderConfigError) return fail("NOT_CONFIGURED", "A reescrita com IA não está configurada.", 503);
    if (error instanceof AIProviderRequestError && /tempo esgotado/i.test(error.message)) {
      return fail("TIMEOUT", "A IA demorou demais para responder. Tente novamente.", 504);
    }
    return fail("PROVIDER_ERROR", "Não conseguimos simplificar o texto agora. Tente novamente.", 502);
  }

  const parsed = parseRewriteContent(goal, content);
  if (!parsed) return fail("EMPTY_RESPONSE", "A IA não devolveu um texto. Tente novamente.", 502);

  const after = analyzeReadability(parsed.text);
  await recordUsage({ userId: user.userId, goal, audience, characterCount: text.length, success: true, errorCode: null, durationMs: Date.now() - startedAt, scoreBefore: before.score, scoreAfter: after.score });
  return {
    text: parsed.text,
    parts: parsed.parts,
    before: summarize(before),
    after: summarize(after),
    improved: before.score !== null && after.score !== null ? after.score > before.score : false,
    missingFacts: goal === "hook" ? [] : findMissingFacts(text, parsed.text),
    quota: { ...quota, used: quota.used + 1 },
  };
}
