/**
 * Erro do Postgres por tabela/coluna inexistente (migração ainda não
 * aplicada): 42P01 = undefined_table, 42703 = undefined_column.
 */
export function isMissingSchemaError(error: unknown): boolean {
  const code = (error as { code?: unknown } | null)?.code;
  if (code === "42P01" || code === "42703") return true;
  const message = String((error as { message?: unknown } | null)?.message ?? "");
  return /relation "[^"]+" does not exist|column "[^"]+" (of relation "[^"]+" )?does not exist/i.test(message);
}

export const MIGRATION_PENDING_MESSAGE =
  "O banco de dados ainda não tem as tabelas do Radar Viral. Rode `npm run db:migrate` (migração 0056_viral_radar.sql) com o DATABASE_URL de produção e recarregue a página.";
