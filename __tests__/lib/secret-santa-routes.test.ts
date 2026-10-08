// Rotas /api/secret-santa: login obrigatório, userId vem da sessão, convite público e autorização no backend.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb, type TestDb } from "../helpers/pglite-db";

let db: TestDb;
let sessionUser: string | null = null;
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/client", () => ({ getDb: () => db.sql, assertDatabaseConfigured: () => undefined }));
vi.mock("@/auth", () => ({ auth: async () => (sessionUser ? { user: { id: sessionUser } } : null) }));

const groupsRoute = await import("@/app/api/secret-santa/groups/route");
const groupRoute = await import("@/app/api/secret-santa/groups/[id]/route");
const participantsRoute = await import("@/app/api/secret-santa/groups/[id]/participants/route");
const drawRoute = await import("@/app/api/secret-santa/groups/[id]/draw/route");
const mineRoute = await import("@/app/api/secret-santa/groups/[id]/my-assignment/route");
const convRoute = await import("@/app/api/secret-santa/groups/[id]/conversation/route");
const revealRoute = await import("@/app/api/secret-santa/groups/[id]/reveal/route");
const inviteRoute = await import("@/app/api/secret-santa/invitations/[token]/route");
const acceptRoute = await import("@/app/api/secret-santa/invitations/[token]/accept/route");

const req = (method: string, body?: unknown) =>
  new Request("http://x/api", { method, body: body === undefined ? undefined : JSON.stringify(body), headers: { "Content-Type": "application/json" } });
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const tctx = (token: string) => ({ params: Promise.resolve({ token }) });

let users: string[] = [];
beforeEach(async () => {
  db = await createTestDb();
  users = [];
  for (const n of ["a", "b", "c", "d", "x"]) users.push((await db.sql`insert into users (email, name) values (${`${n}@example.com`}, ${n.toUpperCase()}) returning id`)[0].id as string);
  sessionUser = null;
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(async () => {
  vi.restoreAllMocks();
  await db.close();
});

async function groupWith4() {
  sessionUser = users[0];
  const created = await groupsRoute.POST(req("POST", { name: "Natal", participants: [{ name: "B" }, { name: "C" }, { name: "D" }] }));
  expect(created.status).toBe(201);
  const id = (await created.json()).data.id as string;
  const view = (await (await groupRoute.GET(req("GET"), ctx(id))).json()).data;
  for (let i = 1; i <= 3; i += 1) {
    sessionUser = users[i];
    const token = view.participants.find((p: { name: string }) => p.name === "BCD"[i - 1]).inviteToken as string;
    expect((await acceptRoute.POST(req("POST"), tctx(token))).status).toBe(200);
  }
  return id;
}

describe("API do Amigo Secreto", () => {
  it("sem login: 401 nas rotas privadas", async () => {
    const id = "00000000-0000-0000-0000-000000000000";
    expect((await groupsRoute.GET(req("GET"))).status).toBe(401);
    expect((await groupsRoute.POST(req("POST", { name: "x" }))).status).toBe(401);
    expect((await groupRoute.GET(req("GET"), ctx(id))).status).toBe(401);
    expect((await drawRoute.POST(req("POST"), ctx(id))).status).toBe(401);
    expect((await mineRoute.GET(req("GET"), ctx(id))).status).toBe(401);
    expect((await convRoute.POST(req("POST", { body: "oi" }), ctx(id))).status).toBe(401);
    expect((await acceptRoute.POST(req("POST"), tctx("x".repeat(40)))).status).toBe(401);
  });

  it("o convite é público (sem login) mas não vaza e-mails nem tokens", async () => {
    sessionUser = users[0];
    const id = (await (await groupsRoute.POST(req("POST", { name: "Natal", rulesText: "Sem exageros" }))).json()).data.id as string;
    const token = (await (await groupRoute.GET(req("GET"), ctx(id))).json()).data.inviteToken as string;
    sessionUser = null;
    const res = await inviteRoute.GET(req("GET"), tctx(token));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.valid).toBe(true);
    expect(body.data.group.name).toBe("Natal");
    expect(JSON.stringify(body)).not.toMatch(/@example\.com|invite_token/);
    // token inválido responde 200 com valid:false (não revela se existe)
    expect((await (await inviteRoute.GET(req("GET"), tctx("nada-a-ver-nada-a-ver-nada-a-ver"))).json()).data.valid).toBe(false);
  });

  it("usuário de fora recebe 404 em tudo (autorização no backend), e o userId do corpo é ignorado", async () => {
    const id = await groupWith4();
    sessionUser = users[4];
    expect((await groupRoute.GET(req("GET"), ctx(id))).status).toBe(404);
    expect((await mineRoute.GET(req("GET"), ctx(id))).status).toBe(404);
    expect((await convRoute.GET(req("GET"), ctx(id))).status).toBe(404);
    expect((await revealRoute.GET(req("GET"), ctx(id))).status).toBe(404);
    expect((await drawRoute.POST(req("POST", { userId: users[0] }), ctx(id))).status).toBe(404);
    expect((await participantsRoute.POST(req("POST", { name: "Invasor", userId: users[0] }), ctx(id))).status).toBe(404);
  });

  it("participante comum não sorteia (403) e o organizador sorteia; API de A não mostra quem tirou A", async () => {
    const id = await groupWith4();
    sessionUser = users[1];
    expect((await drawRoute.POST(req("POST"), ctx(id))).status).toBe(403);
    expect((await drawRoute.GET(req("GET"), ctx(id))).status).toBe(403);
    sessionUser = users[0];
    expect((await drawRoute.POST(req("POST"), ctx(id))).status).toBe(200);
    // resposta de my-assignment: só o amigo; nada de lista, ids de participantes ou "quem me tirou"
    for (const u of users.slice(0, 4)) {
      sessionUser = u;
      const body = await (await mineRoute.GET(req("GET"), ctx(id))).json();
      expect(Object.keys(body.data).sort()).toEqual(["budget", "drawn", "friend", "gift", "messages", "preferences", "wishes"]);
      expect(Object.keys(body.data.friend)).toEqual(["name"]);
      expect((await revealRoute.GET(req("GET"), ctx(id))).status).toBe(403);
    }
    // organizador, com allowOwnerSeeDraw=false, não vê o resultado nem pela view
    sessionUser = users[0];
    const view = JSON.stringify((await (await groupRoute.GET(req("GET"), ctx(id))).json()).data);
    expect(view).not.toMatch(/giver|receiver|assignment/i);
  });

  it("erro de regra sai com mensagem amigável (sorteio impossível) e sem 500", async () => {
    sessionUser = users[0];
    const id = (await (await groupsRoute.POST(req("POST", { name: "Pequeno" }))).json()).data.id as string;
    const res = await drawRoute.POST(req("POST"), ctx(id));
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("NOT_ENOUGH");
  });
});
