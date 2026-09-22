import "server-only";
import { getDb } from "@/lib/db/client";
import { normalizeEmail } from "./otp";

export interface AppUser {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
}

export interface UpsertUserPatch {
  name?: string | null;
  avatarUrl?: string | null;
  googleId?: string | null;
}

/**
 * Cria o usuário na primeira vez que o e-mail aparece (login por Google ou
 * por código) e, nas próximas vezes, atualiza só os campos informados —
 * nunca apaga um nome/avatar/google_id já salvo por não vir preenchido
 * numa chamada posterior (coalesce com o valor atual).
 */
export async function upsertUserByEmail(rawEmail: string, patch?: UpsertUserPatch): Promise<AppUser> {
  const db = getDb();
  const email = normalizeEmail(rawEmail);

  const rows = await db`
    insert into users (email, name, avatar_url, google_id)
    values (${email}, ${patch?.name ?? null}, ${patch?.avatarUrl ?? null}, ${patch?.googleId ?? null})
    on conflict (email) do update set
      name = coalesce(excluded.name, users.name),
      avatar_url = coalesce(excluded.avatar_url, users.avatar_url),
      google_id = coalesce(excluded.google_id, users.google_id),
      updated_at = now()
    returning id, email, name, avatar_url as "avatarUrl"
  `;

  return rows[0] as unknown as AppUser;
}

export async function getUserById(id: string): Promise<AppUser | null> {
  const db = getDb();
  const rows = await db`
    select id, email, name, avatar_url as "avatarUrl"
    from users
    where id = ${id}
  `;
  return (rows[0] as unknown as AppUser) ?? null;
}
