import "server-only";
import { getDb } from "@/lib/db/client";

/**
 * Acesso a asaas_webhook_events — só a trava de idempotência do
 * processamento do Webhook (o Asaas garante apenas "at least once": o
 * mesmo evento pode chegar mais de uma vez). Mesmo padrão de "insert ...
 * on conflict do nothing" já usado em ensureRunForDate
 * (automation-run-repository.ts).
 */

/**
 * Tenta gravar o evento. Devolve `true` se é a PRIMEIRA vez que esse
 * event_id é visto (deve processar); `false` se já existia (duplicado —
 * o chamador deve responder 200 sem reprocessar nada).
 */
export async function recordWebhookEventOnce(
  eventId: string,
  eventType: string,
  payload: unknown,
): Promise<boolean> {
  const db = getDb();
  const rows = await db`
    insert into asaas_webhook_events (event_id, event_type, payload)
    values (${eventId}, ${eventType}, ${JSON.stringify(payload)})
    on conflict (event_id) do nothing
    returning id
  `;
  return rows.length > 0;
}

export async function markWebhookEventProcessed(eventId: string): Promise<void> {
  const db = getDb();
  await db`update asaas_webhook_events set processed_at = now() where event_id = ${eventId}`;
}
