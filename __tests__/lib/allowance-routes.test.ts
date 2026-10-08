// Rotas /api/allowance: login obrigatório, userId vem da sessão (nunca do corpo) e cron protegido.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb, type TestDb } from "../helpers/pglite-db";

let db: TestDb;
let sessionUser: string | null = null;
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/client", () => ({ getDb: () => db.sql, assertDatabaseConfigured: () => undefined }));
vi.mock("@/auth", () => ({ auth: async () => (sessionUser ? { user: { id: sessionUser } } : null) }));

const childrenRoute = await import("@/app/api/allowance/children/route");
const childRoute = await import("@/app/api/allowance/children/[id]/route");
const expensesRoute = await import("@/app/api/allowance/children/[id]/expenses/route");
const cronRoute = await import("@/app/api/cron/allowance/route");

const post = (body: unknown) => new Request("http://x/api", { method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json" } });
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

let userA: string;
let userB: string;
beforeEach(async () => {
  db = await createTestDb();
  userA = (await db.sql`insert into users (email) values ('a@example.com') returning id`)[0].id as string;
  userB = (await db.sql`insert into users (email) values ('b@example.com') returning id`)[0].id as string;
  sessionUser = null;
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(async () => {
  vi.restoreAllMocks();
  await db.close();
});

describe("API da Mesada", () => {
  it("sem login: 401 em tudo", async () => {
    expect((await childrenRoute.GET(new Request("http://x"))).status).toBe(401);
    expect((await childrenRoute.POST(post({ name: "X" }))).status).toBe(401);
    expect((await childRoute.GET(new Request("http://x"), ctx("00000000-0000-0000-0000-000000000000"))).status).toBe(401);
  });

  it("outro usuário recebe 404 (e o userId do corpo é ignorado)", async () => {
    sessionUser = userA;
    const created = await childrenRoute.POST(post({ name: "Luna", userId: userB }));
    expect(created.status).toBe(201);
    const childId = (await created.json()).data.id as string;
    const owner = await db.sql`select user_id from allowance_children where id = ${childId}`;
    expect(owner[0].user_id).toBe(userA);

    sessionUser = userB;
    expect((await childRoute.GET(new Request("http://x"), ctx(childId))).status).toBe(404);
    expect((await expensesRoute.POST(post({ amount: "1" }), ctx(childId))).status).toBe(404);
    expect((await (await childrenRoute.GET(new Request("http://x"))).json()).data).toEqual([]);
  });

  it("valida e responde erro de regra com status certo", async () => {
    sessionUser = userA;
    const childId = (await (await childrenRoute.POST(post({ name: "Luna" }))).json()).data.id as string;
    expect((await expensesRoute.POST(post({ amount: "0" }), ctx(childId))).status).toBe(400);
    expect((await expensesRoute.POST(post({ amount: "10" }), ctx(childId))).status).toBe(409); // sem saldo
  });

  it("cron exige segredo", async () => {
    vi.stubEnv("ALLOWANCE_CRON_SECRET", "segredo-do-cron-12345");
    expect((await cronRoute.GET(new Request("http://x"))).status).toBe(401);
    expect((await cronRoute.GET(new Request("http://x", { headers: { authorization: "Bearer errado-errado-errado" } }))).status).toBe(401);
    const ok = await cronRoute.GET(new Request("http://x", { headers: { authorization: "Bearer segredo-do-cron-12345" } }));
    expect(ok.status).toBe(200);
    expect(await ok.json()).toEqual({ plans: 0, launched: 0, failed: 0 });
    vi.unstubAllEnvs();
  });
});
