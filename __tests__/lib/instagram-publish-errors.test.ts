// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  ContainerProcessingError,
  MAX_RETRIES,
  PublishValidationError,
  classifyPublishError,
  computeNextRetryAt,
} from "@/lib/instagram/backend/publish-errors";

function graphError(details: unknown) {
  const error = new Error("x") as Error & { details: unknown };
  error.name = "InstagramGraphApiError";
  error.details = details;
  return error;
}

describe("classifyPublishError", () => {
  it.each([
    [{ error: { code: 2 } }, "transient"],
    [{ error: { code: 4 } }, "transient"],
    [{ error: { code: 17 } }, "transient"],
    [{ error: { code: 100, is_transient: true } }, "transient"],
    ["<html>502 Bad Gateway</html>", "transient"],
    [{ error: { code: 190 } }, "permanent"],
    [{ error: { code: 10 } }, "permanent"],
    [{ error: { code: 200 } }, "permanent"],
    [{ error: { code: 9004 } }, "permanent"],
    [{ error: { code: 100, error_subcode: 2207026 } }, "permanent"],
  ])("%j -> %s", (details, kind) => {
    expect(classifyPublishError(graphError(details)).kind).toBe(kind);
  });

  it("token inválido pede para renovar a conexão", () => {
    expect(classifyPublishError(graphError({ error: { code: 190 } })).message).toBe(
      "Sua conexão com o Instagram precisa ser renovada.",
    );
  });

  it("falha de rede é temporária; validação e container com erro são permanentes", () => {
    expect(classifyPublishError(new TypeError("fetch failed")).kind).toBe("transient");
    expect(classifyPublishError(new PublishValidationError("x")).kind).toBe("permanent");
    expect(classifyPublishError(new ContainerProcessingError("ERROR")).kind).toBe("permanent");
  });
});

describe("computeNextRetryAt (backoff 5/15/60 min)", () => {
  const now = new Date("2026-09-24T10:00:00.000Z");
  it("aplica os atrasos e para depois da 3ª retentativa", () => {
    expect(computeNextRetryAt(0, now)?.toISOString()).toBe("2026-09-24T10:05:00.000Z");
    expect(computeNextRetryAt(1, now)?.toISOString()).toBe("2026-09-24T10:15:00.000Z");
    expect(computeNextRetryAt(2, now)?.toISOString()).toBe("2026-09-24T11:00:00.000Z");
    expect(computeNextRetryAt(MAX_RETRIES, now)).toBeNull();
  });
});
