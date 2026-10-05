// @vitest-environment node
// Envio direto ao Blob: fallback sem stream quando o navegador recusa o
// envio por stream ("ReadableStream is disturbed" — bug real do Split
// Screen no Chrome/Windows) e mensagens pela causa real, nunca "conexão" à toa.
import { afterEach, describe, expect, it, vi } from "vitest";

const uploadPresignedMock = vi.fn();
vi.mock("@vercel/blob/client", () => ({ uploadPresigned: (...a: unknown[]) => uploadPresignedMock(...a) }));

const { classifyUploadError, describeUploadError, uploadPresignedResilient } = await import("@/lib/client/blob-upload");

const file = new Blob([new Uint8Array(10)], { type: "video/mp4" });
const disturbed = new TypeError("Failed to execute 'fetch' on 'Window': The provided ReadableStream is disturbed");

afterEach(() => uploadPresignedMock.mockReset());

describe("uploadPresignedResilient", () => {
  it("stream recusado → repete SEM onUploadProgress (corpo = arquivo) e avisa o fallback", async () => {
    uploadPresignedMock.mockRejectedValueOnce(disturbed).mockResolvedValueOnce({ url: "https://blob/x.mp4" });
    const onFallback = vi.fn();
    const out = await uploadPresignedResilient("videos/uploads/a.mp4", file, { access: "public", handleUploadUrl: "/api/videos/upload", onUploadProgress: () => undefined }, { onFallback });
    expect(out).toEqual({ result: { url: "https://blob/x.mp4" }, usedFallback: true, firstError: expect.stringContaining("disturbed") });
    expect(onFallback).toHaveBeenCalledTimes(1);
    expect(uploadPresignedMock.mock.calls[0][2].onUploadProgress).toBeTypeOf("function");
    expect(uploadPresignedMock.mock.calls[1][2]).not.toHaveProperty("onUploadProgress");
    expect(uploadPresignedMock.mock.calls[1][2]).toMatchObject({ access: "public", handleUploadUrl: "/api/videos/upload" });
  });

  it("outros erros não repetem (ex.: arquivo grande demais)", async () => {
    uploadPresignedMock.mockRejectedValueOnce(new Error("Vercel Blob: File is too large, max 100MB."));
    await expect(uploadPresignedResilient("p", file, { access: "public", handleUploadUrl: "/u", onUploadProgress: () => undefined })).rejects.toThrow(/too large/);
    expect(uploadPresignedMock).toHaveBeenCalledTimes(1);
  });

  it("sem barra de progresso não há stream: devolve direto", async () => {
    uploadPresignedMock.mockResolvedValueOnce({ url: "u" });
    expect(await uploadPresignedResilient("p", file, { access: "public", handleUploadUrl: "/u" })).toMatchObject({ usedFallback: false });
  });
});

describe("classifyUploadError / describeUploadError", () => {
  it.each([
    [new Error("Vercel Blob: File is too large, max 100MB."), "UPLOAD_TOO_LARGE"],
    [new Error("Vercel Blob: Content type mismatch, video/avi is not allowed."), "UPLOAD_TYPE_NOT_ALLOWED"],
    [new Error("Vercel Blob: Failed to retrieve the presigned URL"), "UPLOAD_TOKEN_ERROR"],
    [new Error("Vercel Blob: Access denied, please provide a valid token for this resource."), "UPLOAD_AUTH_ERROR"],
    [new Error("Vercel Blob: The blob service is currently not available. Please try again."), "UPLOAD_STORAGE_ERROR"],
    [new Error("Vercel Blob: The request was aborted."), "UPLOAD_ABORTED"],
    [disturbed, "UPLOAD_STREAM_REJECTED"],
    [new TypeError("Failed to fetch"), "UPLOAD_NETWORK_ERROR"],
  ])("%s → %s", (error, code) => {
    expect(classifyUploadError(error)).toBe(code);
  });

  it("mensagens específicas por causa", () => {
    expect(describeUploadError("UPLOAD_TOO_LARGE", "vídeo complementar", 100)).toBe("O vídeo complementar excede o limite permitido (100 MB).");
    expect(describeUploadError("UPLOAD_AUTH_ERROR", "vídeo")).toBe("Sua sessão expirou. Entre novamente e tente de novo.");
    expect(describeUploadError("UPLOAD_NETWORK_ERROR", "vídeo principal")).toMatch(/Verifique sua conexão/);
    expect(describeUploadError("UPLOAD_STORAGE_ERROR", "vídeo")).toMatch(/não conseguiu armazenar/);
  });
});
