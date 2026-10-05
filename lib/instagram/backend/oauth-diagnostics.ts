import "server-only";
import { getDb } from "@/lib/db/client";
import { SITE_URL } from "@/lib/seo/site";
import { decryptSecret } from "@/lib/instagram/backend/encryption";
import { describeMetaError, fetchInstagramProfile, InstagramGraphApiError } from "@/lib/instagram/backend/meta-graph-client";
import { INSTAGRAM_OAUTH_SCOPES, INSTAGRAM_PUBLISH_SCOPE, getInstagramRedirectUri } from "@/lib/instagram/backend/instagram-oauth-config";

/**
 * Admin › Instagram / Meta — diagnóstico. Só checagens e metadados: o
 * token NUNCA sai daqui (no máximo "encontrado/válido").
 */
export interface DiagnosticCheck {
  label: string;
  ok: boolean | null; // null = não se aplica / sem dados
  detail: string;
}

export interface InstagramDiagnostics {
  checks: DiagnosticCheck[];
  redirectUri: string | null;
  scopes: string[];
  accounts: { connected: number; expired: number; revoked: number; error: number };
  recentEvents: Array<{
    at: string;
    userId: string | null;
    correlationId: string | null;
    stage: string;
    outcome: string;
    code: string | null;
    type: string | null;
    message: string | null;
    browser: string | null;
    isMobile: boolean | null;
  }>;
}

function mask(value: string): string {
  return value.length <= 6 ? "***" : `${value.slice(0, 3)}…${value.slice(-3)}`;
}

export async function getInstagramDiagnostics(adminUserId: string): Promise<InstagramDiagnostics> {
  const db = getDb();
  const checks: DiagnosticCheck[] = [];

  const appConfigured = Boolean(process.env.INSTAGRAM_APP_ID && process.env.INSTAGRAM_APP_SECRET);
  checks.push({
    label: "App configurado (INSTAGRAM_APP_ID / INSTAGRAM_APP_SECRET)",
    ok: appConfigured,
    detail: appConfigured ? `App ID ${mask(process.env.INSTAGRAM_APP_ID ?? "")}` : "Faltam variáveis na Vercel",
  });
  checks.push({
    label: "Chave de criptografia dos tokens",
    ok: Boolean(process.env.INSTAGRAM_TOKEN_ENCRYPTION_KEY),
    detail: process.env.INSTAGRAM_TOKEN_ENCRYPTION_KEY ? "Definida" : "INSTAGRAM_TOKEN_ENCRYPTION_KEY ausente",
  });

  let redirectUri: string | null = null;
  try {
    redirectUri = getInstagramRedirectUri();
    const host = new URL(redirectUri).host;
    const ok = redirectUri.startsWith("https://") && host === new URL(SITE_URL).host;
    checks.push({ label: "Redirect URI", ok, detail: `${redirectUri} — precisa estar IGUAL em Meta Developers › Instagram › Business login settings › OAuth redirect URIs` });
    checks.push({
      label: "Domínio canônico do OAuth",
      ok: host === "alilu.com.br",
      detail: `Start e callback devem rodar em ${new URL(redirectUri).origin}; acessos em www são redirecionados antes do OAuth`,
    });
  } catch (error) {
    checks.push({ label: "Redirect URI", ok: false, detail: (error as Error).message });
  }

  const [lastCallback] = await db`select max(created_at) as at from instagram_oauth_events where stage = 'callback'`;
  const [lastSuccess] = await db`select max(created_at) as at from instagram_oauth_events where stage = 'complete' and outcome = 'success'`;
  checks.push({
    label: "Callback funcionando",
    ok: lastSuccess?.at ? true : lastCallback?.at ? false : null,
    detail: lastSuccess?.at
      ? `Última conexão concluída: ${new Date(lastSuccess.at as string).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`
      : lastCallback?.at
        ? "O callback recebe chamadas, mas nenhuma conexão foi concluída ainda — veja os erros abaixo"
        : "Nenhuma tentativa registrada ainda",
  });

  const [account] = await db`
    select id, ig_user_id, ig_username, access_token_encrypted, token_expires_at, scopes, status
    from instagram_accounts where user_id = ${adminUserId} order by updated_at desc limit 1
  `;
  checks.push({ label: "Usuário (você) conectado", ok: Boolean(account && account.status === "connected"), detail: account ? `@${account.ig_username ?? "?"} — status ${account.status}` : "Nenhuma conta do Instagram ligada ao seu usuário" });
  const hasToken = Boolean(account?.access_token_encrypted);
  checks.push({
    label: "Token encontrado",
    ok: account ? hasToken : null,
    detail: hasToken ? `Guardado cifrado; vence em ${account.token_expires_at ? new Date(account.token_expires_at as string).toLocaleDateString("pt-BR") : "?"}` : "—",
  });

  let tokenValid: DiagnosticCheck = { label: "Token válido (consulta /me na Meta)", ok: null, detail: "—" };
  let accountType: string | null = null;
  if (hasToken) {
    try {
      const profile = await fetchInstagramProfile(decryptSecret(account.access_token_encrypted as string));
      accountType = profile.accountType ?? null;
      tokenValid = { label: tokenValid.label, ok: true, detail: `Meta respondeu: @${profile.username ?? "?"}` };
    } catch (error) {
      const meta = describeMetaError(error instanceof InstagramGraphApiError ? error.details : null);
      tokenValid = { label: tokenValid.label, ok: false, detail: `Erro ${meta.code ?? "?"}${meta.subcode ? `/${meta.subcode}` : ""}: ${meta.message ?? "sem detalhe"}` };
    }
  }
  checks.push(tokenValid);
  checks.push({ label: "Instagram Account ID", ok: account ? Boolean(account.ig_user_id) : null, detail: account?.ig_user_id ? mask(String(account.ig_user_id)) : "—" });
  checks.push({
    label: "Conta profissional (Criador/Empresa)",
    ok: accountType ? ["BUSINESS", "MEDIA_CREATOR", "CREATOR"].includes(accountType.toUpperCase()) : null,
    detail: accountType ?? "—",
  });
  const scopes = String(account?.scopes ?? "");
  checks.push({
    label: "Permissão de publicar concedida",
    ok: account ? scopes.includes(INSTAGRAM_PUBLISH_SCOPE) : null,
    detail: scopes || "—",
  });
  checks.push({
    label: "Página do Facebook vinculada",
    ok: null,
    detail: "Não é necessária: o Alilu usa o login direto do Instagram (Instagram API with Instagram Login)",
  });

  const statusRows = await db`select status, count(*)::int as total from instagram_accounts group by status`;
  const byStatus = Object.fromEntries(statusRows.map((row) => [row.status as string, Number(row.total)]));
  const events = await db`
    select created_at, user_id, correlation_id, stage, outcome, error_code, error_type, message, browser, is_mobile
    from instagram_oauth_events
    order by created_at desc limit 25
  `;

  return {
    checks,
    redirectUri,
    scopes: [...INSTAGRAM_OAUTH_SCOPES],
    accounts: { connected: byStatus.connected ?? 0, expired: byStatus.expired ?? 0, revoked: byStatus.revoked ?? 0, error: byStatus.error ?? 0 },
    recentEvents: events.map((row) => ({
      at: new Date(row.created_at as string).toISOString(),
      userId: (row.user_id as string | null) ?? null,
      correlationId: (row.correlation_id as string | null) ?? null,
      stage: row.stage as string,
      outcome: row.outcome as string,
      code: (row.error_code as string | null) ?? null,
      type: (row.error_type as string | null) ?? null,
      message: (row.message as string | null) ?? null,
      browser: (row.browser as string | null) ?? null,
      isMobile: (row.is_mobile as boolean | null) ?? null,
    })),
  };
}
