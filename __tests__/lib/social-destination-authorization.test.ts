// @vitest-environment node
//
// REGRESSÃO — "post do Se Tá Bom Pra Você apareceu no Facebook".
//
// Cada publicação só pode sair nos destinos ESCOLHIDOS e AUTORIZADOS.
// Postgres REAL em memória (PGlite, mesmas migrações de produção, inclusive
// a 0058). Só as APIs da Meta (Instagram Graph e Facebook Pages) e a cifra
// dos tokens são simuladas — nenhuma publicação real é feita.
//
// Cenário (um único usuário, várias contas e Páginas, como em produção):
//   Instagram: Alilu, Prestador Seguro, Se Tá Bom Pra Você, GTA 6
//   Páginas:   Alilu, Prestador Seguro, "Rodrigo" (Página vinculada ao
//              Instagram do Se Tá Bom — o que antes recebia os posts pelo
//              modo Automático) e GTA 6. Páginas de dois logins Meta.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb, type TestDb } from "../helpers/pglite-db";

let db: TestDb;
vi.mock("@/lib/db/client", () => ({
  getDb: () => db.sql,
  assertDatabaseConfigured: () => undefined,
}));
vi.mock("@/lib/instagram/backend/encryption", () => ({
  decryptSecret: (value: string) => `plain:${value}`,
  encryptSecret: (value: string) => `enc:${value}`,
}));

class FakeInstagramGraphApiError extends Error {
  details: unknown;
  constructor(message: string, details?: unknown) {
    super(message);
    this.name = "InstagramGraphApiError";
    this.details = details;
  }
}
const ig = {
  createImageMediaContainer: vi.fn(),
  createCarouselItemContainer: vi.fn(),
  createCarouselContainer: vi.fn(),
  createReelMediaContainer: vi.fn(),
  createStoryMediaContainer: vi.fn(),
  getMediaContainerStatus: vi.fn(),
  publishMediaContainer: vi.fn(),
};
vi.mock("@/lib/instagram/backend/meta-graph-client", () => ({
  GRAPH_API_VERSION: "v25.0",
  InstagramGraphApiError: FakeInstagramGraphApiError,
  ...Object.fromEntries(Object.keys(ig).map((key) => [key, (...args: unknown[]) => (ig as Record<string, (...a: unknown[]) => unknown>)[key](...args)])),
}));

class FakeFacebookGraphApiError extends Error {
  details: unknown;
  unknownOutcome: boolean;
  constructor(message: string, details?: unknown, unknownOutcome = false) {
    super(message);
    this.name = "FacebookGraphApiError";
    this.details = details;
    this.unknownOutcome = unknownOutcome;
  }
}
const fb = {
  publishPagePhoto: vi.fn(),
  uploadUnpublishedPagePhoto: vi.fn(),
  createPageMultiPhotoPost: vi.fn(),
  deletePageObject: vi.fn(),
  listRecentPagePosts: vi.fn(),
  getPagePostPermalink: vi.fn(),
  startPageReelUpload: vi.fn(),
  uploadPageReelFromUrl: vi.fn(),
  finishPageReel: vi.fn(),
  getReelStatus: vi.fn(),
  getReelCopyrightInfo: vi.fn(),
};
vi.mock("@/lib/facebook/backend/facebook-graph-client", () => ({
  FacebookGraphApiError: FakeFacebookGraphApiError,
  ...Object.fromEntries(Object.keys(fb).map((key) => [key, (...args: unknown[]) => (fb as Record<string, (...a: unknown[]) => unknown>)[key](...args)])),
}));
const media = { prepareFacebookImageUrl: vi.fn(), assertReelCompatible: vi.fn() };
vi.mock("@/lib/facebook/backend/facebook-media", () => ({
  prepareFacebookImageUrl: (...args: unknown[]) => media.prepareFacebookImageUrl(...args),
  assertReelCompatible: (...args: unknown[]) => media.assertReelCompatible(...args),
}));

const postRepo = await import("@/lib/instagram/backend/instagram-post-repository");
const igScheduler = await import("@/lib/instagram/backend/instagram-scheduler");
const fbService = await import("@/lib/facebook/backend/facebook-publish-service");
const destService = await import("@/lib/facebook/backend/social-destinations-service");
const authz = await import("@/lib/facebook/backend/destination-authorization");
const planner = await import("@/lib/video-queue/backend/queue-planner");

interface World {
  userId: string;
  mediaId: string;
  accounts: { alilu: string; prestador: string; setabom: string; gta: string };
  pages: { alilu: string; prestador: string; rodrigo: string; gta: string };
}

async function seedWorld(): Promise<World> {
  const [user] = await db.sql`insert into users (email) values ('rodrigo@example.com') returning id`;
  const userId = user.id as string;
  const account = async (ig: string, username: string) =>
    (
      await db.sql`insert into instagram_accounts (user_id, ig_user_id, ig_username, access_token_encrypted)
        values (${userId}, ${ig}, ${username}, 'cifrado') returning id`
    )[0].id as string;
  const accounts = {
    alilu: await account("ig-alilu", "alilu"),
    prestador: await account("ig-prestador", "prestadorseguro"),
    setabom: await account("ig-setabom", "setabompravoce"),
    gta: await account("ig-gta", "gta6"),
  };
  const page = async (pageId: string, name: string, linkedTo: string | null, fbUser = "fb-user-1") =>
    (
      await db.sql`insert into facebook_pages (user_id, page_id, page_name, page_access_token_encrypted, facebook_user_id, status, instagram_account_id)
        values (${userId}, ${pageId}, ${name}, ${`token-${pageId}`}, ${fbUser}, 'connected', ${linkedTo}) returning id`
    )[0].id as string;
  const pages = {
    alilu: await page("fb-page-alilu", "Alilu", accounts.alilu),
    prestador: await page("fb-page-prestador", "Prestador Seguro", accounts.prestador),
    // Página que a Meta vincula ao Instagram do Se Tá Bom (ex.: Página com o nome da pessoa).
    rodrigo: await page("fb-page-rodrigo", "Rodrigo", accounts.setabom),
    // Página de OUTRO login Meta (múltiplas contas Meta conectadas).
    gta: await page("fb-page-gta", "GTA 6", accounts.gta, "fb-user-2"),
  };
  const [m] = await db.sql`insert into instagram_media (user_id, storage_url, media_type)
    values (${userId}, 'https://blob.example.com/arte.jpg', 'image') returning id`;
  return { userId, mediaId: m.id as string, accounts, pages };
}

async function profile(w: World, account: string, facebookEnabled: boolean, allowed: string[] = [], defaults: string[] = []) {
  return authz.saveDestinationProfile(w.userId, account, {
    label: null,
    facebookEnabled,
    allowedFacebookPageRefs: allowed,
    defaultFacebookPageRefs: defaults,
  });
}

/** "Categoria" configurada como pedido: Alilu/Prestador com a própria Página; Se Tá Bom e GTA 6 só Instagram. */
async function configureCategories(w: World) {
  await profile(w, w.accounts.alilu, true, [w.pages.alilu], [w.pages.alilu]);
  await profile(w, w.accounts.prestador, true, [w.pages.prestador], [w.pages.prestador]);
  await profile(w, w.accounts.setabom, false);
  await profile(w, w.accounts.gta, false);
}

async function makePost(w: World, account: string, options: { publishToInstagram?: boolean; due?: boolean } = {}) {
  const postId = await postRepo.createDraftImagePost({
    userId: w.userId,
    instagramAccountId: account,
    mediaId: w.mediaId,
    caption: "Legenda",
    scheduledAtUtc: new Date(Date.now() + 60_000),
    timezone: "America/Sao_Paulo",
    publishToInstagram: options.publishToInstagram,
  });
  if (options.due !== false) await db.sql`update instagram_posts set scheduled_at_utc = now() - interval '1 second' where id = ${postId}`;
  return postId;
}

/** Simula a tela: "destinations" como chega no POST/PATCH. */
function select(w: World, postId: string, pageRefs: string[], instagram = true) {
  return destService.applyFacebookDestinations(postId, w.userId, { instagram, facebookPageIds: pageRefs, facebookCaption: null });
}

/** Linha "suja" gravada por uma versão antiga (ex.: modo Automático). */
async function legacyDestination(w: World, postId: string, pageRef: string, pageId: string, source = "automation_auto_legacy") {
  const [row] = await db.sql`insert into social_publication_destinations (post_id, user_id, platform, facebook_page_ref, external_account_id, account_name, selection_source)
    values (${postId}, ${w.userId}, 'facebook', ${pageRef}, ${pageId}, 'antiga', ${source}) returning id`;
  return row.id as string;
}

const dests = (postId: string) => db.sql`select * from social_publication_destinations where post_id = ${postId} order by created_at`;
const readPost = async (id: string) => (await db.sql`select * from instagram_posts where id = ${id}`)[0];
const fbPageIdsCalled = () => fb.publishPagePhoto.mock.calls.map((call) => (call[0] as { pageId: string }).pageId);

async function runSchedulers() {
  await igScheduler.runInstagramScheduler({ timeBudgetMs: 5_000 });
  return fbService.runFacebookScheduler({ timeBudgetMs: 5_000 });
}

let w: World;

beforeEach(async () => {
  db = await createTestDb();
  for (const fn of [...Object.values(ig), ...Object.values(fb), ...Object.values(media)]) fn.mockReset();
  ig.createImageMediaContainer.mockResolvedValue("container-1");
  ig.getMediaContainerStatus.mockResolvedValue("FINISHED");
  ig.publishMediaContainer.mockResolvedValue("ig-media-1");
  fb.publishPagePhoto.mockImplementation(async ({ pageId }: { pageId: string }) => ({ photoId: "photo", postId: `${pageId}_post-1` }));
  fb.getPagePostPermalink.mockResolvedValue("https://www.facebook.com/x/posts/1");
  fb.listRecentPagePosts.mockResolvedValue([]);
  media.prepareFacebookImageUrl.mockImplementation(async ({ storageUrl }: { storageUrl: string }) => storageUrl);
  media.assertReelCompatible.mockResolvedValue(undefined);
  vi.spyOn(console, "info").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  w = await seedWorld();
});

afterEach(async () => {
  await db.close();
  vi.restoreAllMocks();
});

describe("Destinos por categoria", () => {
  it("1. Alilu → somente Instagram Alilu", async () => {
    await configureCategories(w);
    const postId = await makePost(w, w.accounts.alilu);
    await select(w, postId, []);
    await runSchedulers();
    expect((await readPost(postId)).status).toBe("PUBLISHED");
    expect(await dests(postId)).toHaveLength(0);
    expect(fb.publishPagePhoto).not.toHaveBeenCalled();
  });

  it("2. Alilu → Instagram Alilu + Página Alilu", async () => {
    await configureCategories(w);
    const postId = await makePost(w, w.accounts.alilu);
    await select(w, postId, [w.pages.alilu]);
    await runSchedulers();
    expect((await readPost(postId)).status).toBe("PUBLISHED");
    const [dest] = await dests(postId);
    expect(dest).toMatchObject({ status: "PUBLISHED", external_account_id: "fb-page-alilu", selection_source: "manual" });
    expect(fbPageIdsCalled()).toEqual(["fb-page-alilu"]);
  });

  it("3. Prestador Seguro → somente Instagram", async () => {
    await configureCategories(w);
    const postId = await makePost(w, w.accounts.prestador);
    await runSchedulers();
    expect((await readPost(postId)).status).toBe("PUBLISHED");
    expect(fb.publishPagePhoto).not.toHaveBeenCalled();
  });

  it("4. Prestador Seguro → Instagram + Página Prestador Seguro (nunca a Página Alilu)", async () => {
    await configureCategories(w);
    const postId = await makePost(w, w.accounts.prestador);
    await expect(select(w, postId, [w.pages.alilu])).rejects.toThrow(/não está autorizada/);
    await select(w, postId, [w.pages.prestador]);
    await runSchedulers();
    expect(fbPageIdsCalled()).toEqual(["fb-page-prestador"]);
  });

  it("5. Se Tá Bom Pra Você → somente Instagram; Facebook recusado no backend", async () => {
    await configureCategories(w);
    const postId = await makePost(w, w.accounts.setabom);
    for (const page of Object.values(w.pages)) {
      await expect(select(w, postId, [page])).rejects.toThrow(/desativado para esta conta/);
    }
    expect(await dests(postId)).toHaveLength(0);
    await runSchedulers();
    expect((await readPost(postId)).status).toBe("PUBLISHED");
  });

  it("6. Se Tá Bom Pra Você → nenhuma chamada à API do Facebook, nem pelo Piloto Automático", async () => {
    await configureCategories(w);
    const postId = await makePost(w, w.accounts.setabom);
    // Piloto antigo sem configuração (antes: modo Automático = Página vinculada "Rodrigo").
    expect(await destService.attachAutomaticFacebookDestinations({ postId, userId: w.userId, instagramAccountId: w.accounts.setabom, facebookPageIds: null }))
      .toEqual({ created: 0, skipped: "not_configured" });
    // Mesmo com a Página escolhida numa automação: negada pelo perfil.
    expect(
      await destService.attachAutomaticFacebookDestinations({ postId, userId: w.userId, instagramAccountId: w.accounts.setabom, facebookPageIds: [w.pages.rodrigo] }),
    ).toMatchObject({ created: 0, skipped: "no_pages", rejected: 1 });
    await runSchedulers();
    await fbService.publishFacebookDestinationsForPost(postId, w.userId, "manual");
    for (const fn of Object.values(fb)) expect(fn).not.toHaveBeenCalled();
  });

  it("7. GTA 6 → somente Instagram GTA 6 (sem Página Alilu nem perfil pessoal como alternativa)", async () => {
    await configureCategories(w);
    const postId = await makePost(w, w.accounts.gta);
    await expect(select(w, postId, [w.pages.gta])).rejects.toThrow(/desativado/);
    await expect(select(w, postId, [w.pages.alilu])).rejects.toThrow(/desativado/);
    await runSchedulers();
    expect((await readPost(postId)).status).toBe("PUBLISHED");
    expect(fb.publishPagePhoto).not.toHaveBeenCalled();
  });

  it("GTA 6 com a Página GTA 6 explicitamente cadastrada → Instagram + Página GTA 6 apenas", async () => {
    await configureCategories(w);
    await profile(w, w.accounts.gta, true, [w.pages.gta]);
    const postId = await makePost(w, w.accounts.gta);
    await expect(select(w, postId, [w.pages.alilu])).rejects.toThrow(/não está autorizada/);
    await select(w, postId, [w.pages.gta]);
    await runSchedulers();
    expect(fbPageIdsCalled()).toEqual(["fb-page-gta"]);
  });
});

describe("Contas e conexões", () => {
  it("8. publicação sem Facebook configurado (sem perfil, sem escolha) fica só no Instagram", async () => {
    const postId = await makePost(w, w.accounts.setabom);
    await runSchedulers();
    expect((await readPost(postId)).status).toBe("PUBLISHED");
    expect(fb.publishPagePhoto).not.toHaveBeenCalled();
  });

  it("9. Página desconectada: recusada ao agendar; se cair depois, nada é enviado e nenhuma outra Página é usada", async () => {
    await configureCategories(w);
    const postId = await makePost(w, w.accounts.alilu);
    await select(w, postId, [w.pages.alilu]);
    await db.sql`update facebook_pages set page_access_token_encrypted = null, status = 'revoked' where id = ${w.pages.alilu}`;
    const other = await makePost(w, w.accounts.alilu);
    await expect(select(w, other, [w.pages.alilu])).rejects.toThrow(/reconectada/);
    await runSchedulers();
    expect(fb.publishPagePhoto).not.toHaveBeenCalled();
    const [dest] = await dests(postId);
    expect(dest.status).toBe("FAILED");
    expect(dest.last_error_reason).toBe("page_disconnected");
  });

  it("10. Instagram desconectado não desvia nada para o Facebook", async () => {
    await configureCategories(w);
    await db.sql`update instagram_accounts set status = 'revoked' where id = ${w.accounts.setabom}`;
    const postId = await makePost(w, w.accounts.setabom);
    await expect(select(w, postId, [w.pages.rodrigo])).rejects.toThrow(/desativado/);
    await runSchedulers();
    expect(await dests(postId)).toHaveLength(0);
    expect(fb.publishPagePhoto).not.toHaveBeenCalled();
  });

  it("11. várias contas Meta conectadas: só a Página escolhida recebe, com o token DELA", async () => {
    await profile(w, w.accounts.gta, true, [w.pages.gta]);
    const postId = await makePost(w, w.accounts.gta);
    await select(w, postId, [w.pages.gta]);
    await runSchedulers();
    expect(fb.publishPagePhoto).toHaveBeenCalledTimes(1);
    expect(fb.publishPagePhoto).toHaveBeenCalledWith(expect.objectContaining({ pageId: "fb-page-gta", pageToken: "plain:token-fb-page-gta" }));
  });

  it("12. seleção incorreta impedida mesmo sem perfil: Página vinculada a OUTRA conta Instagram", async () => {
    const postId = await makePost(w, w.accounts.gta);
    await expect(select(w, postId, [w.pages.alilu])).rejects.toThrow(/outra conta do Instagram/);
    // Página de outro usuário também é recusada.
    const [stranger] = await db.sql`insert into users (email) values ('x@example.com') returning id`;
    const [foreign] = await db.sql`insert into facebook_pages (user_id, page_id, page_name, page_access_token_encrypted, facebook_user_id)
      values (${stranger.id}, 'fb-foreign', 'Estranha', 't', 'fb-x') returning id`;
    await expect(select(w, postId, [foreign.id as string])).rejects.toThrow(/não foi encontrada/);
    expect(await dests(postId)).toHaveLength(0);
  });
});

describe("Agendador, publicação manual e lote", () => {
  it("13. cron: destino persistido que deixou de ser autorizado é BLOQUEADO antes da API", async () => {
    const postId = await makePost(w, w.accounts.alilu);
    await select(w, postId, [w.pages.alilu]); // escolha válida no momento
    await profile(w, w.accounts.alilu, false); // depois, o Facebook foi desativado para a conta
    const results = await runSchedulers();
    expect(results).toEqual([expect.objectContaining({ status: "FAILED" })]);
    expect(fb.publishPagePhoto).not.toHaveBeenCalled();
    const [dest] = await dests(postId);
    expect(dest).toMatchObject({ status: "CANCELLED", last_error_reason: "unauthorized_destination" });
    const [attempt] = await db.sql`select * from social_publication_attempts where destination_id = ${dest.id}`;
    expect(attempt).toMatchObject({
      outcome: "blocked",
      api_called: false,
      error_reason: "facebook_disabled_for_account",
      instagram_account_id: w.accounts.alilu,
      facebook_page_ref: w.pages.alilu,
      external_account_id: "fb-page-alilu",
      selection_source: "manual",
    });
    expect(attempt.execution_id).toBeTruthy();
    // O Instagram correto segue publicado; rodar de novo não muda nada.
    expect((await readPost(postId)).status).toBe("PUBLISHED");
    await runSchedulers();
    expect(fb.publishPagePhoto).not.toHaveBeenCalled();
  });

  it("14. 'Publicar agora' / 'Tentar novamente' também passam pela autorização", async () => {
    await configureCategories(w);
    const postId = await makePost(w, w.accounts.setabom, { due: false });
    await legacyDestination(w, postId, w.pages.rodrigo, "fb-page-rodrigo", "legacy");
    const results = await fbService.publishFacebookDestinationsForPost(postId, w.userId, "manual");
    expect(results).toEqual([expect.objectContaining({ status: "FAILED", reason: "unauthorized_destination" })]);
    expect(fb.publishPagePhoto).not.toHaveBeenCalled();
  });

  it("15. importação em lote (fila de vídeos): Página não autorizada para a conta não entra no planejamento", async () => {
    await configureCategories(w);
    const queue = { userId: w.userId, instagramAccountId: w.accounts.gta, publishToInstagram: true, facebookPageIds: [w.pages.alilu] };
    expect(await planner.checkTargets(queue as never)).toEqual({ pages: [], problem: null });
    const fbOnly = { ...queue, publishToInstagram: false };
    expect((await planner.checkTargets(fbOnly as never)).problem).toMatch(/não estão autorizadas/);
    await profile(w, w.accounts.gta, true, [w.pages.gta]);
    const ok = await planner.checkTargets({ ...queue, facebookPageIds: [w.pages.gta] } as never);
    expect(ok.pages.map((page) => page.pageId)).toEqual(["fb-page-gta"]);
  });

  it("16. reprocessamento após erro: só o Facebook, na MESMA Página; Instagram não é republicado", async () => {
    await configureCategories(w);
    const postId = await makePost(w, w.accounts.alilu);
    await select(w, postId, [w.pages.alilu]);
    fb.publishPagePhoto.mockRejectedValueOnce(new FakeFacebookGraphApiError("x", { error: { code: 100 } }));
    await runSchedulers();
    const [failed] = await dests(postId);
    expect(failed.status).toBe("FAILED");
    expect(await fbService.publishFacebookDestination(failed.id as string, w.userId, { trigger: "retry" })).toBe("PUBLISHED");
    expect(fbPageIdsCalled()).toEqual(["fb-page-alilu", "fb-page-alilu"]);
    expect(ig.publishMediaContainer).toHaveBeenCalledTimes(1);
  });

  it("17. sem duplicidade: seleção repetida e cron rodando várias vezes publicam uma única vez por destino", async () => {
    await configureCategories(w);
    const postId = await makePost(w, w.accounts.alilu);
    await select(w, postId, [w.pages.alilu]);
    await select(w, postId, [w.pages.alilu]);
    await destService.attachAutomaticFacebookDestinations({ postId, userId: w.userId, instagramAccountId: w.accounts.alilu, facebookPageIds: [w.pages.alilu] });
    expect(await dests(postId)).toHaveLength(1);
    await Promise.all([runSchedulers(), runSchedulers()]);
    await runSchedulers();
    expect(ig.publishMediaContainer).toHaveBeenCalledTimes(1);
    expect(fb.publishPagePhoto).toHaveBeenCalledTimes(1);
  });

  it("token expirado na Página escolhida: nunca tenta outra Página/conta", async () => {
    await configureCategories(w);
    const postId = await makePost(w, w.accounts.alilu);
    await select(w, postId, [w.pages.alilu]);
    fb.publishPagePhoto.mockRejectedValue(new FakeFacebookGraphApiError("expired", { error: { code: 190 } }));
    await runSchedulers();
    await runSchedulers();
    expect(new Set(fbPageIdsCalled())).toEqual(new Set(["fb-page-alilu"]));
    const [page] = await db.sql`select status from facebook_pages where id = ${w.pages.alilu}`;
    expect(page.status).toBe("needs_reconnect");
  });
});

describe("Agendamentos existentes", () => {
  it("18. destinos antigos do modo Automático (Se Tá Bom → Página vinculada) são bloqueados sem chamar a Meta", async () => {
    const postId = await makePost(w, w.accounts.setabom);
    const destId = await legacyDestination(w, postId, w.pages.rodrigo, "fb-page-rodrigo");
    await runSchedulers();
    expect(fb.publishPagePhoto).not.toHaveBeenCalled();
    const [dest] = await db.sql`select status, last_error_reason from social_publication_destinations where id = ${destId}`;
    expect(dest).toEqual({ status: "CANCELLED", last_error_reason: "unauthorized_destination" });
    // O Instagram válido do mesmo post NÃO é afetado.
    expect((await readPost(postId)).status).toBe("PUBLISHED");
  });

  it("18b. a migração 0058 classifica destinos já existentes pela origem (somente metadado)", async () => {
    const postId = await makePost(w, w.accounts.setabom, { due: false });
    const destId = await legacyDestination(w, postId, w.pages.rodrigo, "fb-page-rodrigo", "legacy");
    const [automation] = await db.sql`insert into content_automations (user_id, instagram_account_id, name, timezone)
      values (${w.userId}, ${w.accounts.setabom}, 'Piloto', 'America/Sao_Paulo') returning id`;
    const [day] = await db.sql`insert into content_automation_days (automation_id, day_of_week) values (${automation.id}, 'MONDAY') returning id`;
    await db.sql`insert into automation_runs (automation_id, automation_day_id, instagram_account_id, publication_id, run_date, status)
      values (${automation.id}, ${day.id}, ${w.accounts.setabom}, ${postId}, current_date, 'SCHEDULED')`;
    const migration = readFileSync(join(process.cwd(), "db", "migrations", "0058_social_destination_authorization.sql"), "utf-8");
    await db.pg.exec(migration); // idempotente
    const [dest] = await db.sql`select selection_source, status from social_publication_destinations where id = ${destId}`;
    expect(dest).toEqual({ selection_source: "automation_auto_legacy", status: "SCHEDULED" });
  });

  it("19. nenhum fallback: sem Página válida, nenhuma requisição ao Facebook (perfil pessoal nunca é destino)", async () => {
    await configureCategories(w);
    const postId = await makePost(w, w.accounts.setabom);
    await legacyDestination(w, postId, w.pages.alilu, "fb-page-alilu"); // Página "errada"
    await db.sql`delete from facebook_pages where id = ${w.pages.rodrigo}`;
    await runSchedulers();
    for (const fn of Object.values(fb)) expect(fn).not.toHaveBeenCalled();
  });

  it("20. agendamentos corretos existentes são preservados (Alilu → Página Alilu escolhida manualmente)", async () => {
    // Sem perfil configurado ainda (estado logo após o deploy).
    const postId = await makePost(w, w.accounts.alilu);
    await legacyDestination(w, postId, w.pages.alilu, "fb-page-alilu", "legacy");
    await runSchedulers();
    const [dest] = await dests(postId);
    expect(dest.status).toBe("PUBLISHED");
    expect(fbPageIdsCalled()).toEqual(["fb-page-alilu"]);
    expect((await readPost(postId)).status).toBe("PUBLISHED");
  });

  it("perfil explícito autoriza depois um destino antigo do modo Automático (decisão do usuário, não inferência)", async () => {
    await profile(w, w.accounts.alilu, true, [w.pages.alilu]);
    const postId = await makePost(w, w.accounts.alilu);
    await legacyDestination(w, postId, w.pages.alilu, "fb-page-alilu");
    await runSchedulers();
    expect(fbPageIdsCalled()).toEqual(["fb-page-alilu"]);
  });
});

describe("Perfis de destino (configuração por categoria)", () => {
  it("valida posse da conta e das Páginas e mantém padrão ⊆ permitidas", async () => {
    const saved = await profile(w, w.accounts.alilu, true, [w.pages.alilu], [w.pages.alilu]);
    expect(saved).toMatchObject({ facebookEnabled: true, allowedFacebookPageRefs: [w.pages.alilu], defaultFacebookPageRefs: [w.pages.alilu] });
    await expect(profile(w, "00000000-0000-0000-0000-000000000000", false)).rejects.toThrow(/Conta do Instagram/);
    await expect(profile(w, w.accounts.alilu, true, ["00000000-0000-0000-0000-000000000000"])).rejects.toThrow(/não foi encontrada/);
    await expect(db.sql`update social_destination_profiles set default_facebook_page_refs = ${[w.pages.gta]}::uuid[] where instagram_account_id = ${w.accounts.alilu}`).rejects.toThrow();
  });

  it("conectar uma Página nova não habilita destino automaticamente", async () => {
    await configureCategories(w);
    await db.sql`insert into facebook_pages (user_id, page_id, page_name, page_access_token_encrypted, facebook_user_id, instagram_account_id)
      values (${w.userId}, 'fb-new', 'Nova', 't', 'fb-user-1', ${w.accounts.setabom})`;
    const overview = await authz.getDestinationProfilesOverview(w.userId, w.accounts.alilu);
    const setabom = overview.accounts.find((account) => account.id === w.accounts.setabom)!;
    expect(setabom.profile).toMatchObject({ facebookEnabled: false, allowedFacebookPageRefs: [] });
  });
});
