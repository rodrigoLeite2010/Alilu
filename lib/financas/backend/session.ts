/**
 * Reexporta o helper de sessão compartilhado (lib/auth/session.ts) — a
 * lógica de autenticação em si vive lá, para não duplicar entre módulos
 * (Financeiro e Loterias, hoje). Mantido como arquivo próprio só para não
 * quebrar os imports já existentes de "@/lib/financas/backend/session" no
 * resto do módulo financeiro.
 */
export { requireUserId, isUuid } from "@/lib/auth/session";
