import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Lógica pura do login por código de e-mail (OTP) — sem acesso a banco ou
 * a nenhum segredo de ambiente, por isso totalmente testável sem mocks.
 * A orquestração com o banco vive em otp-repository.ts/otp-service.ts.
 */

export const OTP_CODE_LENGTH = 6;
export const OTP_EXPIRY_MINUTES = 10;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_MAX_REQUESTS_PER_HOUR = 5;

/** Gera um código numérico de OTP_CODE_LENGTH dígitos, sempre com zeros à esquerda. */
export function generateOtpCode(): string {
  const max = 10 ** OTP_CODE_LENGTH;
  const value = randomBytes(4).readUInt32BE(0) % max;
  return value.toString().padStart(OTP_CODE_LENGTH, "0");
}

/**
 * Formato do hash armazenado: "<salt em hex>.<hash sha256 em hex>". O sal
 * evita que o mesmo código gere sempre o mesmo hash (o que ajudaria um
 * ataque de dicionário num vazamento do banco), mas a proteção real contra
 * força bruta vem de OTP_MAX_ATTEMPTS + OTP_EXPIRY_MINUTES no serviço, já
 * que o espaço de 6 dígitos é pequeno demais para o hash sozinho proteger.
 */
export function hashOtpCode(code: string): string {
  const salt = randomBytes(16);
  const hash = createHash("sha256").update(salt).update(code).digest();
  return `${salt.toString("hex")}.${hash.toString("hex")}`;
}

export function verifyOtpCode(code: string, storedHash: string): boolean {
  const parts = storedHash.split(".");
  if (parts.length !== 2) return false;

  const [saltHex, hashHex] = parts;
  let salt: Buffer;
  let expected: Buffer;
  try {
    salt = Buffer.from(saltHex, "hex");
    expected = Buffer.from(hashHex, "hex");
  } catch {
    return false;
  }

  const actual = createHash("sha256").update(salt).update(code).digest();
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Validação conservadora e deliberadamente simples (não é o RFC 5322
 * completo): existe um "@", algo antes, algo com um "." depois, sem
 * espaços. O objetivo é barrar entradas obviamente inválidas antes de
 * gastar uma requisição ao Resend — não é a fonte da verdade sobre se o
 * e-mail existe de verdade (isso só o próprio envio/confirmação garante).
 */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
