/**
 * Tipos do envio de e-mail transacional (independente de provedor).
 * Regras de negócio (login, Agenda…) só conhecem estes tipos; o provedor
 * (hoje Resend) fica atrás de EmailProvider — trocar por SendGrid/SES é
 * uma nova implementação, sem mexer nas regras.
 */

export type EmailType = "LOGIN_CODE" | "AGENDA_REMINDER" | "AGENDA_CHANGED" | "AGENDA_CANCELLED" | "ADMIN_TEST";

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

export interface EmailMessage extends RenderedEmail {
  to: string;
  type: EmailType;
  userId?: string | null;
  /** Ligação para observabilidade (ex.: agenda_reminder / id). */
  referenceType?: string | null;
  referenceId?: string | null;
  /** Mesma chave = o provedor não envia de novo (Resend guarda por 24 h). */
  idempotencyKey?: string | null;
}

export interface EmailSendResult {
  ok: boolean;
  providerMessageId: string | null;
  /** Vale tentar de novo (429/5xx/rede)? */
  retryable: boolean;
  /** Endereço suprimido (bounce/spam) — não foi enviado. */
  suppressed?: boolean;
  error: string | null;
  logId: string | null;
}

export interface ProviderSendInput {
  from: string;
  replyTo: string | null;
  to: string;
  subject: string;
  html: string;
  text: string;
  idempotencyKey: string | null;
  tags: Array<{ name: string; value: string }>;
}

export interface ProviderSendResult {
  ok: boolean;
  providerMessageId: string | null;
  retryable: boolean;
  error: string | null;
}

export interface EmailProvider {
  readonly id: string;
  send(input: ProviderSendInput): Promise<ProviderSendResult>;
}
