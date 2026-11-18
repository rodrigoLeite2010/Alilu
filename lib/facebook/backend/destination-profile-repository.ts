import "server-only";
import { getDb } from "@/lib/db/client";
import type { DestinationProfilePolicy, ProfileUpdateInput } from "@/lib/facebook/destination-policy";

/**
 * Perfis de destino por conta Instagram (social_destination_profiles).
 * Toda consulta é restrita ao dono (`userId`).
 */

export interface DestinationProfileRecord extends DestinationProfilePolicy {
  id: string;
  userId: string;
  label: string | null;
  updatedAt: string;
}

const uuidList = (value: unknown): string[] => (Array.isArray(value) ? (value as string[]).map(String) : []);

function mapRow(row: Record<string, unknown>): DestinationProfileRecord {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    instagramAccountId: row.instagram_account_id as string,
    label: (row.label as string | null) ?? null,
    facebookEnabled: Boolean(row.facebook_enabled),
    allowedFacebookPageRefs: uuidList(row.allowed_facebook_page_refs),
    defaultFacebookPageRefs: uuidList(row.default_facebook_page_refs),
    updatedAt: new Date((row.updated_at as string) ?? 0).toISOString(),
  };
}

export async function getDestinationProfile(userId: string, instagramAccountId: string): Promise<DestinationProfileRecord | null> {
  const db = getDb();
  const rows = await db`
    select * from social_destination_profiles
    where user_id = ${userId} and instagram_account_id = ${instagramAccountId}
  `;
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function listDestinationProfiles(userId: string): Promise<DestinationProfileRecord[]> {
  const db = getDb();
  const rows = await db`select * from social_destination_profiles where user_id = ${userId} order by created_at asc`;
  return rows.map(mapRow);
}

/** Cria/atualiza o perfil. A posse da conta e das Páginas é conferida pelo serviço antes. */
export async function upsertDestinationProfile(
  userId: string,
  instagramAccountId: string,
  input: ProfileUpdateInput,
): Promise<DestinationProfileRecord> {
  const db = getDb();
  const rows = await db`
    insert into social_destination_profiles
      (user_id, instagram_account_id, label, facebook_enabled, allowed_facebook_page_refs, default_facebook_page_refs)
    values (${userId}, ${instagramAccountId}, ${input.label}, ${input.facebookEnabled},
      ${input.allowedFacebookPageRefs}::uuid[], ${input.defaultFacebookPageRefs}::uuid[])
    on conflict (user_id, instagram_account_id) do update set
      label = excluded.label,
      facebook_enabled = excluded.facebook_enabled,
      allowed_facebook_page_refs = excluded.allowed_facebook_page_refs,
      default_facebook_page_refs = excluded.default_facebook_page_refs,
      updated_at = now()
    returning *
  `;
  return mapRow(rows[0]);
}
