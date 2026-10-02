// @vitest-environment node
//
// EmailService (log, supressão, erro do provedor), templates e webhook do
// Resend (assinatura svix real, idempotência, bounce → supressão) contra
// Postgres em memória (PGlite). O provedor de envio é falso — sem rede.
import { createHmac, randomBytes } from "node:crypto";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb, type TestDb } from "../helpers/pglite-db";
import type { ProviderSendInput, ProviderSendResult } from "@/lib/email/types";

let db: TestDb;
vi.mock("@/lib/db/client", () => ({ getDb: () => db.sql, assertDatabaseConfigured: () => undefined }));

const { sendEmail, __setEmailProviderForTests, isEmailSuppressed } = await import("@/lib/email/email-service");
const { verifyResendWebhook, processResendWebhookEvent, WebhookSignatureError } = await import("@/lib/email/webhook-service");
const { loginCodeEmail } = await import("@/lib/email/templates/login-code");
const { agendaReminderEmail } = await import("@/lib/email/templates/agenda");
const webhookRoute = await import("@/app/api/webhooks/resend/route");

const sent: ProviderSendInput[] = [];
let nextResult: ProviderSendResult = { ok: true, providerMessageId: "msg-1", retryable: false, error: null };

const SECRET_BYTES = randomBytes(24);
const WEBHOOK_SECRET = `whsec_${SECRET_BYTES.toString("base64")}`;

function sign(id: string, timestamp: string, payload: string): string {
  return `v1,${createHmac("sha256", SECRET_BYTES).update(`${id}.${timestamp}.${payload}`).digest("base64")}`;
}

beforeAll(async () => {
  db = await createTestDb();
});
afterAll(async () => {
  await db.close();
});

beforeEach(async () => {
  process.env.EMAIL_FROM = "Alilu <nao-responda@alilu.com.br>";
  process.env.RESEND_WEBHOOK_SECRET = WEBHOOK_SECRET;
  sent.length = 0;
  nextResult = { ok: true, providerMessageId: `msg-${Math.random().toString(36).slice(2)}`, retryable: false, error: null };
  __setEmailProviderForTests({
    id: "fake",
    async send(input) {
      sent.push(input);
      return nextResult;
    },
  });
  await db.sql`delete from email_delivery_logs`;
  await db.sql`delete from email_webhook_events`;
  await db.sql`delete from email_suppressions`;
  vi.spyOn(console, "info").mockImplementation(() => undefined);
});
afterEach(() => {
  __setEmailProviderForTests(null);
  vi.restoreAllMocks();
});

describe("templates", () => {
  it("código de login: assunto fixo, código no HTML e no texto, escapando HTML", () => {
    const email = loginCodeEmail({ code: "482913", expiresInMinutes: 10 });
    expect(email.subject).toBe("Seu código de acesso ao Alilu");
    expect(email.html).toContain("482913");
    expect(email.text).toContain("482913");
    expect(email.text).toContain("10 minutos");
  });

  it("lembrete escapa o título do usuário (sem injeção de HTML)", () => {
    const email = agendaReminderEmail({ firstName: "Ana", title: "<script>x</script>", whenLabel: "Hoje às 14:30", location: null, url: "https://alilu.com.br/agenda" });
    expect(email.html).not.toContain("<script>x</script>");
    expect(email.html).toContain("&lt;script&gt;");
    expect(email.subject).toContain("hoje às 14:30");
  });
});

describe("sendEmail", () => {
  it("envia, grava o log sem conteúdo e repassa a Idempotency-Key", async () => {
    nextResult = { ok: true, providerMessageId: "msg-abc", retryable: false, error: null };
    const result = await sendEmail({ to: " Pessoa@Exemplo.com ", type: "LOGIN_CODE", idempotencyKey: "k-1", ...loginCodeEmail({ code: "111222", expiresInMinutes: 10 }) });

    expect(result.ok).toBe(true);
    expect(sent[0].to).toBe("pessoa@exemplo.com");
    expect(sent[0].idempotencyKey).toBe("k-1");
    expect(sent[0].from).toBe("Alilu <nao-responda@alilu.com.br>");
    const [log] = await db.sql`select * from email_delivery_logs`;
    expect(log.status).toBe("QUEUED");
    expect(log.provider_message_id).toBe("msg-abc");
    expect(JSON.stringify(log)).not.toContain("111222");
  });

  it("erro do Resend vira status ERROR com a mensagem, e retryable é repassado", async () => {
    nextResult = { ok: false, providerMessageId: null, retryable: true, error: "rate_limit_exceeded: Too many requests" };
    const result = await sendEmail({ to: "a@b.com", type: "AGENDA_REMINDER", ...agendaReminderEmail({ firstName: null, title: "X", whenLabel: "Hoje", location: null, url: "u" }) });
    expect(result).toMatchObject({ ok: false, retryable: true });
    const [log] = await db.sql`select status, error_message from email_delivery_logs`;
    expect(log.status).toBe("ERROR");
    expect(log.error_message).toContain("rate_limit_exceeded");
  });

  it("endereço suprimido não recebe lembrete, mas recebe o código de login", async () => {
    await db.sql`insert into email_suppressions (email, reason) values ('sup@exemplo.com', 'email.bounced')`;
    const reminder = await sendEmail({ to: "sup@exemplo.com", type: "AGENDA_REMINDER", ...agendaReminderEmail({ firstName: null, title: "X", whenLabel: "Hoje", location: null, url: "u" }) });
    expect(reminder).toMatchObject({ ok: false, suppressed: true });
    expect(sent).toHaveLength(0);

    const login = await sendEmail({ to: "sup@exemplo.com", type: "LOGIN_CODE", ...loginCodeEmail({ code: "123456", expiresInMinutes: 10 }) });
    expect(login.ok).toBe(true);
    expect(sent).toHaveLength(1);
  });

  it("sem EMAIL_FROM/RESEND_FROM_EMAIL falha antes de chamar o provedor", async () => {
    delete process.env.EMAIL_FROM;
    const previous = process.env.RESEND_FROM_EMAIL;
    delete process.env.RESEND_FROM_EMAIL;
    await expect(sendEmail({ to: "a@b.com", type: "LOGIN_CODE", ...loginCodeEmail({ code: "1", expiresInMinutes: 10 }) })).rejects.toThrow(/EMAIL_FROM/);
    expect(sent).toHaveLength(0);
    if (previous) process.env.RESEND_FROM_EMAIL = previous;
  });
});

describe("webhook do Resend", () => {
  async function logWithMessage(messageId: string, to = "dest@exemplo.com") {
    await db.sql`insert into email_delivery_logs (to_email, email_type, provider, status, provider_message_id) values (${to}, 'AGENDA_REMINDER', 'resend', 'QUEUED', ${messageId})`;
  }
  function request(body: string, headers: Record<string, string>) {
    return new Request("https://alilu.com.br/api/webhooks/resend", { method: "POST", body, headers });
  }

  it("aceita assinatura válida e marca o e-mail como entregue", async () => {
    await logWithMessage("m-1");
    const payload = JSON.stringify({ type: "email.delivered", created_at: new Date().toISOString(), data: { email_id: "m-1", to: ["dest@exemplo.com"] } });
    const ts = String(Math.floor(Date.now() / 1000));
    const response = await webhookRoute.POST(request(payload, { "svix-id": "evt_1", "svix-timestamp": ts, "svix-signature": sign("evt_1", ts, payload) }));
    expect(response.status).toBe(200);
    const [log] = await db.sql`select status, delivered_at from email_delivery_logs where provider_message_id = 'm-1'`;
    expect(log.status).toBe("DELIVERED");
    expect(log.delivered_at).not.toBeNull();
  });

  it("recusa assinatura inválida (401) sem gravar nada", async () => {
    await logWithMessage("m-2");
    const payload = JSON.stringify({ type: "email.delivered", data: { email_id: "m-2" } });
    const ts = String(Math.floor(Date.now() / 1000));
    const response = await webhookRoute.POST(request(payload, { "svix-id": "evt_2", "svix-timestamp": ts, "svix-signature": "v1,AAAAinvalida" }));
    expect(response.status).toBe(401);
    expect(await db.sql`select * from email_webhook_events`).toHaveLength(0);
    const [log] = await db.sql`select status from email_delivery_logs where provider_message_id = 'm-2'`;
    expect(log.status).toBe("QUEUED");
  });

  it("recusa sem cabeçalhos e quando o corpo foi alterado depois de assinado", () => {
    expect(() => verifyResendWebhook("{}", { id: null, timestamp: null, signature: null })).toThrow(WebhookSignatureError);
    const ts = String(Math.floor(Date.now() / 1000));
    const signature = sign("evt_x", ts, '{"a":1}');
    expect(() => verifyResendWebhook('{"a":2}', { id: "evt_x", timestamp: ts, signature })).toThrow(WebhookSignatureError);
  });

  it("evento repetido (mesmo svix-id) é ignorado", async () => {
    await logWithMessage("m-3");
    const event = { type: "email.delivered", data: { email_id: "m-3", to: ["dest@exemplo.com"] } };
    expect(await processResendWebhookEvent("evt_3", event)).toBe("processed");
    expect(await processResendWebhookEvent("evt_3", event)).toBe("duplicate");
  });

  it("entregue não volta para 'enviado' se o email.sent chegar atrasado", async () => {
    await logWithMessage("m-4");
    await processResendWebhookEvent("evt_4a", { type: "email.delivered", data: { email_id: "m-4" } });
    await processResendWebhookEvent("evt_4b", { type: "email.sent", data: { email_id: "m-4" } });
    const [log] = await db.sql`select status from email_delivery_logs where provider_message_id = 'm-4'`;
    expect(log.status).toBe("DELIVERED");
  });

  it("bounce permanente e spam suprimem o endereço na hora", async () => {
    await logWithMessage("m-5", "ruim@exemplo.com");
    await processResendWebhookEvent("evt_5", { type: "email.bounced", data: { email_id: "m-5", to: ["ruim@exemplo.com"], bounce: { type: "Permanent", subType: "General", message: "no such user" } } });
    expect(await isEmailSuppressed("ruim@exemplo.com")).toBe(true);
    const [log] = await db.sql`select status, error_message from email_delivery_logs where provider_message_id = 'm-5'`;
    expect(log.status).toBe("BOUNCED");
    expect(log.error_message).toContain("no such user");

    await logWithMessage("m-6", "spam@exemplo.com");
    await processResendWebhookEvent("evt_6", { type: "email.complained", data: { email_id: "m-6", to: ["spam@exemplo.com"] } });
    expect(await isEmailSuppressed("spam@exemplo.com")).toBe(true);
  });

  it("bounce temporário só suprime a partir do 3º em 30 dias", async () => {
    for (let index = 1; index <= 3; index += 1) {
      await logWithMessage(`t-${index}`, "cheia@exemplo.com");
      await processResendWebhookEvent(`evt_t${index}`, { type: "email.bounced", data: { email_id: `t-${index}`, to: ["cheia@exemplo.com"], bounce: { type: "Transient", subType: "MailboxFull", message: "full" } } });
      expect(await isEmailSuppressed("cheia@exemplo.com")).toBe(index >= 3);
    }
  });
});
