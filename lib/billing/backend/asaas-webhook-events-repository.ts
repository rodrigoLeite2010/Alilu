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
 * Tenta gravar o evento. Devolve `true` se o evento deve ser processado:
 * é a PRIMEIRA vez que esse event_id é visto, OU ele já foi gravado antes
 * mas o processamento anterior falhou no meio (processed_at ainda nulo —
 * ex.: o Asaas ficou fora do ar na consulta GET /payments e a rota
 * respondeu 500). Devolve `false` só quando o evento JÁ FOI processado
 * com sucesso (duplicado de verdade — o chamador responde 200 sem
 * reprocessar nada).
 *
 * Sem isso, uma falha momentânea "queimava" o evento: a reentrega do
 * Asaas caía como duplicada e o cliente pagava sem ter o acesso liberado.
 * Reprocessar é seguro — os handlers (markActiveFromPayment, markPastDue,
 * markCanceledByAsaasSubscriptionId) são UPDATEs idempotentes.
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
    on conflict (event_id) do update
    set payload = excluded.payload,
        received_at = now()
    where asaas_webhook_events.processed_at is null
    returning id
  `;
  return rows.length > 0;
}

export async function markWebhookEventProcessed(eventId: string): Promise<void> {
  const db = getDb();
  await db`update asaas_webhook_events set processed_at = now() where event_id = ${eventId}`;
}
