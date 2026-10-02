// @vitest-environment node
//
// Agenda + lembretes contra Postgres em memória (PGlite): criação, edição,
// cancelamento, exclusão, recorrência, isolamento entre usuários e o cron
// (envio, retry/backoff, falha final, atraso, supressão, concorrência).
// O canal de e-mail é falso — nada sai para a rede.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb, type TestDb } from "../helpers/pglite-db";
import type { ReminderMessage, ReminderSendResult } from "@/lib/agenda/backend/reminder-channels";

let db: TestDb;
vi.mock("@/lib/db/client", () => ({ getDb: () => db.sql, assertDatabaseConfigured: () => undefined }));

const service = await import("@/lib/agenda/backend/agenda-service");
const reminders = await import("@/lib/agenda/backend/reminder-service");
const repo = await import("@/lib/agenda/backend/agenda-repository");
const channels = await import("@/lib/agenda/backend/reminder-channels");
const emailService = await import("@/lib/email/email-service");

const NOW = new Date("2026-10-10T12:00:00.000Z"); // 09:00 em São Paulo
const minutes = (m: number) => new Date(NOW.getTime() + m * 60_000);

const delivered: ReminderMessage[] = [];
let behavior: (message: ReminderMessage) => Promise<ReminderSendResult> = async () => ({ ok: true, providerMessageId: "msg", retryable: false, skipped: false, error: null });

let userA: string;
let userB: string;

beforeAll(async () => {
  db = await createTestDb();
  const [a] = await db.sql`insert into users (email, name) values ('ana@exemplo.com', 'Ana Souza') returning id`;
  const [b] = await db.sql`insert into users (email) values ('bia@exemplo.com') returning id`;
  userA = a.id as string;
  userB = b.id as string;
});
afterAll(async () => {
  await db.close();
});

beforeEach(async () => {
  delivered.length = 0;
  behavior = async () => ({ ok: true, providerMessageId: `msg-${delivered.length}`, retryable: false, skipped: false, error: null });
  channels.__setReminderSendersForTests({
    EMAIL: {
      channel: "EMAIL",
      async send(message) {
        delivered.push(message);
        return behavior(message);
      },
    },
  });
  await db.sql`delete from agenda_reminders`;
  await db.sql`delete from agenda_events`;
  await db.sql`delete from agenda_preferences`;
  await db.sql`delete from email_suppressions`;
  vi.spyOn(console, "info").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

const cron = (at: Date) => reminders.runAgendaReminderCron({ now: () => at });
const nextAttempt = async (eventId: string) => {
  const [row] = await db.sql`select next_attempt_at from agenda_reminders where event_id = ${eventId}`;
  return new Date(row.next_attempt_at as string).toISOString();
};
const pending = async (eventId: string) => (await repo.listRemindersForEvent(eventId)).filter((r) => r.status === "PENDING");

describe("cadastro", () => {
  it("cadastro rápido: só título e data → dia inteiro, lembrete padrão de 1 h (antes das 9h)", async () => {
    const event = await service.createAgendaEvent(userA, { title: "Pagar luz", date: "2026-10-12" }, NOW);
    expect(event.isAllDay).toBe(true);
    expect(event.reminderOffsets).toEqual([60]);
    const list = await pending(event.id);
    expect(list).toHaveLength(1);
    expect(list[0].remindAt.toISOString()).toBe("2026-10-12T11:00:00.000Z"); // 8h locais
  });

  it("com hora e dois lembretes cria dois pendentes", async () => {
    const event = await service.createAgendaEvent(userA, { title: "Dentista", date: "2026-10-11", time: "14:00", reminders: [1440, 60] }, NOW);
    expect(event.isAllDay).toBe(false);
    expect(event.startAt.toISOString()).toBe("2026-10-11T17:00:00.000Z");
    expect((await pending(event.id)).map((r) => r.offsetMinutes).sort((a, b) => a - b)).toEqual([60, 1440]);
  });

  it("valida título obrigatório e término antes do início", async () => {
    await expect(service.createAgendaEvent(userA, { title: " ", date: "2026-10-11" }, NOW)).rejects.toThrow(/título/);
    await expect(service.createAgendaEvent(userA, { title: "X", date: "2026-10-11", time: "14:00", endTime: "13:00" }, NOW)).rejects.toThrow(/término/);
    await expect(service.createAgendaEvent(userA, { title: "X", date: "2026-10-11", reminders: [1, 2, 3, 4, 5, 6] }, NOW)).rejects.toThrow(/No máximo/);
  });

  it("lembrete que já passou não é criado", async () => {
    const event = await service.createAgendaEvent(userA, { title: "Já já", date: "2026-10-10", time: "09:30", reminders: [60, 10] }, NOW);
    expect((await pending(event.id)).map((r) => r.offsetMinutes)).toEqual([10]);
  });
});

describe("isolamento entre usuários", () => {
  it("outro usuário não vê, não edita, não exclui", async () => {
    const event = await service.createAgendaEvent(userA, { title: "Privado", date: "2026-10-11" }, NOW);
    await expect(service.getAgendaEvent(userB, event.id)).rejects.toMatchObject({ httpStatus: 404 });
    await expect(service.editAgendaEvent(userB, event.id, { title: "Hack", date: "2026-10-11" }, NOW)).rejects.toMatchObject({ httpStatus: 404 });
    await expect(service.deleteAgendaEvent(userB, event.id)).rejects.toMatchObject({ httpStatus: 404 });
    await expect(service.changeAgendaStatus(userB, event.id, "CANCELLED", NOW)).rejects.toMatchObject({ httpStatus: 404 });
    const listB = await service.listAgenda(userB, NOW, minutes(7 * 1440));
    expect(listB.events).toHaveLength(0);
    expect((await service.getAgendaEvent(userA, event.id)).title).toBe("Privado");
  });
});

describe("edição, cancelamento e exclusão", () => {
  it("editar a hora recalcula os pendentes e não reenvia o que já foi", async () => {
    const event = await service.createAgendaEvent(userA, { title: "Reunião", date: "2026-10-10", time: "10:00", reminders: [30] }, NOW);
    expect(await cron(minutes(31))).toMatchObject({ sent: 1 }); // 09:31 → lembrete das 09:30
    expect(delivered).toHaveLength(1);

    // mesmo horário de novo: o lembrete já enviado não volta a ficar pendente
    await service.editAgendaEvent(userA, event.id, { title: "Reunião", date: "2026-10-10", time: "10:00", reminders: [30] }, minutes(32));
    expect(await pending(event.id)).toHaveLength(0);

    // novo horário: novo lembrete
    await service.editAgendaEvent(userA, event.id, { title: "Reunião (adiada)", date: "2026-10-10", time: "15:00", reminders: [30] }, minutes(32));
    const list = await pending(event.id);
    expect(list).toHaveLength(1);
    expect(list[0].remindAt.toISOString()).toBe("2026-10-10T17:30:00.000Z");
  });

  it("cancelar cancela os pendentes; reabrir recria", async () => {
    const event = await service.createAgendaEvent(userA, { title: "Festa", date: "2026-10-11", time: "20:00" }, NOW);
    await service.changeAgendaStatus(userA, event.id, "CANCELLED", NOW);
    expect(await pending(event.id)).toHaveLength(0);
    expect((await repo.listRemindersForEvent(event.id))[0].status).toBe("CANCELLED");
    await service.changeAgendaStatus(userA, event.id, "SCHEDULED", NOW);
    expect(await pending(event.id)).toHaveLength(1);
    expect(await repo.listRemindersForEvent(event.id)).toHaveLength(1);
  });

  it("excluir é soft delete, some da lista e não envia lembrete", async () => {
    const event = await service.createAgendaEvent(userA, { title: "Apagar", date: "2026-10-10", time: "10:00", reminders: [30] }, NOW);
    await service.deleteAgendaEvent(userA, event.id);
    const [row] = await db.sql`select deleted_at from agenda_events where id = ${event.id}`;
    expect(row.deleted_at).not.toBeNull();
    expect((await service.listAgenda(userA, NOW, minutes(1440))).events).toHaveLength(0);
    expect(await cron(minutes(31))).toMatchObject({ sent: 0 });
    expect(delivered).toHaveLength(0);
  });
});

describe("recorrência", () => {
  it("semanal: lista ocorrências e, após enviar, agenda a próxima", async () => {
    const event = await service.createAgendaEvent(userA, { title: "Inglês", date: "2026-10-10", time: "10:00", recurrence: "WEEKLY", reminders: [30] }, NOW);
    const { occurrences } = await service.listAgenda(userA, NOW, minutes(21 * 1440));
    expect(occurrences.filter((o) => o.eventId === event.id)).toHaveLength(3);

    const result = await cron(minutes(31));
    expect(result.sent).toBe(1);
    expect(result.scheduled).toBe(1);
    const next = await pending(event.id);
    expect(next).toHaveLength(1);
    expect(next[0].occurrenceStartAt.toISOString()).toBe("2026-10-17T13:00:00.000Z");
  });
});

describe("cron de lembretes", () => {
  it("envia uma vez, com link e quando no fuso do usuário", async () => {
    const event = await service.createAgendaEvent(userA, { title: "Médico", date: "2026-10-10", time: "14:30", reminders: [60], location: "Clínica" }, NOW);
    expect(await cron(minutes(4 * 60))).toMatchObject({ claimed: 0 }); // 13:00 local: ainda não
    expect(await cron(minutes(4 * 60 + 30))).toMatchObject({ claimed: 1, sent: 1 }); // 13:30 local
    expect(delivered).toHaveLength(1);
    expect(delivered[0]).toMatchObject({ to: "ana@exemplo.com", firstName: "Ana", title: "Médico", whenLabel: "Hoje às 14:30", location: "Clínica" });
    expect(delivered[0].url).toContain(`/agenda?evento=${event.id}`);
    expect(await cron(minutes(4 * 60 + 31))).toMatchObject({ claimed: 0, sent: 0 });
    expect(delivered).toHaveLength(1);
  });

  it("falha temporária: tenta de novo em 1, 5 e 15 min e depois marca FAILED", async () => {
    behavior = async () => ({ ok: false, providerMessageId: null, retryable: true, skipped: false, error: "rate_limit_exceeded" });
    const event = await service.createAgendaEvent(userA, { title: "Retry", date: "2026-10-10", time: "12:00", reminders: [60] }, NOW);
    // compromisso 12:00 local (15:00Z), lembrete 1 h antes = 14:00Z
    expect(await cron(new Date("2026-10-10T14:00:00.000Z"))).toMatchObject({ retried: 1 });
    let [r] = await repo.listRemindersForEvent(event.id);
    expect(r.status).toBe("PENDING");
    expect(await nextAttempt(event.id)).toBe("2026-10-10T14:01:00.000Z");

    expect(await cron(new Date("2026-10-10T14:00:30.000Z"))).toMatchObject({ claimed: 0 }); // backoff respeitado
    expect(await cron(new Date("2026-10-10T14:01:00.000Z"))).toMatchObject({ retried: 1 });
    expect(await nextAttempt(event.id)).toBe("2026-10-10T14:06:00.000Z");
    expect(await cron(new Date("2026-10-10T14:06:00.000Z"))).toMatchObject({ retried: 1 });
    expect(await nextAttempt(event.id)).toBe("2026-10-10T14:21:00.000Z");
    expect(await cron(new Date("2026-10-10T14:21:00.000Z"))).toMatchObject({ failed: 1 });
    [r] = await repo.listRemindersForEvent(event.id);
    expect(r.status).toBe("FAILED");
    expect(r.attemptCount).toBe(4);
    expect(delivered).toHaveLength(4);
  });

  it("erro permanente vai direto para FAILED", async () => {
    behavior = async () => ({ ok: false, providerMessageId: null, retryable: false, skipped: false, error: "validation_error" });
    const event = await service.createAgendaEvent(userA, { title: "Perm", date: "2026-10-10", time: "12:00", reminders: [60] }, NOW);
    expect(await cron(new Date("2026-10-10T14:00:00.000Z"))).toMatchObject({ failed: 1 });
    expect((await repo.listRemindersForEvent(event.id))[0].status).toBe("FAILED");
  });

  it("cron fora do ar: lembrete atrasado depois do início é SKIPPED (não avisa depois)", async () => {
    const event = await service.createAgendaEvent(userA, { title: "Perdido", date: "2026-10-10", time: "10:00", reminders: [30] }, NOW);
    expect(await cron(new Date("2026-10-10T13:05:00.000Z"))).toMatchObject({ skipped: 1, sent: 0 });
    expect((await repo.listRemindersForEvent(event.id))[0].status).toBe("SKIPPED");
  });

  it("preferência desligada e endereço suprimido: SKIPPED sem enviar", async () => {
    await service.updateUserPreferences(userA, { emailRemindersEnabled: false });
    await service.createAgendaEvent(userA, { title: "Off", date: "2026-10-10", time: "10:00", reminders: [30] }, NOW);
    expect(await cron(minutes(31))).toMatchObject({ skipped: 1 });
    expect(delivered).toHaveLength(0);

    // supressão é verificada pelo EmailService real
    channels.__setReminderSendersForTests(null);
    emailService.__setEmailProviderForTests({ id: "fake", send: async () => ({ ok: true, providerMessageId: "x", retryable: false, error: null }) });
    process.env.EMAIL_FROM = "Alilu <nao-responda@alilu.com.br>";
    await db.sql`insert into email_suppressions (email, reason) values ('bia@exemplo.com', 'email.complained')`;
    const event = await service.createAgendaEvent(userB, { title: "Sup", date: "2026-10-10", time: "10:00", reminders: [30] }, NOW);
    expect(await cron(minutes(31))).toMatchObject({ skipped: 1 });
    expect((await repo.listRemindersForEvent(event.id))[0].status).toBe("SKIPPED");
    emailService.__setEmailProviderForTests(null);
  });

  it("dois crons ao mesmo tempo: o lembrete é enviado uma vez só", async () => {
    behavior = async () => {
      await new Promise((resolve) => setTimeout(resolve, 30));
      return { ok: true, providerMessageId: "m", retryable: false, skipped: false, error: null };
    };
    await service.createAgendaEvent(userA, { title: "Concorrente", date: "2026-10-10", time: "10:00", reminders: [30, 10] }, NOW);
    const at = minutes(51); // os dois lembretes vencidos
    const results = await Promise.all([cron(at), cron(at), cron(at)]);
    expect(results.reduce((sum, r) => sum + r.sent, 0)).toBe(2);
    expect(delivered).toHaveLength(2);
    expect(new Set(delivered.map((m) => m.reminderId)).size).toBe(2);
  });

  it("lock vencido (cron morreu no meio) é retomado por outro ciclo", async () => {
    const event = await service.createAgendaEvent(userA, { title: "Travado", date: "2026-10-10", time: "10:00", reminders: [30] }, NOW);
    const claimed = await repo.claimDueReminders(minutes(31), "token-morto", 10);
    expect(claimed).toHaveLength(1);
    expect(await cron(minutes(32))).toMatchObject({ claimed: 0 }); // ainda travado
    expect(await cron(minutes(34))).toMatchObject({ sent: 1 }); // trava de 2 min venceu
    expect((await repo.listRemindersForEvent(event.id))[0].status).toBe("SENT");
  });
});
