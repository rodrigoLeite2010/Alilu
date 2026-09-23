import { randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Proteção CSRF do fluxo OAuth de conexão da conta do Instagram. Lógica
 * pura (sem "server-only", sem banco) — o cookie em si é gravado/lido nas
 * rotas app/api/instagram/oauth/start e .../callback.
 *
 * `state` é gerado no início do fluxo, guardado num cookie HttpOnly restrito
 * ao path do próprio fluxo OAuth, e comparado (nunca confiando só no valor
 * que volta na query string do callback) contra o valor do cookie.
 */

export const INSTAGRAM_OAUTH_STATE_COOKIE = "ig_oauth_state";
export const OAUTH_STATE_MAX_AGE_SECONDS = 600; // 10 minutos

/** Gera um valor aleatório e imprevisível para o parâmetro `state` do OAuth. */
export function generateOAuthState(): string {
  return randomBytes(24).toString("hex");
}

/**
 * Compara o `state` recebido no callback com o valor gravado no cookie no
 * início do fluxo. Usa `timingSafeEqual` (após igualar o tamanho) para não
 * vazar informação por tempo de resposta; nunca confia no `state` da query
 * string sozinho.
 */
export function isValidOAuthState(
  stateFromCallback: string | undefined | null,
  stateFromCookie: string | undefined | null,
): boolean {
  if (!stateFromCallback || !stateFromCookie) return false;

  const callbackBuffer = Buffer.from(stateFromCallback);
  const cookieBuffer = Buffer.from(stateFromCookie);
  if (callbackBuffer.length !== cookieBuffer.length) return false;

  return timingSafeEqual(callbackBuffer, cookieBuffer);
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
