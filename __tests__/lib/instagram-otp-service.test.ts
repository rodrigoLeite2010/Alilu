// @vitest-environment node
//
// Testa a REGRA DE NEGÓCIO de otp-service.ts (rate limit, expiração,
// tentativas, consumo único) mockando apenas a camada de repositório
// (otp-repository.ts) — sem precisar de um banco de verdade. A lógica de
// hash/verificação usada aqui é a real (importada de ./otp), só o acesso
// a dados é substituído.
import { beforeEach, describe, expect, it, vi } from "vitest";

const repositoryMocks = vi.hoisted(() => ({
  countRecentOtpRequests: vi.fn(),
  insertOtpCode: vi.fn(),
  findLatestOtpForEmail: vi.fn(),
  incrementOtpAttempts: vi.fn(),
  markOtpConsumed: vi.fn(),
}));

vi.mock("@/lib/instagram/backend/otp-repository", () => repositoryMocks);

const { hashOtpCode } = await import("@/lib/instagram/backend/otp");
const {
  OtpExpiredError,
  OtpInvalidError,
  OtpRateLimitError,
  OtpTooManyAttemptsError,
  requestOtp,
  verifyOtp,
} = await import("@/lib/instagram/backend/otp-service");

const EMAIL = "usuario@exemplo.com";

function makeRecord(overrides: Partial<{
  id: string;
  codeHash: string;
  expiresAt: Date;
  attempts: number;
  consumedAt: Date | null;
}> = {}) {
  return {
    id: "otp-1",
    codeHash: hashOtpCode("123456"),
    expiresAt: new Date(Date.now() + 5 * 60_000),
    attempts: 0,
    consumedAt: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  repositoryMocks.countRecentOtpRequests.mockResolvedValue(0);
  repositoryMocks.insertOtpCode.mockResolvedValue(undefined);
  repositoryMocks.incrementOtpAttempts.mockResolvedValue(undefined);
  repositoryMocks.markOtpConsumed.mockResolvedValue(undefined);
});

describe("requestOtp", () => {
  it("gera um código, grava o hash no repositório e retorna o código em claro", async () => {
    const { code } = await requestOtp(`  ${EMAIL.toUpperCase()}  `);

    expect(code).toMatch(/^\d{6}$/);
    expect(repositoryMocks.countRecentOtpRequests).toHaveBeenCalledWith(EMAIL, 60);
    expect(repositoryMocks.insertOtpCode).toHaveBeenCalledTimes(1);

    const [emailArg, codeHashArg, expiresAtArg] = repositoryMocks.insertOtpCode.mock.calls[0];
    expect(emailArg).toBe(EMAIL);
    expect(codeHashArg).not.toBe(code);
    expect(expiresAtArg).toBeInstanceOf(Date);
  });

  it("lança OtpRateLimitError quando o e-mail já pediu códigos demais na última hora", async () => {
    repositoryMocks.countRecentOtpRequests.mockResolvedValue(5);

    await expect(requestOtp(EMAIL)).rejects.toBeInstanceOf(OtpRateLimitError);
    expect(repositoryMocks.insertOtpCode).not.toHaveBeenCalled();
  });
});

describe("verifyOtp", () => {
  it("marca o código como consumido quando ele está correto", async () => {
    const record = makeRecord();
    repositoryMocks.findLatestOtpForEmail.mockResolvedValue(record);

    await verifyOtp(EMAIL, "123456");

    expect(repositoryMocks.markOtpConsumed).toHaveBeenCalledWith(record.id);
    expect(repositoryMocks.incrementOtpAttempts).not.toHaveBeenCalled();
  });

  it("lança OtpInvalidError e incrementa as tentativas quando o código está errado", async () => {
    const record = makeRecord();
    repositoryMocks.findLatestOtpForEmail.mockResolvedValue(record);

    await expect(verifyOtp(EMAIL, "000000")).rejects.toBeInstanceOf(OtpInvalidError);
    expect(repositoryMocks.incrementOtpAttempts).toHaveBeenCalledWith(record.id);
    expect(repositoryMocks.markOtpConsumed).not.toHaveBeenCalled();
  });

  it("lança OtpInvalidError quando não há nenhum código pendente para o e-mail", async () => {
    repositoryMocks.findLatestOtpForEmail.mockResolvedValue(null);

    await expect(verifyOtp(EMAIL, "123456")).rejects.toBeInstanceOf(OtpInvalidError);
  });

  it("lança OtpInvalidError quando o código já foi consumido antes", async () => {
    const record = makeRecord({ consumedAt: new Date() });
    repositoryMocks.findLatestOtpForEmail.mockResolvedValue(record);

    await expect(verifyOtp(EMAIL, "123456")).rejects.toBeInstanceOf(OtpInvalidError);
    expect(repositoryMocks.incrementOtpAttempts).not.toHaveBeenCalled();
  });

  it("lança OtpExpiredError quando o código já expirou", async () => {
    const record = makeRecord({ expiresAt: new Date(Date.now() - 1_000) });
    repositoryMocks.findLatestOtpForEmail.mockResolvedValue(record);

    await expect(verifyOtp(EMAIL, "123456")).rejects.toBeInstanceOf(OtpExpiredError);
    expect(repositoryMocks.incrementOtpAttempts).not.toHaveBeenCalled();
  });

  it("lança OtpTooManyAttemptsError quando o limite de tentativas já foi excedido", async () => {
    const record = makeRecord({ attempts: 5 });
    repositoryMocks.findLatestOtpForEmail.mockResolvedValue(record);

    await expect(verifyOtp(EMAIL, "123456")).rejects.toBeInstanceOf(OtpTooManyAttemptsError);
    expect(repositoryMocks.incrementOtpAttempts).not.toHaveBeenCalled();
  });

  it("normaliza o e-mail antes de consultar o repositório", async () => {
    const record = makeRecord();
    repositoryMocks.findLatestOtpForEmail.mockResolvedValue(record);

    await verifyOtp(`  ${EMAIL.toUpperCase()}  `, "123456");

    expect(repositoryMocks.findLatestOtpForEmail).toHaveBeenCalledWith(EMAIL);
  });
});
