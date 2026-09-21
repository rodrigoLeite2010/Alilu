import "server-only";
import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

/**
 * Cliente de banco do módulo Instagram (Fase 3).
 *
 * Usa @neondatabase/serverless (o driver HTTP recomendado pela própria
 * Vercel desde que o Vercel Postgres migrou para ser um add-on da Neon no
 * Vercel Marketplace — @vercel/postgres está descontinuado). `neon(...)`
 * devolve uma função de template tag para consultas avulsas (sem estado de
 * conexão entre chamadas), ideal para funções serverless.
 *
 * Para operações que precisam de transação real (BEGIN/COMMIT/ROLLBACK
 * multi-statement), veja scripts/db-migrate.ts, que usa o `Client`
 * (WebSocket) do mesmo pacote — este módulo aqui é só para consultas
 * avulsas do dia a dia da aplicação.
 *
 * `import "server-only"` garante, em tempo de build, que nenhum componente
 * cliente consiga importar este módulo por engano (e, com ele, a string de
 * conexão do banco).
 */

let cachedSql: NeonQueryFunction<false, false> | null = null;

function getConnectionString(): string {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL não está configurada. Este recurso depende do banco Postgres " +
        "do projeto (ver guia de configuração, Fase 7/8) — configure-o antes de " +
        "usar qualquer funcionalidade de publicação no Instagram.",
    );
  }
  return connectionString;
}

export function assertDatabaseConfigured(): void {
  getConnectionString();
}

/**
 * Retorna a função de template tag para consultas SQL avulsas, criada
 * (e cacheada) só na primeira chamada — nunca no carregamento do módulo,
 * para não exigir DATABASE_URL em contextos que importam este arquivo sem
 * chegar a consultar o banco (ex.: build, testes de outros módulos).
 *
 * Uso:
 *   const db = getDb();
 *   const rows = await db\`select * from users where email = ${email}\`;
 */
export function getDb(): NeonQueryFunction<false, false> {
  if (!cachedSql) {
    cachedSql = neon(getConnectionString());
  }
  return cachedSql;
}
