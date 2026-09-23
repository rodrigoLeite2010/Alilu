import "server-only";
import { getDb } from "@/lib/db/client";
import type { AIGenerationUsage } from "./ai-provider";

/** Registro de uso de IA por execução (seção 40) — nunca bloqueia a geração se falhar. */
export async function recordGenerationUsage(
  automationId: string,
  runId: string,
  usage: AIGenerationUsage,
): Promise<void> {
  try {
    const db = getDb();
    await db`
      insert into generation_usage (automation_id, run_id, provider, model, tokens_input, tokens_output)
      values (${automationId}, ${runId}, ${usage.provider}, ${usage.model}, ${usage.tokensInput}, ${usage.tokensOutput})
    `;
  } catch {
    // Registro de uso é "melhor esforço" — nunca pode derrubar a geração.
  }
}
