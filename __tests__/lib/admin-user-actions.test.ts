// Ações manuais do admin sobre um cliente (créditos, cortesia, encerrar, teste,
// ativar/desativar) contra Postgres real em memória (PGlite); só o Asaas é mockado.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb, type TestDb } from "../helpers/pglite-db";

let db: TestDb;
vi.mock("@/lib/db/client", () => ({
  getDb: () => db.sql,
  assertDatabaseConfigured: () => undefined,
}));

vi.mock("@/auth", () => ({ auth: async () => null }));

const admin = await import("@/lib/admin/user-admin-service");
const access = await import("@/lib/billing/backend/automation-access-service");
const status = await import("@/lib/auth/user-status");

const NOW = new Date("2026-10-06T12:00:00.000Z");
let ACTOR = { userId: "", email: "boss@x.com" };
const originalFetch = global.fetch;
const env = { ...process.env };

async function user(email: string) {
  const [row] = await db.sql`insert into users (email) values (${email}) returning id`;
  return row.id as string;
}
async function sub(userId: string, fields: { status: string; plan?: string; price?: number; periodEnd?: string | null; asaas?: string | null; trialEnds?: string | null }) {
  await db.sql`
    insert into automation_subscriptions (user_id, status, plan_code, monthly_price_cents, current_period_ends_at, asaas_subscription_id, asaas_customer_id, trial_ends_at, trial_started_at)
    values (${userId}, ${fields.status}, ${fields.plan ?? "CREATOR"}, ${fields.price ?? 2490}, ${fields.periodEnd ?? null}, ${fields.asaas ?? null}, 'cus_1', ${fields.trialEnds ?? null}, ${fields.trialEnds ? NOW.toISOString() : null})`;
}
async function subRow(userId: string) {
  const [r] = await db.sql`select * from automation_subscriptions where user_id = ${userId}`;
  return r;
}
async function auditActions(userId: string) {
  const rows = await db.sql`select action from admin_audit_log where target_user_id = ${userId} order by created_at, id`;
  return rows.map((r) => r.action as string);
}

beforeEach(async () => {
  db = await createTestDb();
  status.invalidateUserStatusCache();
  process.env.ADMIN_EMAILS = "boss@x.com,boss2@x.com";
  ACTOR = { userId: await user("boss@x.com"), email: "boss@x.com" };
  process.env.ASAAS_API_KEY = "k";
  process.env.ASAAS_BASE_URL = "https://api-sandbox.asaas.com/v3";
  global.fetch = vi.fn(async () => new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } })) as typeof fetch;
});
afterEach(async () => {
  await db.close();
  global.fetch = originalFetch;
  process.env = { ...env };
});

describe("adjustCredits", () => {
  it("dá créditos, retira, grava a auditoria e não deixa negativo", async () => {
    const id = await user("c@x.com");
    expect((await admin.adjustCredits(ACTOR, id, { credits: 100, reason: "bônus" })).available).toBe(100);
    expect((await admin.adjustCredits(ACTOR, id, { credits: -30, reason: "erro" })).available).toBe(70);
    await expect(admin.adjustCredits(ACTOR, id, { credits: -71, reason: "x" })).rejects.toThrow(/Saldo insuficiente/);
    expect(await auditActions(id)).toEqual(["CREDITS_GRANTED", "CREDITS_REMOVED"]);
  });

  it("valida quantidade, motivo e usuário", async () => {
    const id = await user("c@x.com");
    await expect(admin.adjustCredits(ACTOR, id, { credits: 0, reason: "x" })).rejects.toThrow(/diferente de zero/);
    await expect(admin.adjustCredits(ACTOR, id, { credits: 1.5, reason: "x" })).rejects.toThrow(/inteiro/);
    await expect(admin.adjustCredits(ACTOR, id, { credits: 10_000_000, reason: "x" })).rejects.toThrow(/entre/);
    await expect(admin.adjustCredits(ACTOR, id, { credits: 10, reason: "  " })).rejects.toThrow(/motivo/);
    await expect(admin.adjustCredits(ACTOR, "00000000-0000-0000-0000-0000000000ff", { credits: 10, reason: "x" })).rejects.toThrow(/não encontrado/);
    expect(await auditActions(id)).toEqual([]);
  });

  it("dois ajustes iguais seguidos são ambos aplicados (cada um é uma ação)", async () => {
    const id = await user("c@x.com");
    await admin.adjustCredits(ACTOR, id, { credits: 50, reason: "a" });
    expect((await admin.adjustCredits(ACTOR, id, { credits: 50, reason: "a" })).available).toBe(100);
  });
});

describe("grantComplimentaryPlan", () => {
  it("concede cortesia sem cobrança, com acesso de IA até a data", async () => {
    const id = await user("c@x.com");
    const record = await admin.grantComplimentaryPlan(ACTOR, id, { planCode: "PRO", days: 30, note: "parceiro" }, NOW);
    expect(record.complimentary).toBe(true);
    expect(record.monthlyPriceCents).toBe(0);
    expect(record.planCode).toBe("PRO");
    expect(record.asaasSubscriptionId).toBeNull();
    expect(record.currentPeriodEndsAt?.toISOString()).toBe("2026-11-05T00:00:00.000Z");
    expect((await access.canUseAutomation(id, NOW)).allowed).toBe(true);
    expect(await auditActions(id)).toEqual(["PLAN_GRANTED"]);
  });

  it("depois do vencimento a cortesia deixa de valer", async () => {
    const id = await user("c@x.com");
    await admin.grantComplimentaryPlan(ACTOR, id, { planCode: "CREATOR", days: 5, note: "x" }, NOW);
    const later = new Date("2026-10-20T12:00:00.000Z");
    const result = await access.canUseAutomation(id, later);
    expect(result.allowed).toBe(false);
    expect(result.code).toBe("SUBSCRIPTION_REQUIRED");
  });

  it("renova/troca a cortesia existente, mas recusa quem tem assinatura paga", async () => {
    const free = await user("free@x.com");
    await admin.grantComplimentaryPlan(ACTOR, free, { planCode: "CREATOR", days: 10, note: "a" }, NOW);
    const again = await admin.grantComplimentaryPlan(ACTOR, free, { planCode: "PRO", days: 60, note: "b" }, NOW);
    expect(again.planCode).toBe("PRO");

    const paid = await user("paid@x.com");
    await sub(paid, { status: "ACTIVE", periodEnd: "2026-10-25T00:00:00.000Z", asaas: "sub_1" });
    await expect(admin.grantComplimentaryPlan(ACTOR, paid, { planCode: "PRO", days: 30, note: "x" }, NOW)).rejects.toThrow(/assinatura paga/);
    expect((await subRow(paid)).complimentary).toBe(false);
  });

  it("valida plano, dias e motivo", async () => {
    const id = await user("c@x.com");
    await expect(admin.grantComplimentaryPlan(ACTOR, id, { planCode: "XYZ", days: 30, note: "x" }, NOW)).rejects.toThrow(/plano válido/);
    await expect(admin.grantComplimentaryPlan(ACTOR, id, { planCode: "PRO", days: 0, note: "x" }, NOW)).rejects.toThrow(/Dias/);
    await expect(admin.grantComplimentaryPlan(ACTOR, id, { planCode: "PRO", days: 9999, note: "x" }, NOW)).rejects.toThrow(/Dias/);
    await expect(admin.grantComplimentaryPlan(ACTOR, id, { planCode: "PRO", days: 30, note: "" }, NOW)).rejects.toThrow(/motivo/);
  });
});

describe("endPlan", () => {
  it("cortesia termina na hora", async () => {
    const id = await user("c@x.com");
    await admin.grantComplimentaryPlan(ACTOR, id, { planCode: "PRO", days: 30, note: "x" }, NOW);
    const record = await admin.endPlan(ACTOR, id, { reason: "fim da parceria" }, NOW);
    expect(record.status).toBe("CANCELED");
    expect((await access.canUseAutomation(id, NOW)).allowed).toBe(false);
    expect(await auditActions(id)).toEqual(["PLAN_GRANTED", "PLAN_ENDED"]);
  });

  it("assinatura paga é cancelada no Asaas e mantém o acesso até o fim do período; imediato corta já", async () => {
    const keep = await user("keep@x.com");
    await sub(keep, { status: "ACTIVE", periodEnd: "2026-10-25T00:00:00.000Z", asaas: "sub_keep" });
    const record = await admin.endPlan(ACTOR, keep, { reason: "pedido do cliente" }, NOW);
    expect(record.status).toBe("CANCELED");
    expect(record.currentPeriodEndsAt?.toISOString()).toBe("2026-10-25T00:00:00.000Z");
    expect(global.fetch).toHaveBeenCalled();

    const cut = await user("cut@x.com");
    await sub(cut, { status: "ACTIVE", periodEnd: "2026-10-25T00:00:00.000Z", asaas: "sub_cut" });
    const cutRecord = await admin.endPlan(ACTOR, cut, { immediate: true, reason: "fraude" }, NOW);
    expect(cutRecord.currentPeriodEndsAt?.toISOString()).toBe(NOW.toISOString());
    expect(await auditActions(cut)).toEqual(["SUBSCRIPTION_CANCELED"]);
  });

  it("recusa quem não tem plano em andamento e exige motivo", async () => {
    const id = await user("c@x.com");
    await expect(admin.endPlan(ACTOR, id, { reason: "x" }, NOW)).rejects.toThrow(/não tem plano/);
    await sub(id, { status: "ACTIVE", periodEnd: "2026-10-25T00:00:00.000Z", asaas: "sub_1" });
    await expect(admin.endPlan(ACTOR, id, { reason: "" }, NOW)).rejects.toThrow(/motivo/);
  });
});

describe("extendTrial", () => {
  it("abre teste para quem nunca teve e soma dias a quem já está em teste", async () => {
    const id = await user("c@x.com");
    const first = await admin.extendTrial(ACTOR, id, { days: 7, reason: "teste" }, NOW);
    expect(first.status).toBe("TRIAL");
    expect(first.trialEndsAt?.toISOString()).toBe("2026-10-13T12:00:00.000Z");
    const second = await admin.extendTrial(ACTOR, id, { days: 7, reason: "mais" }, NOW);
    expect(second.trialEndsAt?.toISOString()).toBe("2026-10-20T12:00:00.000Z");
  });

  it("reabre teste expirado e recusa plano pago em andamento", async () => {
    const expired = await user("e@x.com");
    await sub(expired, { status: "EXPIRED", trialEnds: "2026-09-01T00:00:00.000Z" });
    expect((await admin.extendTrial(ACTOR, expired, { days: 5, reason: "x" }, NOW)).status).toBe("TRIAL");

    const paid = await user("p@x.com");
    await sub(paid, { status: "ACTIVE", periodEnd: "2026-10-25T00:00:00.000Z", asaas: "sub_1" });
    await expect(admin.extendTrial(ACTOR, paid, { days: 5, reason: "x" }, NOW)).rejects.toThrow(/plano pago em andamento/);
    await expect(admin.extendTrial(ACTOR, expired, { days: 500, reason: "x" }, NOW)).rejects.toThrow(/Dias/);
  });
});

describe("setUserDisabled", () => {
  async function automation(userId: string, name: string, statusValue: string) {
    const [account] = await db.sql`
      insert into instagram_accounts (user_id, ig_user_id, ig_username, access_token_encrypted)
      values (${userId}, ${`ig-${name}`}, ${name}, 'x') returning id`;
    await db.sql`insert into content_automations (user_id, instagram_account_id, name, status) values (${userId}, ${account.id}, ${name}, ${statusValue})`;
  }

  it("desativa, pausa automações ativas, bloqueia o status e reativa", async () => {
    const id = await user("c@x.com");
    await automation(id, "a1", "ACTIVE");
    await automation(id, "a2", "ARCHIVED");

    const off = await admin.setUserDisabled(ACTOR, id, { disabled: true, reason: "abuso" });
    expect(off).toEqual({ disabled: true, automationsPaused: 1 });
    expect(await status.isUserDisabled(id)).toBe(true);
    expect(await status.isEmailDisabled("C@x.com")).toBe(true);
    const states = await db.sql`select status from content_automations where user_id = ${id} order by name`;
    expect(states.map((r) => r.status)).toEqual(["PAUSED", "ARCHIVED"]);

    await admin.setUserDisabled(ACTOR, id, { disabled: false, reason: "" });
    expect(await status.isUserDisabled(id)).toBe(false);
    expect(await auditActions(id)).toEqual(["USER_DISABLED", "USER_ENABLED"]);
  });

  it("exige motivo ao desativar e protege admins e a si mesmo", async () => {
    const id = await user("c@x.com");
    await expect(admin.setUserDisabled(ACTOR, id, { disabled: true, reason: "" })).rejects.toThrow(/motivo/);
    const bossId = await user("boss2@x.com");
    await expect(admin.setUserDisabled(ACTOR, bossId, { disabled: true, reason: "x" })).rejects.toThrow(/administrador/);
    await expect(admin.setUserDisabled({ userId: id, email: "c@x.com" }, id, { disabled: true, reason: "x" })).rejects.toThrow(/própria conta/);
  });

  it("conta desativada não consome o plano (reserva de uso recusada)", async () => {
    const id = await user("c@x.com");
    await admin.grantComplimentaryPlan(ACTOR, id, { planCode: "PRO", days: 30, note: "x" }, NOW);
    await admin.setUserDisabled(ACTOR, id, { disabled: true, reason: "abuso" });
    status.invalidateUserStatusCache();
    await expect(access.reserveAutomationUse(id, NOW)).rejects.toThrow(/desativada/);
  });
});

describe("getUserAdminDetail", () => {
  it("reúne usuário, assinatura, créditos, auditoria e contagens", async () => {
    const id = await user("c@x.com");
    await admin.adjustCredits(ACTOR, id, { credits: 40, reason: "x" });
    await admin.grantComplimentaryPlan(ACTOR, id, { planCode: "CREATOR", days: 10, note: "x" }, NOW);
    const detail = await admin.getUserAdminDetail(id);
    expect(detail?.user.email).toBe("c@x.com");
    expect(detail?.credits.available).toBe(40);
    expect(detail?.subscription?.complimentary).toBe(true);
    expect(detail?.audit.map((a) => a.action)).toEqual(["PLAN_GRANTED", "CREDITS_GRANTED"]);
    expect(detail?.instagramConnected).toBe(false);
    expect(await admin.getUserAdminDetail("00000000-0000-0000-0000-0000000000ff")).toBeNull();
  });
});
