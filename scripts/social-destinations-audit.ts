/**
 * Auditoria (e saneamento OPCIONAL) dos destinos sociais.
 *
 * Responde, com os dados reais do banco:
 *   1. Quais contas Instagram ("categorias") têm perfil de destinos.
 *   2. Quais automações do Piloto estavam no antigo modo "Automático"
 *      (facebook_page_ids NULL) e QUAL Página recebia os posts por isso.
 *   3. Quais destinos Facebook PENDENTES seriam bloqueados pela regra nova.
 *   4. Quais posts o Alilu REALMENTE publicou no Facebook (id e URL da Meta),
 *      para comparar com o que aparece no Facebook. Um post no Facebook que
 *      NÃO consta aqui não foi enviado pelo Alilu (ex.: compartilhamento
 *      automático da Central de Contas da Meta).
 *
 * Uso:
 *   npx tsx scripts/social-destinations-audit.ts                    # somente leitura (padrão)
 *   npx tsx scripts/social-destinations-audit.ts --user email@x.com  # filtra um usuário
 *   npx tsx scripts/social-destinations-audit.ts --days 90           # janela do histórico publicado
 *   npx tsx scripts/social-destinations-audit.ts --apply --i-have-authorization
 *       → marca como CANCELLED (motivo unauthorized_destination) SOMENTE os
 *         destinos Facebook pendentes que a regra nova nega e que nunca
 *         enviaram nada à Meta. Registra uma tentativa "blocked" por destino.
 *         Não toca em Instagram, em publicados, em históricos nem em outras tabelas.
 *
 * Nunca imprime tokens. Não roda sozinho: é uma ação deliberada do administrador.
 * O agendador já bloqueia esses destinos na hora de publicar; o --apply só
 * antecipa e deixa o histórico explícito.
 */
import { loadEnvConfig } from "@next/env";
import { Client } from "@neondatabase/serverless";
import { evaluateFacebookDestination, type DestinationProfilePolicy, type DestinationSelectionSource } from "../lib/facebook/destination-policy";

type Row = Record<string, unknown>;

function arg(name: string): string | null {
  const index = process.argv.indexOf(name);
  return index >= 0 ? (process.argv[index + 1] ?? null) : null;
}

const uuids = (value: unknown): string[] => (Array.isArray(value) ? (value as unknown[]).map(String) : []);

async function main() {
  loadEnvConfig(process.cwd());
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL não está definida.");
    process.exitCode = 1;
    return;
  }
  const apply = process.argv.includes("--apply");
  if (apply && !process.argv.includes("--i-have-authorization")) {
    console.error("--apply exige também --i-have-authorization (saneamento em produção só com autorização).");
    process.exitCode = 1;
    return;
  }
  const email = arg("--user");
  const days = Number(arg("--days") ?? 60);

  const client = new Client({ connectionString });
  await client.connect();
  const q = async (text: string, params: unknown[] = []) => (await client.query(text, params)).rows as Row[];

  try {
    const users = email ? await q("select id, email from users where lower(email) = lower($1)", [email]) : await q(
      "select distinct u.id, u.email from users u join instagram_accounts a on a.user_id = u.id",
    );
    const report: Row[] = [];
    const toBlock: Array<{ id: string; reason: string; message: string; row: Row }> = [];

    for (const user of users) {
      const userId = user.id as string;
      const accounts = await q("select id, ig_username, status from instagram_accounts where user_id = $1 order by connected_at", [userId]);
      const pages = await q(
        `select id, page_id, page_name, status, facebook_user_id, instagram_account_id, linked_ig_username,
           (page_access_token_encrypted is not null) as has_token
         from facebook_pages where user_id = $1 order by connected_at`,
        [userId],
      );
      const profiles = await q("select * from social_destination_profiles where user_id = $1", [userId]).catch(() => [] as Row[]);
      const username = (id: unknown) => (accounts.find((a) => a.id === id)?.ig_username as string | undefined) ?? String(id);
      const pageName = (id: unknown) => (pages.find((p) => p.id === id)?.page_name as string | undefined) ?? String(id);
      const profileOf = (accountId: string): DestinationProfilePolicy | null => {
        const p = profiles.find((row) => row.instagram_account_id === accountId);
        return p
          ? {
              instagramAccountId: accountId,
              facebookEnabled: Boolean(p.facebook_enabled),
              allowedFacebookPageRefs: uuids(p.allowed_facebook_page_refs),
              defaultFacebookPageRefs: uuids(p.default_facebook_page_refs),
            }
          : null;
      };

      const autoAutomations = await q(
        `select a.id, a.name, a.status, a.instagram_account_id from content_automations a
         where a.user_id = $1 and a.facebook_page_ids is null`,
        [userId],
      );

      const pending = await q(
        `select d.id, d.post_id, d.status, d.facebook_page_ref, d.external_account_id, d.account_name,
           d.selection_source, d.request_started_at, d.external_upload_id, d.created_at,
           p.instagram_account_id, p.scheduled_at_utc, p.status as post_status
         from social_publication_destinations d
         join instagram_posts p on p.id = d.post_id and p.user_id = d.user_id
         where d.user_id = $1 and d.platform = 'facebook' and d.status in ('SCHEDULED', 'FAILED', 'PROCESSING', 'NEEDS_REVIEW')
         order by p.scheduled_at_utc nulls last`,
        [userId],
      );

      const evaluated = pending.map((row) => {
        const page = pages.find((p) => p.id === row.facebook_page_ref) ?? null;
        const decision = evaluateFacebookDestination({
          userId,
          instagramAccountId: row.instagram_account_id as string,
          page: page
            ? {
                id: page.id as string,
                userId,
                pageId: page.page_id as string,
                status: page.status as "connected",
                hasToken: Boolean(page.has_token),
                instagramAccountId: (page.instagram_account_id as string | null) ?? null,
              }
            : null,
          requestedPageRef: (row.facebook_page_ref as string | null) ?? null,
          externalAccountId: row.external_account_id as string,
          profile: profileOf(row.instagram_account_id as string),
          source: ((row.selection_source as string) ?? "legacy") as DestinationSelectionSource,
        });
        const sentSomething = Boolean(row.request_started_at || row.external_upload_id) || row.status === "PROCESSING" || row.status === "NEEDS_REVIEW";
        if (!decision.allowed && page && !sentSomething) toBlock.push({ id: row.id as string, reason: decision.reason, message: decision.message, row });
        return {
          destino: row.id,
          publicacao: row.post_id,
          instagram: username(row.instagram_account_id),
          pagina: `${row.account_name ?? pageName(row.facebook_page_ref)} (${row.external_account_id})`,
          status: row.status,
          origem: row.selection_source,
          agendado: row.scheduled_at_utc,
          decisao: decision.allowed ? "PERMITIDO" : `BLOQUEAR: ${decision.reason}`,
          observacao: !decision.allowed && sentSomething ? "já iniciou envio — conferir a Página manualmente" : !page ? "Página removida (agendador marca desconectada)" : "",
        };
      });

      const published = await q(
        `select d.post_id, d.external_account_id, d.account_name, d.external_publication_id, d.external_publication_url,
           d.published_at, d.selection_source, p.instagram_account_id, p.meta_media_id
         from social_publication_destinations d
         join instagram_posts p on p.id = d.post_id
         where d.user_id = $1 and d.status = 'PUBLISHED' and d.published_at > now() - ($2::int * interval '1 day')
         order by d.published_at desc`,
        [userId, days],
      );

      report.push({
        usuario: user.email,
        contas: accounts.map((a) => ({
          instagram: a.ig_username,
          status: a.status,
          perfil: profileOf(a.id as string)
            ? {
                facebook: profileOf(a.id as string)!.facebookEnabled ? "ativo" : "desativado",
                permitidas: profileOf(a.id as string)!.allowedFacebookPageRefs.map(pageName),
                padrao: profileOf(a.id as string)!.defaultFacebookPageRefs.map(pageName),
              }
            : "NÃO CONFIGURADO (só escolha explícita; nunca Página de outra conta)",
        })),
        paginas: pages.map((p) => ({
          pagina: p.page_name,
          id_meta: p.page_id,
          status: p.status,
          login_meta: p.facebook_user_id,
          vinculada_ao_instagram: p.linked_ig_username ?? username(p.instagram_account_id),
        })),
        automacoes_modo_automatico_antigo: autoAutomations.map((a) => ({
          automacao: a.name,
          status: a.status,
          instagram: username(a.instagram_account_id),
          paginas_que_recebiam: pages
            .filter((p) => p.instagram_account_id === a.instagram_account_id && p.status === "connected" && p.has_token)
            .map((p) => `${p.page_name} (${p.page_id})`),
        })),
        destinos_pendentes: evaluated,
        publicados_pelo_alilu_no_facebook: published.map((row) => ({
          publicacao: row.post_id,
          instagram: username(row.instagram_account_id),
          instagram_media_id: row.meta_media_id,
          pagina: `${row.account_name} (${row.external_account_id})`,
          facebook_post_id: row.external_publication_id,
          url: row.external_publication_url,
          em: row.published_at,
          origem: row.selection_source,
        })),
      });
    }

    console.log(JSON.stringify({ geradoEm: new Date().toISOString(), modo: apply ? "APLICAR" : "SOMENTE LEITURA", relatorio: report, aBloquear: toBlock.length }, null, 2));

    if (apply && toBlock.length > 0) {
      await client.query("begin");
      try {
        for (const item of toBlock) {
          const updated = await client.query(
            `update social_publication_destinations
             set status = 'CANCELLED', last_error_sanitized = $2, last_error_reason = 'unauthorized_destination',
                 next_attempt_at = null, release_at = null, updated_at = now()
             where id = $1 and status in ('SCHEDULED', 'FAILED') and request_started_at is null and external_upload_id is null
             returning id`,
            [item.id, item.message],
          );
          if (updated.rows.length > 0) {
            await client.query(
              `insert into social_publication_attempts (destination_id, trigger, outcome, error_sanitized, error_reason,
                 instagram_account_id, facebook_page_ref, external_account_id, selection_source, api_called, execution_id)
               values ($1, 'sanitization', 'blocked', $2, $3, $4, $5, $6, $7, false, $8)`,
              [item.id, item.message, item.reason, item.row.instagram_account_id, item.row.facebook_page_ref, item.row.external_account_id, item.row.selection_source, `audit-${Date.now()}`],
            );
          }
        }
        await client.query("commit");
        console.error(`Saneamento aplicado: ${toBlock.length} destino(s) bloqueado(s).`);
      } catch (error) {
        await client.query("rollback");
        throw error;
      }
    }
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("Falha na auditoria:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
