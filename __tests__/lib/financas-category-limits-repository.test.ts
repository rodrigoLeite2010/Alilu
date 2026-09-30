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

describe("financas category limits repository (método dos envelopes)", () => {
  it("cria e lista limites por categoria", async () => {
    await repo.setCategoryLimit(userA, "Alimentação", 80000);
    await repo.setCategoryLimit(userA, "Lazer", 30000);
    const limits = await repo.listCategoryLimits(userA);
    expect(limits).toEqual([
      { category: "Alimentação", limitCents: 80000 },
      { category: "Lazer", limitCents: 30000 },
    ]);
  });

  it("salvar de novo na mesma categoria atualiza o valor em vez de duplicar", async () => {
    await repo.setCategoryLimit(userA, "Alimentação", 80000);
    await repo.setCategoryLimit(userA, "Alimentação", 95000);
    const limits = await repo.listCategoryLimits(userA);
    expect(limits).toEqual([{ category: "Alimentação", limitCents: 95000 }]);
  });

  it("um usuário nunca vê nem remove limites de outro", async () => {
    await repo.setCategoryLimit(userA, "Alimentação", 80000);
    expect(await repo.listCategoryLimits(userB)).toEqual([]);
    expect(await repo.deleteCategoryLimit(userB, "Alimentação")).toBe(false);
    expect(await repo.listCategoryLimits(userA)).toEqual([{ category: "Alimentação", limitCents: 80000 }]);
  });

  it("excluir remove o limite; excluir de novo devolve false", async () => {
    await repo.setCategoryLimit(userA, "Transporte", 20000);
    expect(await repo.deleteCategoryLimit(userA, "Transporte")).toBe(true);
    expect(await repo.listCategoryLimits(userA)).toEqual([]);
    expect(await repo.deleteCategoryLimit(userA, "Transporte")).toBe(false);
  });
});
