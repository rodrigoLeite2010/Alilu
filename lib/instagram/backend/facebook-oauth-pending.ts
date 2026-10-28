import "server-only";
import { createHash } from "node:crypto";
import { getDb } from "@/lib/db/client";

export function hashOAuthState(state: string) {
  return createHash("sha256").update(state).digest("hex");
}

export async function createFacebookOAuthAttempt(input: { userId: string; correlationId: string; state: string; targetAccountId?: string | null; expectedIgUserId?: string | null; returnTo?: string | null }) {
  const db = getDb();
  await db`delete from instagram_oauth_pending where expires_at <= now()`;
  const rows = await db`insert into instagram_oauth_pending
    (user_id, correlation_id, state_hash, target_account_id, expected_ig_user_id, return_to, expires_at)
    values (${input.userId}, ${input.correlationId}, ${hashOAuthState(input.state)}, ${input.targetAccountId ?? null},
      ${input.expectedIgUserId ?? null}, ${input.returnTo ?? null}, now() + interval '10 minutes') returning id`;
  return rows[0].id as string;
}

export interface FacebookOAuthAttempt {
  id: string; userId: string; correlationId: string; targetAccountId: string | null; expectedIgUserId: string | null;
  returnTo: string | null; facebookUserId: string | null; facebookUserTokenEncrypted: string | null; facebookUserTokenExpiresAt: Date | null;
}

function map(row: Record<string, unknown>): FacebookOAuthAttempt {
  return { id: row.id as string, userId: row.user_id as string, correlationId: row.correlation_id as string,
    targetAccountId: row.target_account_id as string | null, expectedIgUserId: row.expected_ig_user_id as string | null,
    returnTo: row.return_to as string | null, facebookUserId: row.facebook_user_id as string | null,
    facebookUserTokenEncrypted: row.facebook_user_token_encrypted as string | null,
    facebookUserTokenExpiresAt: row.facebook_user_token_expires_at ? new Date(row.facebook_user_token_expires_at as string) : null };
}

export async function getFacebookOAuthAttempt(id: string, userId: string): Promise<FacebookOAuthAttempt | null> {
  const db = getDb();
  const rows = await db`select * from instagram_oauth_pending where id = ${id} and user_id = ${userId} and expires_at > now()`;
  return rows[0] ? map(rows[0]) : null;
}

export async function getFacebookOAuthAttemptByState(state: string, userId: string) {
  const db = getDb();
  const rows = await db`select * from instagram_oauth_pending where state_hash = ${hashOAuthState(state)} and user_id = ${userId} and expires_at > now()`;
  return rows[0] ? map(rows[0]) : null;
}

export async function saveFacebookOAuthUserToken(id: string, userId: string, facebookUserId: string, encryptedToken: string, expiresAt: Date) {
  const db = getDb();
  const rows = await db`update instagram_oauth_pending set facebook_user_id = ${facebookUserId},
    facebook_user_token_encrypted = ${encryptedToken}, facebook_user_token_expires_at = ${expiresAt.toISOString()}
    where id = ${id} and user_id = ${userId} and expires_at > now() returning id`;
  return rows.length > 0;
}

export async function deleteFacebookOAuthAttempt(id: string, userId: string) {
  const db = getDb();
  await db`delete from instagram_oauth_pending where id = ${id} and user_id = ${userId}`;
}
