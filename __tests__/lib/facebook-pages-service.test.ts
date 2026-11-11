// @vitest-environment node
// Conexão de Páginas: seleção explícita, isolamento por usuário, permissões
// e CSRF (state assinado + tentativa com purpose próprio). Banco real
// (PGlite); Meta simulada.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb, seedUserWithAccount, type TestDb } from "../helpers/pglite-db";

let db: TestDb;
vi.mock("@/lib/db/client", () => ({ getDb: () => db.sql, assertDatabaseConfigured: () => undefined }));
vi.mock("@/lib/instagram/backend/encryption", () => ({
  decryptSecret: (value: string) => value.replace(/^enc:/, ""),
  encryptSecret: (value: string) => `enc:${value}`,
}));
vi.mock("@/lib/instagram/backend/meta-graph-client", () => ({ GRAPH_API_VERSION: "v25.0" }));
const login = { exchangeFacebookCode: vi.fn(), getGrantedFacebookPermissions: vi.fn() };
vi.mock("@/lib/instagram/backend/facebook-login", () => ({
  exchangeFacebookCode: (...args: unknown[]) => login.exchangeFacebookCode(...args),
  getGrantedFacebookPermissions: (...args: unknown[]) => login.getGrantedFacebookPermissions(...args),
}));
const graph = { listManagedFacebookPages: vi.fn(), getPageWithToken: vi.fn() };
vi.mock("@/lib/facebook/backend/facebook-graph-client", () => ({
  listManagedFacebookPages: (...args: unknown[]) => graph.listManagedFacebookPages(...args),
  getPageWithToken: (...args: unknown[]) => graph.getPageWithToken(...args),
}));

process.env.INSTAGRAM_OAUTH_STATE_SECRET = "s".repeat(40);
process.env.INSTAGRAM_FACEBOOK_APP_ID = "app";
process.env.INSTAGRAM_FACEBOOK_APP_SECRET = "secret";
process.env.FACEBOOK_PAGES_LOGIN_CONFIG_ID = "cfg";

const service = await import("@/lib/facebook/backend/facebook-pages-service");
const pending = await import("@/lib/instagram/backend/facebook-oauth-pending");

const PAGES = [
  { pageId: "111", pageName: "Alilu", pageAccessToken: "PT-alilu", tasks: ["CREATE_CONTENT", "MANAGE"], canPublish: true, linkedIgUserId: "ig-1", linkedIgUsername: "alilu.tec" },
  { pageId: "222", pageName: "Outra Página", pageAccessToken: "PT-outra", tasks: ["CREATE_CONTENT"], canPublish: true, linkedIgUserId: null, linkedIgUsername: null },
  { pageId: "333", pageName: "Só leitura", pageAccessToken: "PT-x", tasks: ["ANALYZE"], canPublish: false, linkedIgUserId: null, linkedIgUsername: null },
];

async function startAndCallback(userId: string) {
  const authorizeUrl = await service.startFacebookPagesConnect(userId, "http://localhost:3000/api/facebook/pages/oauth/start", "/instagram/painel");
  const url = new URL(authorizeUrl);
  expect(url.searchParams.get("config_id")).toBe("cfg");
  expect(url.searchParams.get("redirect_uri")).toBe("http://localhost:3000/api/facebook/pages/oauth/callback");
  const state = url.searchParams.get("state")!;
  login.exchangeFacebookCode.mockResolvedValue({ accessToken: "USER-TOKEN", facebookUserId: "fb-1", expiresAt: new Date(Date.now() + 86_400_000) });
  login.getGrantedFacebookPermissions.mockResolvedValue(["pages_show_list", "pages_read_engagement", "pages_manage_posts"]);
  const attemptId = await service.handleFacebookPagesCallback({ userId, state, code: "CODE", hasError: false, requestUrl: "http://localhost:3000/x" });
  return { attemptId, state };
}

beforeEach(async () => {
  db = await createTestDb();
  Object.values(login).forEach((fn) => fn.mockReset());
  Object.values(graph).forEach((fn) => fn.mockReset());
  graph.listManagedFacebookPages.mockResolvedValue(PAGES);
});
afterEach(async () => db.close());

describe("conexão de Páginas do Facebook", () => {
  it("lista as Páginas da tentativa sem expor tokens e sem salvar nada", async () => {
    const seed = await seedUserWithAccount(db);
    const { attemptId } = await startAndCallback(seed.userId);
    const candidates = await service.listFacebookPageCandidates(attemptId, seed.userId);
    expect(JSON.stringify(candidates)).not.toContain("PT-");
    expect(candidates.find((page) => page.pageId === "111")?.linkedToMyInstagram).toBe(true);
    expect(candidates.find((page) => page.pageId === "333")?.canPublish).toBe(false);
    expect(await db.sql`select * from facebook_pages`).toHaveLength(0);
  });

  it("conecta SOMENTE a Página escolhida (não a primeira da lista) e vincula ao Instagram do próprio usuário", async () => {
    const seed = await seedUserWithAccount(db);
    const { attemptId } = await startAndCallback(seed.userId);
    const result = await service.connectSelectedFacebookPages(attemptId, seed.userId, ["222"]);
    expect(result.pages.map((page) => page.pageName)).toEqual(["Outra Página"]);
    const rows = await db.sql`select * from facebook_pages`;
    expect(rows).toHaveLength(1);
    expect(rows[0].page_access_token_encrypted).toBe("enc:PT-outra");
    // O token do Instagram não foi tocado.
    const [account] = await db.sql`select access_token_encrypted from instagram_accounts where id = ${seed.accountId}`;
    expect(account.access_token_encrypted).toBe("cifrado");
  });

  it("vincula a Página ao Instagram @alilu.tec do mesmo usuário", async () => {
    const seed = await seedUserWithAccount(db);
    const { attemptId } = await startAndCallback(seed.userId);
    await service.connectSelectedFacebookPages(attemptId, seed.userId, ["111"]);
    const [row] = await db.sql`select * from facebook_pages`;
    expect(row.instagram_account_id).toBe(seed.accountId);
    expect(row.linked_ig_username).toBe("alilu.tec");
  });

  it("recusa Página que a Meta não confirmou para este login ou sem permissão de criar conteúdo", async () => {
    const seed = await seedUserWithAccount(db);
    const { attemptId } = await startAndCallback(seed.userId);
    await expect(service.connectSelectedFacebookPages(attemptId, seed.userId, ["999"])).rejects.toThrow(/não está autorizada/);
    await expect(service.connectSelectedFacebookPages(attemptId, seed.userId, ["333"])).rejects.toThrow(/não está autorizada/);
    expect(await db.sql`select * from facebook_pages`).toHaveLength(0);
  });

  it("outro usuário não consegue usar a tentativa (nem ver as Páginas) de alguém", async () => {
    const owner = await seedUserWithAccount(db, "1");
    const intruder = await seedUserWithAccount(db, "2");
    const { attemptId } = await startAndCallback(owner.userId);
    await expect(service.listFacebookPageCandidates(attemptId, intruder.userId)).rejects.toThrow(/expirou/);
    await expect(service.connectSelectedFacebookPages(attemptId, intruder.userId, ["111"])).rejects.toThrow(/expirou/);
  });

  it("state de outro usuário é rejeitado no callback (CSRF)", async () => {
    const owner = await seedUserWithAccount(db, "1");
    const intruder = await seedUserWithAccount(db, "2");
    const authorizeUrl = await service.startFacebookPagesConnect(owner.userId, "http://localhost:3000/x", null);
    const state = new URL(authorizeUrl).searchParams.get("state");
    await expect(
      service.handleFacebookPagesCallback({ userId: intruder.userId, state, code: "C", hasError: false, requestUrl: "http://localhost:3000/x" }),
    ).rejects.toMatchObject({ code: "tentativa-oauth-expirada" });
    expect(login.exchangeFacebookCode).not.toHaveBeenCalled();
  });

  it("tentativa de Páginas nunca é aceita pelo fluxo do Instagram via Facebook Login (purpose separado)", async () => {
    const seed = await seedUserWithAccount(db);
    const { attemptId, state } = await startAndCallback(seed.userId);
    expect(await pending.getFacebookOAuthAttempt(attemptId, seed.userId)).toBeNull();
    expect(await pending.getFacebookOAuthAttemptByState(state, seed.userId)).toBeNull();
  });

  it("permissões ausentes: não salva o token", async () => {
    const seed = await seedUserWithAccount(db);
    const authorizeUrl = await service.startFacebookPagesConnect(seed.userId, "http://localhost:3000/x", null);
    const state = new URL(authorizeUrl).searchParams.get("state");
    login.exchangeFacebookCode.mockResolvedValue({ accessToken: "U", facebookUserId: "fb", expiresAt: new Date() });
    login.getGrantedFacebookPermissions.mockResolvedValue(["pages_show_list"]);
    await expect(
      service.handleFacebookPagesCallback({ userId: seed.userId, state, code: "C", hasError: false, requestUrl: "http://localhost:3000/x" }),
    ).rejects.toMatchObject({ code: "facebook-permissoes-ausentes" });
    const [row] = await db.sql`select facebook_user_token_encrypted from instagram_oauth_pending`;
    expect(row.facebook_user_token_encrypted).toBeNull();
  });

  it("verificar status: token revogado marca a Página para reconectar", async () => {
    const seed = await seedUserWithAccount(db);
    const { attemptId } = await startAndCallback(seed.userId);
    const { pages } = await service.connectSelectedFacebookPages(attemptId, seed.userId, ["111"]);
    const error = Object.assign(new Error("x"), { name: "FacebookGraphApiError", details: { error: { code: 190 } }, unknownOutcome: false });
    graph.getPageWithToken.mockRejectedValue(error);
    expect((await service.verifyFacebookPage(pages[0].id, seed.userId)).status).toBe("needs_reconnect");
    const [row] = await db.sql`select status from facebook_pages`;
    expect(row.status).toBe("needs_reconnect");
  });
});
