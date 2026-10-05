import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Proteção CSRF do fluxo OAuth de conexão da conta do Instagram. Lógica
 * pura (sem "server-only", sem banco) — o cookie em si é gravado/lido nas
 * rotas app/api/instagram/oauth/start e .../callback.
 *
 * O `state` tem três partes: `<aleatório>.<emitido-em>.<assinatura>`.
 *  - aleatório: 24 bytes criptograficamente seguros;
 *  - emitido-em: segundos desde a época (expira em 10 min);
 *  - assinatura: HMAC-SHA256(aleatório.emitido-em.userId) com o segredo do
 *    servidor — prende o state ao usuário do Alilu que começou o fluxo.
 * No callback ele precisa (1) ter assinatura válida para o usuário,
 * (2) não ter expirado e (3) bater com o cookie HttpOnly deste navegador
 * OU com a sessão logada do mesmo usuário (celular que volta da Meta em
 * outro navegador). Assim um state gerado para outra pessoa nunca liga a
 * conta do Instagram de alguém à conta errada do Alilu.
 */

export const INSTAGRAM_OAUTH_STATE_COOKIE = "ig_oauth_state";
export const INSTAGRAM_OAUTH_CORRELATION_COOKIE = "ig_oauth_correlation";
export const OAUTH_STATE_MAX_AGE_SECONDS = 600; // 10 minutos

function stateSecret(): string {
  const secret = process.env.INSTAGRAM_OAUTH_STATE_SECRET || process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || process.env.INSTAGRAM_TOKEN_ENCRYPTION_KEY;
  if (!secret) throw new Error("Segredo do state OAuth ausente (AUTH_SECRET).");
  return secret;
}

function sign(nonce: string, issuedAt: string, userId: string): string {
  return createHmac("sha256", stateSecret()).update(`${nonce}.${issuedAt}.${userId}`).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/** Gera um `state` assinado e preso ao usuário do Alilu. */
export function generateOAuthState(userId: string, now: Date = new Date()): string {
  const nonce = randomBytes(24).toString("base64url");
  const issuedAt = String(Math.floor(now.getTime() / 1000));
  return `${nonce}.${issuedAt}.${sign(nonce, issuedAt, userId)}`;
}

/** ID curto para correlacionar start → callback nos logs, sem expor state/code/token. */
export function generateOAuthCorrelationId(): string {
  return randomBytes(12).toString("base64url");
}

export type OAuthStateCheck = "ok" | "missing" | "malformed" | "expired" | "bad_signature";

/** Valida assinatura (para este usuário) e validade de tempo. */
export function verifySignedOAuthState(state: string | null | undefined, userId: string, now: Date = new Date()): OAuthStateCheck {
  if (!state) return "missing";
  const parts = state.split(".");
  if (parts.length !== 3 || !/^\d{9,11}$/.test(parts[1])) return "malformed";
  const [nonce, issuedAt, signature] = parts;
  const age = Math.floor(now.getTime() / 1000) - Number(issuedAt);
  if (age < -60 || age > OAUTH_STATE_MAX_AGE_SECONDS) return "expired";
  return safeEqual(signature, sign(nonce, issuedAt, userId)) ? "ok" : "bad_signature";
}

/**
 * Compara o `state` recebido no callback com o valor gravado no cookie no
 * início do fluxo (tempo constante). Nunca confia só na query string.
 */
export function isValidOAuthState(stateFromCallback: string | undefined | null, stateFromCookie: string | undefined | null): boolean {
  if (!stateFromCallback || !stateFromCookie) return false;
  return safeEqual(stateFromCallback, stateFromCookie);
}

/** Cookie com o caminho interno para onde voltar depois de conectar o Instagram. */
export const INSTAGRAM_OAUTH_RETURN_COOKIE = "ig_oauth_return";

/**
 * Aceita só caminhos internos da área Instagram (nunca URL absoluta nem
 * "//dominio" — evita open redirect). Retorna null quando inválido.
 */
export function sanitizeOAuthReturnPath(value: string | null | undefined): string | null {
  if (!value || value.length > 300) return null;
  if (!value.startsWith("/instagram")) return null;
  if (value.startsWith("//") || value.includes("\\") || /[\u0000-\u001f]/.test(value)) return null;
  try {
    const url = new URL(value, "https://alilu.invalid");
    if (url.origin !== "https://alilu.invalid") return null;
    return `${url.pathname}${url.search}`;
  } catch {
    return null;
  }
}
