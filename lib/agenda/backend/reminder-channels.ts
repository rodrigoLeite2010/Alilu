import "server-only";
import { sendEmail } from "@/lib/email/email-service";
import { agendaReminderEmail } from "@/lib/email/templates/agenda";

/**
 * Canais de lembrete. Hoje só EMAIL (via EmailService/Resend). SMS,
 * WhatsApp e Push entram como novas implementações desta interface —
 * sem mexer na regra de agendamento (reminder-service.ts).
 */

export interface ReminderMessage {
  reminderId: string;
  userId: string;
  to: string;
  firstName: string | null;
  title: string;
  whenLabel: string;
  location: string | null;
  url: string;
}

export interface ReminderSendResult {
  ok: boolean;
  providerMessageId: string | null;
  retryable: boolean;
  skipped: boolean;
  error: string | null;
}

export interface ReminderChannelSender {
  readonly channel: "EMAIL" | "SMS" | "WHATSAPP" | "PUSH";
  send(message: ReminderMessage): Promise<ReminderSendResult>;
}

export const emailReminderSender: ReminderChannelSender = {
  channel: "EMAIL",
  async send(message) {
    const email = agendaReminderEmail({
      firstName: message.firstName,
      title: message.title,
      whenLabel: message.whenLabel,
      location: message.location,
      url: message.url,
    });
    const result = await sendEmail({
      ...email,
      to: message.to,
      type: "AGENDA_REMINDER",
      userId: message.userId,
      referenceType: "agenda_reminder",
      referenceId: message.reminderId,
      // Mesmo lembrete = mesma chave: a Resend nunca envia duas vezes (24 h).
      idempotencyKey: `agenda-reminder/${message.reminderId}`,
    });
    return {
      ok: result.ok,
      providerMessageId: result.providerMessageId,
      retryable: result.retryable,
      skipped: Boolean(result.suppressed),
      error: result.error,
    };
  },
};

const senders: Record<string, ReminderChannelSender> = { EMAIL: emailReminderSender };
let override: Record<string, ReminderChannelSender> | null = null;

export function getReminderSender(channel: string): ReminderChannelSender | null {
  return (override ?? senders)[channel] ?? null;
}

/** Só para testes. */
export function __setReminderSendersForTests(value: Record<string, ReminderChannelSender> | null): void {
  override = value;
}
