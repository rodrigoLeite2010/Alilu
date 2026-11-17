/**
 * Checklist da gravação para o App Review (puro, testado).
 *
 * Itens TÉCNICOS só ficam concluídos com evidência REAL registrada depois
 * do início da sessão de gravação (eventos do OAuth, conta conectada,
 * consulta à API, publicação e confirmação). Itens que dependem de
 * observação humana (login demonstrado na tela, Reel aberto no Instagram,
 * vídeo legível) exigem confirmação manual — nunca são marcados sozinhos.
 */

export type ChecklistKey =
  | "login_shown"
  | "oauth_started"
  | "authorization_shown"
  | "permissions_granted"
  | "account_connected"
  | "account_data"
  | "video_selected"
  | "caption_prepared"
  | "publish_executed"
  | "publish_confirmed"
  | "reel_viewed"
  | "recording_legible";

export const MANUAL_KEYS: ChecklistKey[] = ["login_shown", "reel_viewed", "recording_legible"];
export const CHECKLIST_ORDER: ChecklistKey[] = [
  "login_shown",
  "oauth_started",
  "authorization_shown",
  "permissions_granted",
  "account_connected",
  "account_data",
  "video_selected",
  "caption_prepared",
  "publish_executed",
  "publish_confirmed",
  "reel_viewed",
  "recording_legible",
];

export const REQUIRED_SCOPES = ["instagram_business_basic", "instagram_business_content_publish"];

export interface ChecklistEvidence {
  sessionStartedAt: Date;
  manualChecks: Partial<Record<ChecklistKey, string>>;
  /** Eventos OAuth do administrador (instagram_oauth_events). */
  oauthEvents: Array<{ message: string | null; outcome: string; at: Date }>;
  account: { status: string; scopes: string[]; authProvider: string; updatedAt: Date } | null;
  profileCheckedAt: Date | null;
  profileOk: boolean;
  post: { createdAt: Date; caption: string; hasVideo: boolean; status: string; publishedAt: Date | null; metaMediaId: string | null } | null;
  verifiedAt: Date | null;
  verifiedPermalink: string | null;
}

export interface ChecklistItem {
  key: ChecklistKey;
  manual: boolean;
  done: boolean;
  /** Evidência técnica ou data da confirmação manual. */
  evidence: string | null;
}

const after = (date: Date | null | undefined, start: Date) => Boolean(date && date.getTime() >= start.getTime());

export function computeChecklist(input: ChecklistEvidence): ChecklistItem[] {
  const start = input.sessionStartedAt;
  const event = (message: string, outcome?: string) =>
    input.oauthEvents.find((item) => item.message === message && (!outcome || item.outcome === outcome) && after(item.at, start)) ?? null;
  const started = event("OAUTH_START");
  const code = event("CODE_RECEIVED");
  const success = event("OAUTH_SUCCESS", "success");
  const scopesOk = Boolean(input.account && REQUIRED_SCOPES.every((scope) => input.account!.scopes.includes(scope)));
  const instagramLogin = input.account?.authProvider === "instagram_login";
  const post = input.post && after(input.post.createdAt, start) ? input.post : null;

  const technical: Record<Exclude<ChecklistKey, "login_shown" | "reel_viewed" | "recording_legible">, { done: boolean; evidence: string | null }> = {
    oauth_started: { done: Boolean(started), evidence: started ? `OAUTH_START ${started.at.toISOString()}` : null },
    authorization_shown: { done: Boolean(code), evidence: code ? `A Meta devolveu o código de autorização (${code.at.toISOString()})` : null },
    permissions_granted: {
      done: Boolean(success) && scopesOk && instagramLogin,
      evidence: success && input.account ? `Permissões concedidas: ${input.account.scopes.join(", ") || "—"}` : null,
    },
    account_connected: {
      done: Boolean(input.account && input.account.status === "connected" && instagramLogin && after(input.account.updatedAt, start)),
      evidence: input.account ? `status=${input.account.status}, fluxo=${input.account.authProvider}` : null,
    },
    account_data: { done: input.profileOk && after(input.profileCheckedAt, start), evidence: input.profileCheckedAt ? `GET /me ${input.profileCheckedAt.toISOString()}` : null },
    video_selected: { done: Boolean(post?.hasVideo), evidence: post ? "Reel criado com vídeo enviado pelo administrador" : null },
    caption_prepared: { done: Boolean(post && post.caption.trim().length > 0), evidence: post ? `${post.caption.trim().length} caracteres` : null },
    publish_executed: {
      done: Boolean(post && post.status === "PUBLISHED" && post.metaMediaId),
      evidence: post ? `status=${post.status}${post.metaMediaId ? `, media_id=${post.metaMediaId}` : ""}` : null,
    },
    publish_confirmed: {
      done: Boolean(post && post.status === "PUBLISHED" && after(input.verifiedAt, start) && input.verifiedPermalink),
      evidence: input.verifiedPermalink,
    },
  };

  return CHECKLIST_ORDER.map((key) => {
    if (MANUAL_KEYS.includes(key)) {
      const at = input.manualChecks[key] ?? null;
      const valid = at && !Number.isNaN(new Date(at).getTime()) && new Date(at).getTime() >= start.getTime();
      return { key, manual: true, done: Boolean(valid), evidence: valid ? at : null };
    }
    const item = technical[key as keyof typeof technical];
    return { key, manual: false, done: item.done, evidence: item.evidence };
  });
}

/**
 * Status de cada permissão — SEM afirmar aprovação no App Review: o Alilu
 * só sabe o que pede e o que o usuário concedeu no token. Nível de acesso e
 * aprovação só podem ser vistos no Meta for Developers.
 */
export function permissionMatrix(requested: string[], granted: string[] | null) {
  return requested.map((scope) => ({
    scope,
    requested: true,
    grantedByUser: granted === null ? null : granted.includes(scope),
    appAccessLevel: "manual" as const,
    appReviewApproved: "manual" as const,
  }));
}
