import "server-only";
import { getDb } from "@/lib/db/client";
import { normalizeEmail } from "@/lib/instagram/backend/otp";

/**
 * Conta desativada pelo admin (users.disabled_at). A sessão é JWT, então a
 * checagem acontece no callback `session` do Auth.js (auth.ts): conta
 * desativada vira "sem login" em toda parte, na hora. Para não consultar o
 * banco a cada leitura de sessão, o resultado fica 15 s em memória por
 * instância (a desativação vale em até ~15 s em qualquer instância e
 * imediatamente na que aplicou). Falha de banco = NÃO desativada (uma
 * instabilidade nunca desloga todo mundo).
 */

const TTL_MS = 15_000;
const cache = new Map<string, { disabled: boolean; at: number }>();

export function invalidateUserStatusCache(userId?: string): void {
  if (userId) cache.delete(userId);
  else cache.clear();
}

export async function isUserDisabled(userId: string, now: number = Date.now()): Promise<boolean> {
  const hit = cache.get(userId);
  if (hit && now - hit.at < TTL_MS) return hit.disabled;
  try {
    const rows = await getDb()`select disabled_at is not null as disabled from users where id = ${userId}`;
    const disabled = Boolean(rows[0]?.disabled);
    cache.set(userId, { disabled, at: now });
    return disabled;
  } catch {
    return false;
  }
}

/** Usado no login (antes de criar a sessão): conta desativada não entra. */
export async function isEmailDisabled(rawEmail: string): Promise<boolean> {
  try {
    const rows = await getDb()`select disabled_at is not null as disabled from users where email = ${normalizeEmail(rawEmail)}`;
    return Boolean(rows[0]?.disabled);
  } catch {
    return false;
  }
}
