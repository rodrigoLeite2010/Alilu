// Monetização do Piloto Automático de Conteúdo (trial de 7 dias / 3
// automações por dia, depois assinatura via Asaas) contra um Postgres
// REAL em memória (PGlite, mesmas migrações de produção) — mesma técnica
// já usada em content-automation.test.ts. Cobre os cenários TESTE 1-6,
// 13 e 15 do briefing original: início do trial no primeiro uso real,
// limite diário, reset no dia seguinte, expiração do trial, isolamento
// das ferramentas manuais, concorrência e devolução de vaga em falha.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb, type TestDb } from "../helpers/pglite-db";

let db: TestDb;
vi.mock("@/lib/db/client", () => ({
  getDb: () => db.sql,
  assertDatabaseConfigured: () => undefined,
}));

const repo = await import("@/lib/billing/backend/automation-subscription-repository");
const access = await import("@/lib/billing/backend/automation-access-service");
const { SubscriptionRequiredError, TRIAL_DAYS, TRIAL_DAILY_LIMIT } = await import(
  "@/lib/billing/backend/billing-types"
);
const postRepo = await import("@/lib/instagram/backend/instagram-post-repository");

async function seedUser(suffix = "1") {
  const [user] = await db.sql`insert into users (email) values (${`billing-user${suffix}@example.com`}) returning id`;
  return user.id as string;
}

async function seedUserWithMedia(suffix = "1") {
  const userId = await seedUser(suffix);
  const [account] = await db.sql`
    insert into instagram_accounts (user_id, ig_user_id, ig_username, access_token_encrypted)
    values (${userId}, ${`ig-${suffix}`}, ${`conta${suffix}`}, 'cifrado') returning id
  `;
  const [media] = await db.sql`
    insert into instagram_media (user_id, storage_url, media_type)
    values (${userId}, ${`https://blob.example.com/${suffix}.jpg`}, 'image') returning id
  `;
  return { userId, accountId: account.id as string, mediaId: media.id as string };
}

beforeEach(async () => {
  db = await createTestDb();
});

afterEach(async () => {
  await db.close();
  vi.restoreAllMocks();
});

describe("TESTE 1 — o trial começa no primeiro uso real, não na primeira visita à tela", () => {
  it("canUseAutomation não cria linha nenhuma antes do primeiro uso", async () => {
    const userId = await seedUser();
    const now = new Date("2026-09-01T12:00:00.000Z");

    const result = await access.canUseAutomation(userId, now);
    expect(result.allowed).toBe(true);
    expect(result.status).toBe("NEW");
    expect(result.trialEndsAt).toBeNull();
    expect(result.remainingToday).toBe(TRIAL_DAILY_LIMIT);

    const rows = await db.sql`select * from automation_subscriptions where user_id = ${userId}`;
    expect(rows).toHaveLength(0);
  });

  it("reserveAutomationUse cria o trial só na primeira automação de verdade", async () => {
    const userId = await seedUser();
    const now = new Date("2026-09-01T12:00:00.000Z");

    await access.reserveAutomationUse(userId, now);

    const [row] = await db.sql`select * from automation_subscriptions where user_id = ${userId}`;
    expect(row.status).toBe("TRIAL");
    expect(new Date(row.trial_started_at as string).toISOString()).toBe(now.toISOString());
    expect(new Date(row.trial_ends_at as string).getTime() - now.getTime()).toBe(TRIAL_DAYS * 24 * 60 * 60 * 1000);
    expect(Number(row.trial_usage_count)).toBe(1);
  });
});

describe("TESTE 2/3 — até 3 automações por dia, a 4ª é bloqueada", () => {
  it("permite exatamente 3 usos no mesmo dia e bloqueia o 4º", async () => {
    const userId = await seedUser();
    const now = new Date("2026-09-01T12:00:00.000Z");

    await access.reserveAutomationUse(userId, now);
    await access.reserveAutomationUse(userId, now);
    await access.reserveAutomationUse(userId, now);

    const [afterThree] = await db.sql`select trial_usage_count from automation_subscriptions where user_id = ${userId}`;
    expect(Number(afterThree.trial_usage_count)).toBe(3);

    await expect(access.reserveAutomationUse(userId, now)).rejects.toBeInstanceOf(SubscriptionRequiredError);

    const [afterFourth] = await db.sql`select trial_usage_count from automation_subscriptions where user_id = ${userId}`;
    expect(Number(afterFourth.trial_usage_count)).toBe(3);

    const status = await access.canUseAutomation(userId, now);
    expect(status.allowed).toBe(false);
    expect(status.remainingToday).toBe(0);
  });
});

describe("TESTE 4 — o contador reseta no dia seguinte", () => {
  it("um novo dia civil libera 3 novos usos, mesmo sem o trial ter acabado", async () => {
    const userId = await seedUser();
    const day1 = new Date("2026-09-01T12:00:00.000Z");
    const day2 = new Date("2026-09-02T12:00:00.000Z");

    await access.reserveAutomationUse(userId, day1);
    await access.reserveAutomationUse(userId, day1);
    await access.reserveAutomationUse(userId, day1);
    await expect(access.reserveAutomationUse(userId, day1)).rejects.toBeInstanceOf(SubscriptionRequiredError);

    await access.reserveAutomationUse(userId, day2);
    const [row] = await db.sql`select trial_usage_date, trial_usage_count from automation_subscriptions where user_id = ${userId}`;
    expect(new Date(row.trial_usage_date as string).toISOString().slice(0, 10)).toBe("2026-09-02");
    expect(Number(row.trial_usage_count)).toBe(1);

    const status = await access.canUseAutomation(userId, day2);
    expect(status.remainingToday).toBe(TRIAL_DAILY_LIMIT - 1);
  });
});

describe("TESTE 5 — o trial expira no 8º dia", () => {
  it("bloqueia uso depois de trial_ends_at, mesmo com usos sobrando no dia", async () => {
    const userId = await seedUser();
    const start = new Date("2026-09-01T12:00:00.000Z");
    await access.reserveAutomationUse(userId, start);

    const day8 = new Date(start.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000 + 1000);
    await expect(access.reserveAutomationUse(userId, day8)).rejects.toBeInstanceOf(SubscriptionRequiredError);

    const status = await access.canUseAutomation(userId, day8);
    expect(status.allowed).toBe(false);
    expect(status.status).toBe("EXPIRED");
  });
});

describe("TESTE 6 — ferramentas manuais nunca são afetadas pelo bloqueio do Piloto", () => {
  it("criar um post manual funciona mesmo com o trial expirado", async () => {
    const { userId, accountId, mediaId } = await seedUserWithMedia();
    const start = new Date("2026-09-01T12:00:00.000Z");
    await access.reserveAutomationUse(userId, start);
    const day8 = new Date(start.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000 + 1000);
    await expect(access.reserveAutomationUse(userId, day8)).rejects.toBeInstanceOf(SubscriptionRequiredError);

    const publicationId = await postRepo.createDraftImagePost({
      userId,
      instagramAccountId: accountId,
      mediaId,
      caption: "post manual, sem relação com o Piloto",
      scheduledAtUtc: null,
      timezone: "America/Sao_Paulo",
      source: "MANUAL",
    });
    expect(publicationId).toBeTruthy();

    const [post] = await db.sql`select source from instagram_posts where id = ${publicationId}`;
    expect(post.source).toBe("MANUAL");
  });
});

describe("TESTE 13 — 5 requisições concorrentes nunca ultrapassam o limite diário", () => {
  it("com 2 dos 3 usos já consumidos, só 1 das 5 concorrentes passa", async () => {
    const userId = await seedUser();
    const now = new Date("2026-09-01T12:00:00.000Z");
    await access.reserveAutomationUse(userId, now);
    await access.reserveAutomationUse(userId, now);

    const attempts = await Promise.allSettled([
      access.reserveAutomationUse(userId, now),
      access.reserveAutomationUse(userId, now),
      access.reserveAutomationUse(userId, now),
      access.reserveAutomationUse(userId, now),
      access.reserveAutomationUse(userId, now),
    ]);

    const fulfilled = attempts.filter((result) => result.status === "fulfilled");
    const rejected = attempts.filter((result) => result.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(4);
    for (const failure of rejected) {
      expect((failure as PromiseRejectedResult).reason).toBeInstanceOf(SubscriptionRequiredError);
    }

    const [row] = await db.sql`select trial_usage_count from automation_subscriptions where user_id = ${userId}`;
    expect(Number(row.trial_usage_count)).toBe(3);
  });
});

describe("TESTE 15 — devolver a vaga quando a geração falha depois da reserva", () => {
  it("releaseAutomationUse devolve o uso do trial sem deixar o contador negativo", async () => {
    const userId = await seedUser();
    const now = new Date("2026-09-01T12:00:00.000Z");
    const reservation = await access.reserveAutomationUse(userId, now);

    const [afterReserve] = await db.sql`select trial_usage_count from automation_subscriptions where user_id = ${userId}`;
    expect(Number(afterReserve.trial_usage_count)).toBe(1);

    await access.releaseAutomationUse(reservation);
    const [afterRelease] = await db.sql`select trial_usage_count from automation_subscriptions where user_id = ${userId}`;
    expect(Number(afterRelease.trial_usage_count)).toBe(0);

    // A vaga devolvida pode ser usada de novo no mesmo dia, sem "perder" nada.
    await access.reserveAutomationUse(userId, now);
    await access.reserveAutomationUse(userId, now);
    await access.reserveAutomationUse(userId, now);
    await expect(access.reserveAutomationUse(userId, now)).rejects.toBeInstanceOf(SubscriptionRequiredError);
  });

  it("releaseTrialUsage nunca deixa o contador ficar negativo", async () => {
    const userId = await seedUser();
    const today = "2026-09-01";
    await repo.releaseTrialUsage(userId, today);
    const rows = await db.sql`select * from automation_subscriptions where user_id = ${userId}`;
    expect(rows).toHaveLength(0);
  });
});

describe("Status pós-trial (assinatura Asaas) — sem tocar no contador diário do trial", () => {
  async function seedSubscriptionWithStatus(userId: string, status: string, currentPeriodEndsAt: Date | null) {
    await db.sql`
      insert into automation_subscriptions (user_id, status, current_period_ends_at)
      values (${userId}, ${status}, ${currentPeriodEndsAt ? currentPeriodEndsAt.toISOString() : null})
    `;
  }

  it("ACTIVE tem uso ilimitado, sem depender do contador diário", async () => {
    const userId = await seedUser();
    await seedSubscriptionWithStatus(userId, "ACTIVE", null);
    const now = new Date("2026-09-01T12:00:00.000Z");

    const status = await access.canUseAutomation(userId, now);
    expect(status.allowed).toBe(true);
    expect(status.status).toBe("ACTIVE");
    expect(status.remainingToday).toBeNull();

    const reservation = await access.reserveAutomationUse(userId, now);
    expect(reservation.consumedTrialSlot).toBe(false);
    const [row] = await db.sql`select trial_usage_count from automation_subscriptions where user_id = ${userId}`;
    expect(Number(row.trial_usage_count)).toBe(0);
  });

  it("PAST_DUE bloqueia novos usos sem apagar nada já criado", async () => {
    const userId = await seedUser();
    await seedSubscriptionWithStatus(userId, "PAST_DUE", null);
    const now = new Date("2026-09-01T12:00:00.000Z");

    const status = await access.canUseAutomation(userId, now);
    expect(status.allowed).toBe(false);
    await expect(access.reserveAutomationUse(userId, now)).rejects.toBeInstanceOf(SubscriptionRequiredError);
  });

  it("PENDING_PAYMENT bloqueia até a confirmação do pagamento", async () => {
    const userId = await seedUser();
    await seedSubscriptionWithStatus(userId, "PENDING_PAYMENT", null);
    const now = new Date("2026-09-01T12:00:00.000Z");

    const status = await access.canUseAutomation(userId, now);
    expect(status.allowed).toBe(false);
    expect(status.status).toBe("PENDING_PAYMENT");
  });

  it("CANCELED mantém acesso até o fim do período já pago, depois vira EXPIRED", async () => {
    const userId = await seedUser();
    const now = new Date("2026-09-01T12:00:00.000Z");
    const periodEndsInFuture = new Date("2026-09-10T12:00:00.000Z");
    await seedSubscriptionWithStatus(userId, "CANCELED", periodEndsInFuture);

    const stillActive = await access.canUseAutomation(userId, now);
    expect(stillActive.allowed).toBe(true);
    expect(stillActive.status).toBe("CANCELED");

    const afterPeriodEnds = await access.canUseAutomation(userId, new Date("2026-09-11T00:00:00.000Z"));
    expect(afterPeriodEnds.allowed).toBe(false);
    expect(afterPeriodEnds.status).toBe("EXPIRED");
  });
});
