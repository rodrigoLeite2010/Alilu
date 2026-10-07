// Login de administrador: Carrossel Inteligente sempre liberado, sem cota e sem gastar o carrossel grátis.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb, type TestDb } from "../helpers/pglite-db";

let db: TestDb;
vi.mock("@/lib/db/client", () => ({ getDb: () => db.sql, assertDatabaseConfigured: () => undefined }));

const access = await import("@/lib/carousel/backend/carousel-access-service");
const projects = await import("@/lib/carousel/backend/carousel-project-service");
const { isCarouselPlanMessage } = await import("@/lib/carousel/plan-messages");

const NOW = new Date("2026-10-07T12:00:00Z");

async function mkUser(email: string) {
  const [row] = await db.sql`insert into users (email) values (${email}) returning id`;
  return row.id as string;
}

beforeEach(async () => {
  db = await createTestDb();
  process.env.ADMIN_EMAILS = "boss@alilu.test";
});
afterEach(async () => {
  delete process.env.ADMIN_EMAILS;
  await db.close();
});

describe("acesso do administrador ao Carrossel Inteligente", () => {
  it("liberado mesmo sem plano e com o carrossel grátis já usado", async () => {
    const u = await mkUser("boss@alilu.test");
    await db.sql`insert into carousel_trial_claims (user_id, email_key) values (${u}, 'boss@alilu.test')`;
    const a = await access.getCarouselAccess(u, NOW);
    expect(a).toMatchObject({ kind: "ADMIN", allowed: true, reason: null, code: null });
  });

  it("cria projeto, conclui sem consumir cota e sem tocar no carrossel grátis", async () => {
    const u = await mkUser("boss@alilu.test");
    const p = await projects.createCarouselProject({ userId: u, topic: "Tema do admin", now: NOW });
    expect(p.id).toBeTruthy();
    expect(await access.consumeCarouselQuota(u, p.id, NOW)).toEqual({ status: "counted", via: "ADMIN" });
    expect(await db.sql`select 1 from carousel_trial_claims where user_id = ${u}`).toHaveLength(0);
    expect(await db.sql`select 1 from plan_usage_cycles where user_id = ${u}`).toHaveLength(0);
    expect(await projects.maxProfilesFor(u, NOW)).toBeGreaterThan(10);
  });

  it("usuário comum continua bloqueado depois do grátis, com a mensagem que mostra o botão de planos", async () => {
    const u = await mkUser("cliente@x.com");
    await db.sql`insert into carousel_trial_claims (user_id, email_key) values (${u}, 'cliente@x.com')`;
    const a = await access.getCarouselAccess(u, NOW);
    expect(a).toMatchObject({ kind: "NONE", allowed: false, code: "TRIAL_USED" });
    expect(isCarouselPlanMessage(a.reason)).toBe(true);
  });
});

describe("mensagens de plano", () => {
  it("reconhece as mensagens de plano/cota e ignora o resto", () => {
    expect(isCarouselPlanMessage("Seu carrossel grátis já foi usado. Assine um plano do Carrossel Inteligente para continuar criando.")).toBe(true);
    expect(isCarouselPlanMessage("Você usou os 60 carrosséis do plano Starter neste ciclo.")).toBe(true);
    expect(isCarouselPlanMessage("Informe o tema do carrossel.")).toBe(false);
    expect(isCarouselPlanMessage(null)).toBe(false);
  });
});
