import "server-only";
import { getDb } from "@/lib/db/client";

/** Linha de smart_story_brand_profiles (identidade de marca de um usuário). */
export interface StoryBrandProfile {
  userId: string;
  brandName: string | null;
  handle: string | null;
  site: string | null;
  accentColor: string | null;
  logoUrl: string | null;
  mascotUrl: string | null;
}

type Row = Record<string, unknown>;

function str(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function toProfile(row: Row): StoryBrandProfile {
  return {
    userId: row.user_id as string,
    brandName: str(row.brand_name),
    handle: str(row.handle),
    site: str(row.site),
    accentColor: str(row.accent_color),
    logoUrl: str(row.logo_url),
    mascotUrl: str(row.mascot_url),
  };
}

export async function getBrandProfile(userId: string): Promise<StoryBrandProfile | null> {
  const rows = await getDb()`select * from smart_story_brand_profiles where user_id = ${userId}`;
  return rows[0] ? toProfile(rows[0] as Row) : null;
}

/** Grava os campos de TEXTO (nome, @, site, cor) — não mexe nas imagens. */
export async function upsertBrandTexts(
  userId: string,
  texts: Pick<StoryBrandProfile, "brandName" | "handle" | "site" | "accentColor">,
): Promise<StoryBrandProfile> {
  const rows = await getDb()`
    insert into smart_story_brand_profiles (user_id, brand_name, handle, site, accent_color)
    values (${userId}, ${texts.brandName}, ${texts.handle}, ${texts.site}, ${texts.accentColor})
    on conflict (user_id) do update set
      brand_name = excluded.brand_name,
      handle = excluded.handle,
      site = excluded.site,
      accent_color = excluded.accent_color,
      updated_at = now()
    returning *
  `;
  return toProfile(rows[0] as Row);
}

/** Grava (ou limpa, com null) o logo ou o mascote do usuário. */
export async function setBrandAsset(userId: string, slot: "LOGO" | "MASCOT", url: string | null): Promise<StoryBrandProfile> {
  const db = getDb();
  const rows =
    slot === "LOGO"
      ? await db`
          insert into smart_story_brand_profiles (user_id, logo_url) values (${userId}, ${url})
          on conflict (user_id) do update set logo_url = excluded.logo_url, updated_at = now()
          returning *`
      : await db`
          insert into smart_story_brand_profiles (user_id, mascot_url) values (${userId}, ${url})
          on conflict (user_id) do update set mascot_url = excluded.mascot_url, updated_at = now()
          returning *`;
  return toProfile(rows[0] as Row);
}

export async function getUserEmail(userId: string): Promise<string | null> {
  const rows = await getDb()`select email from users where id = ${userId}`;
  return rows[0] ? ((rows[0] as Row).email as string | null) ?? null : null;
}
