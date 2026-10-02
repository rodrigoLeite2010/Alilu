import "server-only";
import { getDb } from "@/lib/db/client";
import { getEmailSender } from "./config";
import { resendEmailProvider } from "./providers/resend-provider";
import type { EmailMessage, EmailProvider, EmailSendResult } from "./types";

/**
 * EmailService: único ponto de envio de e-mail transacional do Alilu.
 * Registra cada envio em email_delivery_logs (só metadados — nunca o
 * conteúdo, nunca o código de login), respeita a lista de supressão
 * (bounce/spam) e repassa a Idempotency-Key ao provedor.
 */

let providerOverride: EmailProvider | null = null;

export function getEmailProvider(): EmailProvider {
  return providerOverride ?? resendEmailProvider;
}

/** Só para testes. */
export function __setEmailProviderForTests(provider: EmailProvider | null): void {
  providerOverride = provider;
}

/** Login por código ignora a supressão (a pessoa está pedindo agora); lembretes respeitam. */
const SUPPRESSION_EXEMPT = new Set(["LOGIN_CODE", "ADMIN_TEST"]);

export async function isEmailSuppressed(email: string): Promise<boolean> {
  const db = getDb();
  const rows = await db`select 1 from email_suppressions where email = ${email.trim().toLowerCase()} limit 1`;
  return rows.length > 0;
}

export async function sendEmail(message: EmailMessage): Promise<EmailSendResult> {
  const db = getDb();
  const to = message.to.trim().toLowerCase();
  const provider = getEmailProvider();

  if (!SUPPRESSION_EXEMPT.has(message.type) && (await isEmailSuppressed(to))) {
    await db`
      insert into email_delivery_logs (user_id, to_email, email_type, provider, status, reference_type, reference_id, error_message, failed_at)
      values (${message.userId ?? null}, ${to}, ${message.type}, ${provider.id}, 'SUPPRESSED', ${message.referenceType ?? null},
        ${message.referenceId ?? null}, 'Endereço suprimido (bounce/spam).', now())
    `;
    return { ok: false, providerMessageId: null, retryable: false, suppressed: true, error: "suppressed", logId: null };
  }

  const sender = getEmailSender();
  const [log] = await db`
    insert into email_delivery_logs (user_id, to_email, email_type, provider, status, reference_type, reference_id)
    values (${message.userId ?? null}, ${to}, ${message.type}, ${provider.id}, 'SENDING', ${message.referenceType ?? null}, ${message.referenceId ?? null})
    returning id
  `;
  const logId = log.id as string;

  const result = await provider.send({
    from: sender.from,
    replyTo: sender.replyTo,
    to,
    subject: message.subject,
    html: message.html,
    text: message.text,
    idempotencyKey: message.idempotencyKey ?? null,
    tags: [{ name: "type", value: message.type.toLowerCase() }],
  });

  if (result.ok) {
    try {
      await db`update email_delivery_logs set status = 'QUEUED', provider_message_id = ${result.providerMessageId} where id = ${logId}`;
    } catch {
      // Mesma Idempotency-Key devolveu o mesmo id já registrado em outro log: mantém este sem o id.
      await db`update email_delivery_logs set status = 'QUEUED' where id = ${logId}`;
    }
  } else {
    await db`update email_delivery_logs set status = 'ERROR', error_message = ${result.error}, failed_at = now() where id = ${logId}`;
  }
  console.info(
    JSON.stringify({ scope: "email", event: result.ok ? "sent" : "send_failed", emailType: message.type, provider: provider.id, providerMessageId: result.providerMessageId, logId, retryable: result.retryable }),
  );
  return { ...result, logId };
}
