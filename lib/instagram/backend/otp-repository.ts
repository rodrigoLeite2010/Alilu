import "server-only";
import { getDb } from "@/lib/db/client";

/**
 * Acesso ao banco para os códigos de login (OTP) — só consultas/gravações,
 * sem regra de negócio (isso vive em otp-service.ts, que é testado
 * mockando este módulo, sem precisar de um banco de verdade).
 */

export interface OtpRecord {
  id: string;
  codeHash: string;
  expiresAt: Date;
  attempts: number;
  consumedAt: Date | null;
  createdAt?: Date;
}

export async function countRecentOtpRequests(email: string, sinceMinutesAgo: number): Promise<number> {
  const db = getDb();
  const rows = await db`
    select count(*)::int as count
    from login_otp_codes
    where email = ${email}
      and created_at > now() - make_interval(mins => ${sinceMinutesAgo})
  `;
  return (rows[0]?.count as number | undefined) ?? 0;
}

export async function insertOtpCode(email: string, codeHash: string, expiresAt: Date, requestIp: string | null = null): Promise<void> {
  const db = getDb();
  await db`
    insert into login_otp_codes (email, code_hash, expires_at, request_ip)
    values (${email}, ${codeHash}, ${expiresAt.toISOString()}, ${requestIp})
  `;
}

/** Ao pedir um novo código, os anteriores ainda ativos deixam de valer. */
export async function invalidateActiveOtps(email: string): Promise<void> {
  const db = getDb();
  await db`
    update login_otp_codes set invalidated_at = now()
    where email = ${email} and consumed_at is null and invalidated_at is null and expires_at > now()
  `;
}

export async function countRecentOtpRequestsByIp(ip: string, sinceMinutesAgo: number): Promise<number> {
  const db = getDb();
  const rows = await db`
    select count(*)::int as count from login_otp_codes
    where request_ip = ${ip} and created_at > now() - make_interval(mins => ${sinceMinutesAgo})
  `;
  return (rows[0]?.count as number | undefined) ?? 0;
}

export async function findLatestOtpForEmail(email: string): Promise<OtpRecord | null> {
  const db = getDb();
  const rows = await db`
    select id, code_hash, expires_at, attempts, consumed_at, invalidated_at, created_at
    from login_otp_codes
    where email = ${email}
    order by created_at desc
    limit 1
  `;

  const row = rows[0];
  if (!row) return null;

  return {
    id: row.id as string,
    codeHash: row.code_hash as string,
    expiresAt: new Date(row.expires_at as string),
    attempts: row.attempts as number,
    // Código invalidado (pediram outro) conta como já usado.
    consumedAt: row.consumed_at
      ? new Date(row.consumed_at as string)
      : row.invalidated_at
        ? new Date(row.invalidated_at as string)
        : null,
    createdAt: new Date(row.created_at as string),
  };
}

export async function incrementOtpAttempts(id: string): Promise<void> {
  const db = getDb();
  await db`update login_otp_codes set attempts = attempts + 1 where id = ${id}`;
}

/** Consumo atômico: dois envios simultâneos do mesmo código não logam duas vezes. */
export async function markOtpConsumed(id: string): Promise<boolean> {
  const db = getDb();
  const rows = await db`
    update login_otp_codes set consumed_at = now()
    where id = ${id} and consumed_at is null and invalidated_at is null
    returning id
  `;
  return rows.length > 0;
}
