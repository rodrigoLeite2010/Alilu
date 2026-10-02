import "server-only";
import { Resend } from "resend";
import { getDb } from "@/lib/db/client";

/**
 * Webhook da Resend (resend.com/docs/dashboard/webhooks): assinado via
 * Svix (cabeçalhos svix-id / svix-timestamp / svix-signature). A
 * verificação usa o método oficial do SDK (resend.webhooks.verify) sobre o
 * CORPO CRU — nunca sobre JSON re-serializado. Idempotência pelo svix-id.
 *
 * Efeitos:
 *   email.sent/delivered/delivery_delayed/bounced/complained/failed/suppressed
 *   → atualiza email_delivery_logs (status, datas, último evento);
 *   bounce permanente, reclamação de spam ou supressão → email_suppressions
 *   (lembretes param de ir para o endereço). Bounce temporário: conta e,
 *   a partir de 3, também suprime.
 */

export class WebhookSignatureError extends Error {}

const STATUS_BY_EVENT: Record<string, string> = {
  "email.sent": "SENT",
  "email.delivered": "DELIVERED",
  "email.delivery_delayed": "DELAYED",
  "email.bounced": "BOUNCED",
  "email.complained": "COMPLAINED",
  "email.failed": "FAILED",
  "email.suppressed": "SUPPRESSED",
};

const TEMP_BOUNCES_BEFORE_SUPPRESSION = 3;

interface VerifiedEvent {
  type: string;
  created_at?: string;
  data?: {
    email_id?: string;
    to?: string[];
    bounce?: { type?: string; subType?: string; message?: string };
    failed?: { reason?: string };
  };
}

export function verifyResendWebhook(rawBody: string, headers: { id: string | null; timestamp: string | null; signature: string | null }): VerifiedEvent {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) throw new WebhookSignatureError("RESEND_WEBHOOK_SECRET não configurada.");
  if (!headers.id || !headers.timestamp || !headers.signature) throw new WebhookSignatureError("Cabeçalhos de assinatura ausentes.");
  try {
    // A verificação não usa a API key; o SDK só exige uma no construtor.
    const resend = new Resend(process.env.RESEND_API_KEY || "re_webhook_verify_only");
    return resend.webhooks.verify({
      payload: rawBody,
      headers: { id: headers.id, timestamp: headers.timestamp, signature: headers.signature },
      webhookSecret: secret,
    }) as unknown as VerifiedEvent;
  } catch {
    throw new WebhookSignatureError("Assinatura inválida.");
  }
}

export async function processResendWebhookEvent(eventId: string, event: VerifiedEvent): Promise<"processed" | "duplicate" | "ignored"> {
  const db = getDb();
  const messageId = event.data?.email_id ?? null;
  const inserted = await db`
    insert into email_webhook_events (event_id, event_type, provider_message_id)
    values (${eventId}, ${event.type}, ${messageId})
    on conflict (event_id) do nothing
    returning event_id
  `;
  if (inserted.length === 0) return "duplicate";
  try {
    return await applyEvent(event, messageId);
  } catch (error) {
    // Falhou no meio: libera o id para a Resend reenviar e o evento ser aplicado.
    await db`delete from email_webhook_events where event_id = ${eventId}`.catch(() => undefined);
    throw error;
  }
}

async function applyEvent(event: VerifiedEvent, messageId: string | null): Promise<"processed" | "ignored"> {
  const db = getDb();

  const status = STATUS_BY_EVENT[event.type];
  if (!status || !messageId) return "ignored";

  const at = event.created_at ? new Date(event.created_at) : new Date();
  const when = Number.isNaN(at.getTime()) ? new Date() : at;
  const errorMessage =
    event.type === "email.bounced"
      ? `${event.data?.bounce?.type ?? ""} ${event.data?.bounce?.subType ?? ""}: ${event.data?.bounce?.message ?? ""}`.trim().slice(0, 500)
      : event.type === "email.failed"
        ? (event.data?.failed?.reason ?? "falha").slice(0, 500)
        : null;
  const failed = ["BOUNCED", "COMPLAINED", "FAILED", "SUPPRESSED"].includes(status);

  // "Entregue" não volta para "enviado" se os eventos chegarem fora de ordem.
  await db`
    update email_delivery_logs set
      status = case when status = 'DELIVERED' and ${status} in ('SENT', 'DELAYED') then status else ${status} end,
      last_provider_event = ${event.type},
      delivered_at = case when ${status} = 'DELIVERED' then ${when.toISOString()}::timestamptz else delivered_at end,
      failed_at = case when ${failed} then ${when.toISOString()}::timestamptz else failed_at end,
      error_message = coalesce(${errorMessage}, error_message)
    where provider_message_id = ${messageId}
  `;

  const recipients = (event.data?.to ?? []).map((email) => email.trim().toLowerCase()).filter(Boolean);
  for (const email of recipients) {
    if (event.type === "email.complained" || event.type === "email.suppressed" || (event.type === "email.bounced" && (event.data?.bounce?.type ?? "").toLowerCase() === "permanent")) {
      await db`
        insert into email_suppressions (email, reason, bounce_count) values (${email}, ${event.type}, ${event.type === "email.bounced" ? 1 : 0})
        on conflict (email) do update set reason = excluded.reason, last_event_at = now(),
          bounce_count = email_suppressions.bounce_count + excluded.bounce_count
      `;
    } else if (event.type === "email.bounced") {
      // Bounce temporário: só suprime depois de vários em 30 dias.
      const [row] = await db`
        select count(*)::int as total from email_webhook_events w
        join email_delivery_logs l on l.provider_message_id = w.provider_message_id
        where w.event_type = 'email.bounced' and l.to_email = ${email} and w.received_at > now() - interval '30 days'
      `;
      if (Number(row?.total ?? 0) >= TEMP_BOUNCES_BEFORE_SUPPRESSION) {
        await db`
          insert into email_suppressions (email, reason, bounce_count) values (${email}, 'repeated_bounces', ${Number(row.total)})
          on conflict (email) do update set reason = excluded.reason, bounce_count = excluded.bounce_count, last_event_at = now()
        `;
      }
    }
  }
  console.info(JSON.stringify({ scope: "email", event: "webhook", type: event.type, providerMessageId: messageId }));
  return "processed";
}
