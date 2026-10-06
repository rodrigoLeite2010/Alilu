/**
 * Lista de administradores (ADMIN_EMAILS, separados por vírgula). Arquivo
 * sem dependências para poder ser usado também em auth.ts sem ciclo de import.
 */
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const allowed = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  return allowed.includes(email.trim().toLowerCase());
}
