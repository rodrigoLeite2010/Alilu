// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb, type TestDb } from "../helpers/pglite-db";

let db: TestDb;
vi.mock("@/lib/db/client", () => ({
  getDb: () => db.sql,
  assertDatabaseConfigured: () => undefined,
}));

const repo = await import("@/lib/financas/backend/repository");

let userA: string;
let userB: string;

beforeEach(async () => {
  db = await createTestDb();
  [{ id: userA }, { id: userB }] = (await Promise.all([
    db.sql`insert into users (email) values ('a@example.com') returning id`,
    db.sql`insert into users (email) values ('b@example.com') returning id`,
  ])).map((rows) => rows[0]) as [{ id: string }, { id: string }];
});
afterEach(async () => {
  await db.close();
});

describe("financas debts repository (controle de dívidas)", () => {
  it("cria, lista e edita dívidas", async () => {
    const id = await repo.createDebt(userA, { name: "Financiamento do carro", balanceCents: 5000000, installmentCents: 80000 });
    const [debt] = await repo.listDebts(userA);
    expect(debt).toMatchObject({ id, name: "Financiamento do carro", balanceCents: 5000000, installmentCents: 80000 });

    await repo.updateDebt(userA, id, { name: "Financiamento do carro (renegociado)", balanceCents: 4500000, installmentCents: 75000 });
    const updated = await repo.getDebt(userA, id);
    expect(updated).toMatchObject({ name: "Financiamento do carro (renegociado)", balanceCents: 4500000, installmentCents: 75000 });
  });

  it("registrar pagamento reduz o saldo devedor sem deixar negativo; ajuste negativo aumenta", async () => {
    const id = await repo.createDebt(userA, { name: "Cartão", balanceCents: 100000, installmentCents: 50000 });
    await repo.applyDebtPayment(userA, id, 30000);
    expect((await repo.getDebt(userA, id))?.balanceCents).toBe(70000);

    // pagamento maior que o saldo: fica em 0, nunca negativo
    await repo.applyDebtPayment(userA, id, 999999);
    expect((await repo.getDebt(userA, id))?.balanceCents).toBe(0);

    // ajuste negativo (ex.: juros) aumenta o saldo devedor
    await repo.applyDebtPayment(userA, id, -15000);
    expect((await repo.getDebt(userA, id))?.balanceCents).toBe(15000);
  });

  it("um usuário nunca vê, edita, paga ou remove dívida de outro", async () => {
    const id = await repo.createDebt(userA, { name: "Empréstimo", balanceCents: 200000, installmentCents: 20000 });
    expect(await repo.listDebts(userB)).toEqual([]);
    expect(await repo.getDebt(userB, id)).toBeNull();
    expect(await repo.updateDebt(userB, id, { name: "Invadido", balanceCents: 1, installmentCents: 1 })).toBe(false);
    expect(await repo.applyDebtPayment(userB, id, 100)).toBe(false);
    expect(await repo.deleteDebt(userB, id)).toBe(false);
    expect((await repo.getDebt(userA, id))?.name).toBe("Empréstimo");
  });

  it("excluir remove a dívida", async () => {
    const id = await repo.createDebt(userA, { name: "X", balanceCents: 1000, installmentCents: 500 });
    expect(await repo.deleteDebt(userA, id)).toBe(true);
    expect(await repo.getDebt(userA, id)).toBeNull();
  });
});
