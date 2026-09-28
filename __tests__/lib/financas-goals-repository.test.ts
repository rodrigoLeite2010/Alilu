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

describe("financas goals repository", () => {
  it("cria, lista e edita metas", async () => {
    const id = await repo.createGoal(userA, { name: "Reserva", targetCents: 2400000, currentCents: 0, targetDate: null });
    const [goal] = await repo.listGoals(userA);
    expect(goal).toMatchObject({ id, name: "Reserva", targetCents: 2400000, currentCents: 0, targetDate: null });

    await repo.updateGoal(userA, id, { name: "Reserva de emergência", targetCents: 2400000, currentCents: 100000, targetDate: "2027-01-01" });
    const updated = await repo.getGoal(userA, id);
    expect(updated).toMatchObject({ name: "Reserva de emergência", currentCents: 100000, targetDate: "2027-01-01" });
  });

  it("soma e retira do valor guardado sem deixar negativo", async () => {
    const id = await repo.createGoal(userA, { name: "Viagem", targetCents: 500000, currentCents: 100000, targetDate: null });
    await repo.addToGoal(userA, id, 50000);
    expect((await repo.getGoal(userA, id))?.currentCents).toBe(150000);
    await repo.addToGoal(userA, id, -1000000);
    expect((await repo.getGoal(userA, id))?.currentCents).toBe(0);
  });

  it("um usuário nunca vê, edita ou remove metas de outro", async () => {
    const id = await repo.createGoal(userA, { name: "Carro", targetCents: 1500000, currentCents: 0, targetDate: null });
    expect(await repo.listGoals(userB)).toEqual([]);
    expect(await repo.getGoal(userB, id)).toBeNull();
    expect(await repo.updateGoal(userB, id, { name: "Invadido", targetCents: 1, currentCents: 0, targetDate: null })).toBe(false);
    expect(await repo.addToGoal(userB, id, 100)).toBe(false);
    expect(await repo.deleteGoal(userB, id)).toBe(false);
    expect((await repo.getGoal(userA, id))?.name).toBe("Carro");
  });

  it("excluir remove a meta", async () => {
    const id = await repo.createGoal(userA, { name: "X", targetCents: 1000, currentCents: 0, targetDate: null });
    expect(await repo.deleteGoal(userA, id)).toBe(true);
    expect(await repo.getGoal(userA, id)).toBeNull();
  });
});
