// @vitest-environment node
//
// Repositório da Educação Financeira contra Postgres real em memória
// (PGlite, mesmas migrações): isolamento entre usuários, recorrência e
// pagamento por ocorrência.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb, type TestDb } from "../helpers/pglite-db";

let db: TestDb;
vi.mock("@/lib/db/client", () => ({
  getDb: () => db.sql,
  assertDatabaseConfigured: () => undefined,
}));

const repo = await import("@/lib/financas/backend/repository");
const { expandOccurrences } = await import("@/lib/financas/recurrence");
import type { EntryInput } from "@/lib/financas/validation";

function input(partial: Partial<EntryInput> = {}): EntryInput {
  return {
    kind: "expense",
    description: "Condomínio",
    amountCents: 85000,
    category: "Moradia",
    nature: "fixed",
    date: "2026-09-15",
    recurrence: "none",
    recurrenceEnd: null,
    paymentMethod: null,
    note: null,
    paid: false,
    ...partial,
  };
}

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

describe("financas repository", () => {
  it("cria e lista lançamentos com datas e valores no formato esperado", async () => {
    const id = await repo.createEntry(userA, input());
    const [entry] = await repo.listEntriesForRange(userA, "2026-09-01", "2026-09-30");
    expect(entry).toMatchObject({ id, amountCents: 85000, date: "2026-09-15", recurrence: "none", paidAt: null });
    expect(await repo.listEntriesForRange(userA, "2026-10-01", "2026-10-31")).toEqual([]);
  });

  it("um usuário nunca vê, altera, paga ou exclui dados de outro", async () => {
    const id = await repo.createEntry(userA, input());
    expect(await repo.listEntriesForRange(userB, "2026-09-01", "2026-09-30")).toEqual([]);
    expect(await repo.getEntry(userB, id)).toBeNull();
    expect(await repo.updateEntry(userB, id, input({ description: "Invadido" }))).toBe(false);
    expect(await repo.setOccurrencePaid(userB, { id, recurrence: "none" }, "2026-09-15", true)).toBe(false);
    expect(await repo.deleteEntry(userB, id)).toBe(false);
    const entry = await repo.getEntry(userA, id);
    expect(entry).toMatchObject({ description: "Condomínio", paidAt: null });
  });

  it("recorrente aparece nos meses seguintes e o pagamento vale só para a ocorrência", async () => {
    const id = await repo.createEntry(userA, input({ recurrence: "monthly", date: "2026-08-15" }));
    await repo.setOccurrencePaid(userA, { id, recurrence: "monthly" }, "2026-09-15", true);

    const entries = await repo.listEntriesForRange(userA, "2026-08-01", "2026-10-31");
    const payments = await repo.listPaymentsForRange(userA, "2026-08-01", "2026-10-31");
    const occ = expandOccurrences(entries, payments, "2026-08-01", "2026-10-31");
    expect(occ.map((o) => [o.date, o.paid])).toEqual([
      ["2026-08-15", false],
      ["2026-09-15", true],
      ["2026-10-15", false],
    ]);

    await repo.setOccurrencePaid(userA, { id, recurrence: "monthly" }, "2026-09-15", false);
    expect(await repo.listPaymentsForRange(userA, "2026-08-01", "2026-10-31")).toEqual([]);
    expect(await repo.listPaymentsForRange(userB, "2026-08-01", "2026-10-31")).toEqual([]);
  });

  it("não recorrente: pagar grava a data de pagamento e desfazer limpa", async () => {
    const id = await repo.createEntry(userA, input());
    await repo.setOccurrencePaid(userA, { id, recurrence: "none" }, "2026-09-15", true);
    expect((await repo.getEntry(userA, id))?.paidAt).not.toBeNull();
    await repo.setOccurrencePaid(userA, { id, recurrence: "none" }, "2026-09-15", false);
    expect((await repo.getEntry(userA, id))?.paidAt).toBeNull();
  });

  it("recorrência com data final some depois dela", async () => {
    await repo.createEntry(userA, input({ recurrence: "monthly", date: "2026-01-10", recurrenceEnd: "2026-03-10" }));
    expect(await repo.listEntriesForRange(userA, "2026-03-01", "2026-03-31")).toHaveLength(1);
    expect(await repo.listEntriesForRange(userA, "2026-04-01", "2026-04-30")).toHaveLength(0);
  });

  it("excluir remove o lançamento e seus pagamentos", async () => {
    const id = await repo.createEntry(userA, input({ recurrence: "monthly" }));
    await repo.setOccurrencePaid(userA, { id, recurrence: "monthly" }, "2026-09-15", true);
    expect(await repo.deleteEntry(userA, id)).toBe(true);
    expect(await repo.listPaymentsForRange(userA, "2026-09-01", "2026-09-30")).toEqual([]);
  });

  it("configurações: meta de economia e saldo inicial por mês, por usuário", async () => {
    expect(await repo.getSettings(userA)).toEqual({ savingsGoalCents: 0 });
    await repo.setSavingsGoal(userA, 100000);
    await repo.setSavingsGoal(userA, 150000);
    expect(await repo.getSettings(userA)).toEqual({ savingsGoalCents: 150000 });
    expect(await repo.getSettings(userB)).toEqual({ savingsGoalCents: 0 });

    await repo.setOpeningBalance(userA, "2026-09", -20000);
    expect(await repo.getOpeningBalance(userA, "2026-09")).toBe(-20000);
    expect(await repo.getOpeningBalance(userA, "2026-10")).toBe(0);
    expect(await repo.getOpeningBalance(userB, "2026-09")).toBe(0);
  });

  it("listAllEntries filtra por tipo", async () => {
    await repo.createEntry(userA, input());
    await repo.createEntry(userA, input({ kind: "income", category: "Salário", nature: null, description: "Salário" }));
    expect((await repo.listAllEntries(userA, "income")).map((e) => e.description)).toEqual(["Salário"]);
    expect((await repo.listAllEntries(userA, "expense")).map((e) => e.description)).toEqual(["Condomínio"]);
  });
});
