// Carrossel Inteligente — Fase 7: despachante de ações, visão do projeto, rotas HTTP (PGlite).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb, type TestDb } from "../helpers/pglite-db";

let db: TestDb;
vi.mock("@/lib/db/client", () => ({ getDb: () => db.sql, assertDatabaseConfigured: () => undefined }));

let sessionUser: { id: string; email: string } | null = null;
vi.mock("@/auth", () => ({ auth: async () => (sessionUser ? { user: sessionUser } : null) }));

const actions = await import("@/lib/carousel/backend/carousel-actions");
const projects = await import("@/lib/carousel/backend/carousel-project-service");
const http = await import("@/lib/carousel/backend/carousel-http");
const meRoute = await import("@/app/api/carousel/me/route");
const projectsRoute = await import("@/app/api/carousel/projects/route");
const projectRoute = await import("@/app/api/carousel/projects/[id]/route");
const billingRoute = await import("@/app/api/carousel/billing/route");
const adminRoute = await import("@/app/api/admin/carrossel/route");

const NOW = new Date("2026-10-07T12:00:00Z");

async function user(email: string): Promise<string> {
  const [row] = await db.sql`insert into users (email) values (${email}) returning id`;
  return row.id as string;
}
async function draft(userId: string, count = 5) {
  const p = await projects.createCarouselProject({ userId, topic: "Tema do carrossel", slideCount: count, now: NOW });
  await projects.saveProjectSlides(userId, p.id, Array.from({ length: count }, (_, i) => ({ headline: `Slide ${i + 1}`, body: `Corpo ${i + 1}` })));
  return p;
}
const post = (body: unknown) => new Request("http://x/api", { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } });
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

beforeEach(async () => {
  db = await createTestDb();
  sessionUser = null;
});
afterEach(async () => {
  await db.close();
});

describe("runProjectAction", () => {
  it("recusa ação desconhecida e entradas inválidas", async () => {
    const u = await user("a@x.com");
    const p = await draft(u);
    await expect(actions.runProjectAction(u, p.id, { action: "hack" })).rejects.toMatchObject({ code: "INVALID" });
    await expect(actions.runProjectAction(u, p.id, { action: "edit-slide", position: "1", edit: {} })).rejects.toMatchObject({ code: "INVALID" });
    await expect(actions.runProjectAction(u, p.id, { action: "choose-photo", position: 1, photo: { url: "https://evil.com/x.jpg" } })).rejects.toMatchObject({ code: "INVALID" });
    await expect(actions.runProjectAction(u, p.id, { action: "choose-hook", hookId: "../etc" })).rejects.toMatchObject({ code: "INVALID" });
    await expect(actions.runProjectAction(u, p.id, { action: "publish", mode: "NOPE" })).rejects.toMatchObject({ code: "INVALID" });
  });

  it("edita slide, legenda e hashtags com limites e normalização", async () => {
    const u = await user("b@x.com");
    const p = await draft(u);
    await actions.runProjectAction(u, p.id, { action: "edit-slide", position: 2, edit: { headline: "Novo título", body: "Novo corpo" } });
    await actions.runProjectAction(u, p.id, { action: "update", caption: "Minha legenda", hashtags: ["#Dica", "dica", "mkt digital!", 7] });
    const view = await actions.getProjectView(u, p.id);
    expect(view.slides[1]).toMatchObject({ headline: "Novo título", body: "Novo corpo" });
    expect(view.project.caption).toBe("Minha legenda");
    expect(view.project.hashtags).toEqual(["#Dica", "#dica", "#mktdigital"]);
    expect(view.templates.length).toBeGreaterThan(3);
  });

  it("mover, duplicar, adicionar e excluir slides", async () => {
    const u = await user("c@x.com");
    const p = await draft(u, 6);
    await actions.runProjectAction(u, p.id, { action: "move-slide", from: 1, to: 3 });
    await actions.runProjectAction(u, p.id, { action: "duplicate-slide", position: 2 });
    expect((await actions.getProjectView(u, p.id)).slides).toHaveLength(7);
    await actions.runProjectAction(u, p.id, { action: "delete-slide", position: 2 });
    expect((await actions.getProjectView(u, p.id)).slides).toHaveLength(6);
  });

  it("gancho próprio fica escolhido", async () => {
    const u = await user("d@x.com");
    const p = await draft(u);
    await actions.runProjectAction(u, p.id, { action: "custom-hook", headline: "Meu gancho", subtitle: "sub" });
    const view = await actions.getProjectView(u, p.id);
    expect(view.hooks).toHaveLength(1);
    expect(view.project.chosenHookId).toBe(view.hooks[0].id);
  });

  it("isolamento: outro usuário não vê nem altera o projeto", async () => {
    const owner = await user("e@x.com");
    const other = await user("f@x.com");
    const p = await draft(owner);
    await expect(actions.getProjectView(other, p.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(actions.runProjectAction(other, p.id, { action: "delete" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(actions.runProjectAction(other, p.id, { action: "update", caption: "x" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect((await actions.getProjectView(owner, p.id)).slides).toHaveLength(5);
  });

  it("excluir remove o projeto", async () => {
    const u = await user("g@x.com");
    const p = await draft(u);
    await actions.runProjectAction(u, p.id, { action: "delete" });
    await expect(actions.getProjectView(u, p.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("rotas HTTP", () => {
  it("exigem login", async () => {
    expect((await meRoute.GET()).status).toBe(401);
    expect((await projectsRoute.GET(new Request("http://x"))).status).toBe(401);
    expect((await projectRoute.GET(new Request("http://x"), ctx("00000000-0000-0000-0000-000000000000"))).status).toBe(401);
    expect((await billingRoute.POST(post({ action: "cancel" }))).status).toBe(401);
  });

  it("me devolve cota, planos com desconto do servidor e sem IDs do Asaas", async () => {
    const u = await user("h@x.com");
    sessionUser = { id: u, email: "h@x.com" };
    const res = await meRoute.GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.billing.plans.map((p: { code: string }) => p.code)).toEqual(["STARTER", "PRO", "TURBO", "AGENCY"]);
    expect(json.billing.access).toMatchObject({ kind: "TRIAL", allowed: true });
    expect(JSON.stringify(json)).not.toMatch(/asaas/i);
  });

  it("cria projeto, devolve visão e traduz erros em status HTTP", async () => {
    const u = await user("i@x.com");
    sessionUser = { id: u, email: "i@x.com" };
    expect((await projectsRoute.POST(post({ from: "custom", topic: "x" }))).status).toBe(400);
    const created = await projectsRoute.POST(post({ from: "custom", topic: "Como organizar as finanças", slideCount: 5 }));
    expect(created.status).toBe(200);
    const { projectId } = await created.json();
    const view = await projectRoute.GET(new Request("http://x"), ctx(projectId));
    expect((await view.json()).project.topic).toBe("Como organizar as finanças");
    expect((await projectRoute.POST(post({ action: "bogus" }), ctx(projectId))).status).toBe(400);
    const other = await user("j@x.com");
    sessionUser = { id: other, email: "j@x.com" };
    expect((await projectRoute.GET(new Request("http://x"), ctx(projectId))).status).toBe(404);
  });

  it("cobrança: checkout valida plano e dados antes de falar com o Asaas", async () => {
    const u = await user("k@x.com");
    sessionUser = { id: u, email: "k@x.com" };
    expect((await billingRoute.POST(post({ action: "checkout", planCode: "ZZZ" }))).status).toBe(400);
    expect((await billingRoute.POST(post({ action: "checkout", planCode: "PRO" }))).status).toBe(400);
    expect((await billingRoute.POST(post({ action: "nada" }))).status).toBe(400);
  });

  it("admin: só administrador concede cortesia", async () => {
    const u = await user("l@x.com");
    sessionUser = { id: u, email: "l@x.com" };
    expect((await adminRoute.POST(post({ action: "grant", userId: u, planCode: "PRO", days: 30 }))).status).toBe(403);
  });

  it("mapeia códigos de erro para status", () => {
    expect(http.carouselErrorStatus("ACCESS_DENIED")).toBe(402);
    expect(http.carouselErrorStatus("NOT_FOUND")).toBe(404);
    expect(http.carouselErrorStatus("LIMIT")).toBe(429);
  });
});
