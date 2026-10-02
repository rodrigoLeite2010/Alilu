import "server-only";
import { Resend } from "resend";
import type { EmailProvider, ProviderSendInput, ProviderSendResult } from "../types";

/**
 * Resend (SDK oficial `resend` para Node — resend.com/docs). O cliente é
 * criado sob demanda: RESEND_API_KEY só é exigida na hora de enviar. A
 * chave nunca é logada. Use uma chave "Sending access" restrita ao domínio.
 *
 * Idempotency-Key (24 h na Resend): reenviar a mesma chave devolve a mesma
 * resposta sem mandar o e-mail de novo — é o que garante "lembrete nunca
 * duplicado" mesmo se a resposta se perder num timeout.
 */

let cached: Resend | null = null;

function client(): Resend {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY não está configurada.");
  if (!cached) cached = new Resend(key);
  return cached;
}

/** Só para testes. */
export function __resetResendClientForTests(): void {
  cached = null;
}

const RETRYABLE = new Set(["rate_limit_exceeded", "application_error", "internal_server_error", "concurrent_idempotent_requests"]);

export const resendEmailProvider: EmailProvider = {
  id: "resend",
  async send(input: ProviderSendInput): Promise<ProviderSendResult> {
    let resend: Resend;
    try {
      resend = client();
    } catch (error) {
      return { ok: false, providerMessageId: null, retryable: false, error: (error as Error).message };
    }
    try {
      const { data, error } = await resend.emails.send(
        {
          from: input.from,
          to: input.to,
          subject: input.subject,
          html: input.html,
          text: input.text,
          ...(input.replyTo ? { replyTo: input.replyTo } : {}),
          tags: input.tags,
        },
        input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : undefined,
      );
      if (error) {
        const retryable = RETRYABLE.has(error.name) || (error.statusCode !== null && error.statusCode >= 500) || error.statusCode === 429;
        return { ok: false, providerMessageId: null, retryable, error: `${error.name}: ${error.message}`.slice(0, 500) };
      }
      return { ok: true, providerMessageId: data?.id ?? null, retryable: false, error: null };
    } catch (error) {
      // Rede/timeout: pode tentar de novo (a Idempotency-Key evita duplicar).
      return { ok: false, providerMessageId: null, retryable: true, error: `network: ${(error as Error)?.message ?? "erro"}`.slice(0, 500) };
    }
  },
};
