// Lista de usuários do admin (consulta) contra Postgres real em memória (PGlite).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb, type TestDb } from "../helpers/pglite-db";

let db: TestDb;
vi.mock("@/lib/db/client", () => ({
  getDb: () => db.sql,
  assertDatabaseConfigured: () => undefined,
}));

const service = await import("@/lib/billing/backend/admin-users-service");

async function user(email: string, name: string | null = null) {
  const [row] = await db.sql`insert into users (email, name) values (${email}, ${name}) returning id`;
  return row.id as string;
}
async function sub(userId: string, plan: string, status: string, price: number, extra: { pending?: string; periodEnd?: string } = {}) {
  await db.sql`
    insert into automation_subscriptions (user_id, status, plan_code, monthly_price_cents, pending_plan_code, current_period_ends_at)
    values (${userId}, ${status}, ${plan}, ${price}, ${extra.pending ?? null}, ${extra.periodEnd ?? null})`;
}

beforeEach(async () => {
  db = await createTestDb();
});
afterEach(async () => {
  await db.close();
});

describe("normalizeUsersQuery", () => {
  it("ignora filtros inválidos", () => {
    expect(service.normalizeUsersQuery({ plan: "XYZ", status: "FOO", page: -3, q: "  ana  " })).toEqual({ q: "ana", plan: null, status: null, page: 1 });
    expect(service.normalizeUsersQuery({ plan: "PRO", status: "ACTIVE", page: 2.9 })).toEqual({ q: "", plan: "PRO", status: "ACTIVE", page: 2 });
  });
});

describe("listBillingUsers", () => {
  it("lista todos que logaram, pagantes primeiro, com plano, uso de IA e créditos", async () => {
    const ana = await user("ana@x.com", "Ana");
    const bia = await user("bia@x.com");
    await user("sem@x.com");
    await sub(ana, "CREATOR", "ACTIVE", 2490, { periodEnd: "2026-10-25T00:00:00.000Z", pending: "AUTOMATION" });
    await sub(bia, "AUTOMATION", "PAST_DUE", 1900, { periodEnd: "2026-10-20T00:00:00.000Z" });
    await db.sql`insert into plan_usage_cycles (user_id, cycle_key, plan_code, used) values (${ana}, '2026-10-25', 'CREATOR', 42)`;
    await db.sql`insert into ai_credit_wallets (user_id, available) values (${ana}, 300)`;

    const page = await service.listBillingUsers({});

    expect(page.total).toBe(3);
    expect(page.rows[0].email).toBe("ana@x.com"); // quem paga vem primeiro
    expect(page.rows[0]).toMatchObject({ planCode: "CREATOR", status: "ACTIVE", priceCents: 2490, pendingPlanCode: "AUTOMATION", aiUsed: 42, aiLimit: 90, credits: 300 });
    const semAssinatura = page.rows.find((row) => row.email === "sem@x.com")!;
    expect(semAssinatura).toMatchObject({ status: null, planCode: null, aiUsed: null, credits: 0 });
    const bia2 = page.rows.find((row) => row.email === "bia@x.com")!;
    expect(bia2).toMatchObject({ status: "PAST_DUE", planCode: "AUTOMATION", aiUsed: null, aiLimit: null });
  });

  it("filtra por busca, plano e situação (incluindo 'sem assinatura')", async () => {
    const a = await user("maria@x.com", "Maria Souza");
    const b = await user("joao@x.com");
    await user("livre@x.com");
    await sub(a, "PRO", "ACTIVE", 4990);
    await sub(b, "CREATOR", "CANCELED", 2490);

    expect((await service.listBillingUsers({ q: "souza" })).rows.map((row) => row.email)).toEqual(["maria@x.com"]);
    expect((await service.listBillingUsers({ plan: "CREATOR" })).rows.map((row) => row.email)).toEqual(["joao@x.com"]);
    expect((await service.listBillingUsers({ status: "ACTIVE" })).total).toBe(1);
    expect((await service.listBillingUsers({ status: "SEM_ASSINATURA" })).rows.map((row) => row.email)).toEqual(["livre@x.com"]);
  });

  it("busca trata % e _ como texto comum (sem curinga)", async () => {
    await user("a_b@x.com");
    await user("axb@x.com");
    const result = await service.listBillingUsers({ q: "a_b" });
    expect(result.rows.map((row) => row.email)).toEqual(["a_b@x.com"]);
    expect((await service.listBillingUsers({ q: "%" })).total).toBe(0);
  });

  it("pagina de 50 em 50", async () => {
    for (let i = 0; i < 53; i += 1) await user(`u${String(i).padStart(2, "0")}@x.com`);
    const first = await service.listBillingUsers({});
    const second = await service.listBillingUsers({ page: 2 });
    expect(first.rows).toHaveLength(50);
    expect(first.pageCount).toBe(2);
    expect(second.rows).toHaveLength(3);
  });
});
