import "server-only";
import { getDb } from "@/lib/db/client";

/**
 * Uso de IA de texto por usuário (tabela generation_usage, que o Piloto já
 * usava e passou a aceitar usos avulsos — migração 0031). Serve para
 * (1) o teto diário do botão de IA do compositor e (2) medir o custo real
 * de IA por usuário — só análise interna, o usuário nunca é cobrado por token.
 */

export async function countAiUsageSince(userId: string, feature: string, since: Date): Promise<number> {
  const db = getDb();
  const rows = await db`
    select count(*) as total from generation_usage
    where user_id = ${userId} and feature = ${feature} and created_at >= ${since.toISOString()}
  `;
  return Number(rows[0]?.total ?? 0);
}

export interface UserAiUsageInput {
  userId: string;
  feature: string;
  provider: string;
  model: string;
  tokensInput: number | null;
  tokensOutput: number | null;
}

/** Melhor esforço: nunca derruba a geração se o registro falhar. */
export async function recordUserAiUsage(input: UserAiUsageInput): Promise<void> {
  try {
    const db = getDb();
    await db`
      insert into generation_usage (user_id, feature, provider, model, tokens_input, tokens_output)
      values (${input.userId}, ${input.feature}, ${input.provider}, ${input.model}, ${input.tokensInput}, ${input.tokensOutput})
    `;
  } catch {
    // registro de uso nunca atrapalha o usuário
  }
}
