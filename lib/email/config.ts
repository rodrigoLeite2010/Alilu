import "server-only";

/**
 * Remetente e resposta. EMAIL_FROM (novo) com fallback para
 * RESEND_FROM_EMAIL (já usado pelo login) — nada quebra para quem já
 * configurou. Ex.: "Alilu <noreply@alilu.com.br>" (domínio verificado na Resend).
 */
export class EmailNotConfiguredError extends Error {}

export function getEmailSender(): { from: string; replyTo: string | null } {
  const from = (process.env.EMAIL_FROM || process.env.RESEND_FROM_EMAIL || "").trim();
  if (!from) throw new EmailNotConfiguredError("EMAIL_FROM (ou RESEND_FROM_EMAIL) não está configurada.");
  const replyTo = (process.env.EMAIL_REPLY_TO || "").trim() || null;
  return { from, replyTo };
}
