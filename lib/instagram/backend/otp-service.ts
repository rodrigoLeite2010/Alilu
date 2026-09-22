import "server-only";
import {
  countRecentOtpRequests,
  findLatestOtpForEmail,
  incrementOtpAttempts,
  insertOtpCode,
  markOtpConsumed,
} from "./otp-repository";
import {
  OTP_EXPIRY_MINUTES,
  OTP_MAX_ATTEMPTS,
  OTP_MAX_REQUESTS_PER_HOUR,
  generateOtpCode,
  hashOtpCode,
  normalizeEmail,
  verifyOtpCode,
} from "./otp";

/**
 * Regra de negócio do login por código de e-mail. Cada erro tem uma classe
 * própria para que a rota de API e o provider do NextAuth (auth.ts)
 * consigam decidir a mensagem certa sem depender de comparar strings.
 */

export class OtpRateLimitError extends Error {}
export class OtpInvalidError extends Error {}
export class OtpExpiredError extends Error {}
export class OtpTooManyAttemptsError extends Error {}

export async function requestOtp(rawEmail: string): Promise<{ code: string }> {
  const email = normalizeEmail(rawEmail);

  const recentCount = await countRecentOtpRequests(email, 60);
  if (recentCount >= OTP_MAX_REQUESTS_PER_HOUR) {
    throw new OtpRateLimitError(
      "Muitos pedidos de código para este e-mail na última hora. Tente novamente mais tarde.",
    );
  }

  const code = generateOtpCode();
  const codeHash = hashOtpCode(code);
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60_000);

  await insertOtpCode(email, codeHash, expiresAt);

  return { code };
}

export async function verifyOtp(rawEmail: string, submittedCode: string): Promise<void> {
  const email = normalizeEmail(rawEmail);

  const record = await findLatestOtpForEmail(email);
  if (!record) {
    throw new OtpInvalidError("Nenhum código pendente para este e-mail. Peça um novo código.");
  }
  if (record.consumedAt) {
    throw new OtpInvalidError("Este código já foi usado. Peça um novo código.");
  }
  if (record.expiresAt.getTime() < Date.now()) {
    throw new OtpExpiredError("Código expirado. Peça um novo código.");
  }
  if (record.attempts >= OTP_MAX_ATTEMPTS) {
    throw new OtpTooManyAttemptsError("Número máximo de tentativas excedido. Peça um novo código.");
  }

  const isValid = verifyOtpCode(submittedCode, record.codeHash);
  if (!isValid) {
    await incrementOtpAttempts(record.id);
    throw new OtpInvalidError("Código incorreto.");
  }

  await markOtpConsumed(record.id);
}
