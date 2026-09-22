/**
 * Runner de migrações do banco (Fase 3 — módulo de publicação automática do
 * Instagram). Deliberadamente simples (sem ORM/ferramenta de migração
 * externa): lê os arquivos .sql de db/migrations em ordem, aplica os que
 * ainda não constam na tabela schema_migrations, e registra cada um dentro
 * de uma transação — se um arquivo falhar, nada dele fica meio aplicado.
 *
 * Usa o `Client` (WebSocket) de @neondatabase/serverless — diferente de
 * lib/db/client.ts (que usa o driver HTTP `neon()` para consultas avulsas
 * da aplicação), aqui precisamos de BEGIN/COMMIT/ROLLBACK de verdade.
 *
 * Uso: `npm run db:migrate` (precisa de DATABASE_URL configurada — ver
 * .env.example e o guia de configuração).
 *
 * Este script roda fora do Next.js (via `tsx`, não via `next dev`/`next
 * build`), então nada carrega `.env.local` automaticamente por conta
 * própria — usamos `@next/env` (o mesmo carregador que o Next.js usa por
 * baixo dos panos) para ler `.env.local`/`.env` com a mesma precedência,
 * em vez de reimplementar isso à mão ou depender de mais uma dependência
 * (dotenv) só para isso.
 *
 * Não é chamado automaticamente pelo build nem por nenhuma rota da
 * aplicação: migração de banco é uma ação deliberada, rodada manualmente
 * pelo administrador do projeto.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { loadEnvConfig } from "@next/env";
import { Client } from "@neondatabase/serverless";

const PROJECT_DIR = process.cwd();
const MIGRATIONS_DIR = join(PROJECT_DIR, "db", "migrations");

async function main() {
  loadEnvConfig(PROJECT_DIR);

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error(
      "DATABASE_URL não está definida. Configure-a num .env.local (veja .env.example) antes de rodar as migrações.",
    );
    process.exitCode = 1;
    return;
  }

  const client = new Client({ connectionString });
  await client.connect();

  try {
    await client.query(`
      create table if not exists schema_migrations (
        filename text primary key,
        applied_at timestamptz not null default now()
      )
    `);

    const applied = await client.query("select filename from schema_migrations");
    const appliedNames = new Set(
      (applied.rows as Array<{ filename: string }>).map((row) => row.filename),
    );

    const files = readdirSync(MIGRATIONS_DIR)
      .filter((name) => name.endsWith(".sql"))
      .sort();

    if (files.length === 0) {
      console.log("Nenhum arquivo de migração encontrado em db/migrations.");
      return;
    }

    let appliedCount = 0;
    for (const file of files) {
      if (appliedNames.has(file)) {
        console.log(`- ${file} (já aplicada, pulando)`);
        continue;
      }

      const sqlText = readFileSync(join(MIGRATIONS_DIR, file), "utf-8");
      console.log(`- ${file} (aplicando...)`);

      await client.query("begin");
      try {
        await client.query(sqlText);
        await client.query("insert into schema_migrations (filename) values ($1)", [file]);
        await client.query("commit");
        appliedCount += 1;
        console.log(`  ✓ ${file} aplicada com sucesso`);
      } catch (error) {
        await client.query("rollback");
        throw new Error(`Falha ao aplicar ${file}: ${(error as Error).message}`);
      }
    }

    console.log(
      appliedCount > 0
        ? `\n${appliedCount} migração(ões) aplicada(s) com sucesso.`
        : "\nBanco já estava em dia — nenhuma migração nova.",
    );
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
