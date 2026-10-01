import "server-only";
import { auth } from "@/auth";

/**
 * Acesso de administrador — o projeto não tem papel de admin na tabela de
 * usuários; a lista de e-mails autorizados fica na variável ADMIN_EMAILS
 * (separados por vírgula), verificada SEMPRE no servidor. Sem a variável,
 * ninguém é admin.
 */
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const allowed = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  return allowed.includes(email.trim().toLowerCase());
}

/** Sessão do admin, ou null (não logado ou não autorizado). */
export async function getAdminSession(): Promise<{ userId: string; email: string } | null> {
  const session = await auth();
  const email = session?.user?.email ?? null;
  const userId = session?.user?.id ?? null;
  if (!userId || !email || !isAdminEmail(email)) return null;
  return { userId, email };
}
