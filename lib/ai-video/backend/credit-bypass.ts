import "server-only";
import { isAdminEmail } from "@/lib/admin/admin-email";
import { getDb } from "@/lib/db/client";

/**
 * Isenção de créditos nos recursos internos de IA (hoje: Imagem → Vídeo).
 *
 * NÃO cria outro sistema de admin: reaproveita a lista ADMIN_EMAILS
 * (`isAdminEmail`). A decisão é SEMPRE do servidor, a partir do usuário
 * autenticado — nada vindo da tela, de query string ou de localStorage.
 * Isenção ≠ saldo infinito: a carteira real continua existindo e visível.
 */
export const AI_CREDIT_BYPASS_REASON_ADMIN = "Admin";

export async function canBypassAiCredits(userId: string): Promise<boolean> {
  if (!userId) return false;
  const rows = await getDb()`select email from users where id = ${userId}`;
  const email = rows[0] ? ((rows[0] as Record<string, unknown>).email as string | null) : null;
  return isAdminEmail(email);
}
