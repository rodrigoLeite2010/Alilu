// Banco Postgres real em memória (PGlite) para testar o SQL do módulo
// Instagram — claim atômico, locks, retry, ownership — sem rede e sem
// banco externo. Aplica as mesmas migrações de db/migrations.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";

export interface TestDb {
  pg: PGlite;
  /** Mesma interface de template tag do driver neon() usado em lib/db/client.ts. */
  sql: (strings: TemplateStringsArray, ...values: unknown[]) => Promise<Record<string, unknown>[]>;
  close: () => Promise<void>;
}

function toParam(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  return value;
}

export async function createTestDb(): Promise<TestDb> {
  const pg = new PGlite();
  const dir = join(process.cwd(), "db", "migrations");
  for (const file of readdirSync(dir).filter((name) => name.endsWith(".sql")).sort()) {
    // gen_random_uuid() já é nativo no Postgres 13+; a extensão não existe no PGlite.
    const text = readFileSync(join(dir, file), "utf-8").replace(/create extension if not exists pgcrypto;/i, "");
    await pg.exec(text);
  }

  const sql = async (strings: TemplateStringsArray, ...values: unknown[]) => {
    let text = strings[0];
    for (let index = 0; index < values.length; index += 1) {
      text += `$${index + 1}${strings[index + 1]}`;
    }
    const result = await pg.query<Record<string, unknown>>(text, values.map(toParam));
    return result.rows;
  };

  return { pg, sql, close: () => pg.close() };
}

export async function seedUserWithAccount(db: TestDb, suffix = "1") {
  const [user] = await db.sql`insert into users (email) values (${`user${suffix}@example.com`}) returning id`;
  const [account] = await db.sql`
    insert into instagram_accounts (user_id, ig_user_id, ig_username, access_token_encrypted)
    values (${user.id}, ${`ig-${suffix}`}, ${`conta${suffix}`}, 'cifrado') returning id
  `;
  const [media] = await db.sql`
    insert into instagram_media (user_id, storage_url, media_type)
    values (${user.id}, ${`https://blob.example.com/${suffix}.jpg`}, 'image') returning id
  `;
  const [video] = await db.sql`
    insert into instagram_media (user_id, storage_url, media_type)
    values (${user.id}, ${`https://blob.example.com/${suffix}.mp4`}, 'video') returning id
  `;
  return {
    userId: user.id as string,
    accountId: account.id as string,
    mediaId: media.id as string,
    videoId: video.id as string,
  };
}
