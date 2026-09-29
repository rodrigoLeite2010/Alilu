/**
 * Reexporta o helper de sessão compartilhado (lib/auth/session.ts) — ver
 * esse arquivo para a implementação. Loterias reaproveita a mesma
 * autenticação do resto do site (Auth.js), nunca uma segunda implementação.
 */
export { requireUserId, isUuid } from "@/lib/auth/session";
