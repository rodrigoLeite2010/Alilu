// @vitest-environment node
import { beforeAll, afterAll, it, expect, vi } from "vitest";
import { createTestDb, type TestDb } from "../helpers/pglite-db";
import { newTrip } from "@/lib/viagens/planner";
let db: TestDb;
vi.mock("@/lib/db/client", () => ({ getDb: () => db.sql }));
const repo = await import("@/lib/viagens/repository");
let userA: string, userB: string;
beforeAll(async () => { db = await createTestDb(); userA = String((await db.sql`insert into users(email) values ('travel-a@example.com') returning id`)[0].id); userB = String((await db.sql`insert into users(email) values ('travel-b@example.com') returning id`)[0].id); }, 30000);
afterAll(async () => { await db?.close(); });
it("persiste todo o planejamento, isola usuários, duplica, arquiva e detecta conflitos", async () => {
  const plan = newTrip(); plan.checklist = [{ id: "doc", group: "Docs", text: "Documento", quantity: 1, kind: "Recomendação", done: true }];
  plan.itinerary = [{ id: "a", title: "Passeio", day: 1, time: "10:00", cost: 50 }]; plan.actual = [{ id: "b", title: "Pago", category: "Lazer", amount: 40, date: "2026-10-21" }];
  const saved = (await repo.saveTrip(userA, plan, null, 0, false))!;
  expect((await repo.listTrips(userA))[0].plan).toEqual(plan); expect(await repo.listTrips(userB)).toEqual([]);
  expect(await repo.saveTrip(userB, plan, saved.id, 1, true)).toBeNull(); expect(await repo.deleteTrip(userB, saved.id)).toBe(false);
  const archived = await repo.saveTrip(userA, plan, saved.id, 1, true); expect(archived).toMatchObject({ archived: true, revision: 2 });
  expect(await repo.saveTrip(userA, plan, saved.id, 1, false)).toBeNull();
  const copy = await repo.saveTrip(userA, { ...plan, title: "Cópia" }, null, 0, false); expect(copy!.id).not.toBe(saved.id);
  expect(await repo.deleteTrip(userA, saved.id)).toBe(true); expect((await repo.listTrips(userA)).length).toBe(1);
});
it("limita chamadas de rotas entre instâncias e renova janela após um dia", async () => {
  const claims = await Promise.all(Array.from({ length: 15 }, () => repo.claimRouteQuota(userA)));
  expect(claims.filter(Boolean)).toHaveLength(10);
  await db.sql`update travel_route_quotas set window_start = now() - interval '2 days' where user_id = ${userA}`;
  expect(await repo.claimRouteQuota(userA)).toBe(true);
});
