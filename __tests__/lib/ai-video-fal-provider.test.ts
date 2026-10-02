// Provedor fal.ai (Econômico — Wan 2.2 5B): fila REST, classificação de falhas, chave nunca exposta.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fal = await import("@/lib/ai-video/backend/providers/fal-provider");
const { ImageToVideoProviderError } = await import("@/lib/ai-video/backend/providers/provider");

const MODEL = "fal-ai/wan/v2.2-5b/image-to-video";
/** Status/resultado/cancelamento usam só dono/app (como o @fal-ai/client). */
const APP = "fal-ai/wan";
const originalFetch = global.fetch;
const originalKey = process.env.FAL_KEY;
const fetchMock = vi.fn();

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

beforeEach(() => {
  fetchMock.mockReset();
  global.fetch = fetchMock as unknown as typeof fetch;
  process.env.FAL_KEY = "fal-key-de-teste";
});

afterEach(() => {
  global.fetch = originalFetch;
  process.env.FAL_KEY = originalKey;
});

const request = { model: MODEL, imageUrl: "https://x.public.blob.vercel-storage.com/a.jpg", prompt: "zoom lento", durationSeconds: 5, aspectRatio: "9:16" as const };

describe("fal.ai", () => {
  it("só aceita o modelo e a duração configurados", () => {
    expect(fal.falImageToVideoProvider.supports({ model: MODEL, durationSeconds: 5, aspectRatio: "9:16" })).toBe(true);
    expect(fal.falImageToVideoProvider.supports({ model: MODEL, durationSeconds: 10, aspectRatio: "9:16" })).toBe(false);
    expect(fal.falImageToVideoProvider.supports({ model: "outro", durationSeconds: 5, aspectRatio: "9:16" })).toBe(false);
  });

  it("envia para a fila com 'Key' e os parâmetros documentados", async () => {
    fetchMock.mockResolvedValueOnce(json(200, { request_id: "abc-123", status_url: "x", response_url: "y" }));
    const result = await fal.falImageToVideoProvider.create(request);
    expect(result.externalTaskId).toBe(`${MODEL}::abc-123`);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`https://queue.fal.run/${MODEL}`);
    expect(init.headers.Authorization).toBe("Key fal-key-de-teste");
    expect(JSON.parse(init.body)).toEqual({
      image_url: request.imageUrl,
      prompt: "zoom lento",
      resolution: "720p",
      aspect_ratio: "9:16",
      enable_safety_checker: true,
      num_frames: 121,
      frames_per_second: 24,
    });
  });

  it("fila → processando → concluído (busca o resultado)", async () => {
    const id = `${MODEL}::abc-123`;
    fetchMock.mockResolvedValueOnce(json(200, { status: "IN_QUEUE" }));
    expect((await fal.falImageToVideoProvider.getStatus(id)).state).toBe("QUEUED");
    fetchMock.mockResolvedValueOnce(json(200, { status: "IN_PROGRESS" }));
    expect((await fal.falImageToVideoProvider.getStatus(id)).state).toBe("PROCESSING");
    fetchMock
      .mockResolvedValueOnce(json(200, { status: "COMPLETED" }))
      .mockResolvedValueOnce(json(200, { video: { url: "https://v3.fal.media/out.mp4" } }));
    const done = await fal.falImageToVideoProvider.getStatus(id);
    expect(done).toMatchObject({ state: "SUCCEEDED", outputUrls: ["https://v3.fal.media/out.mp4"] });
    expect(fetchMock.mock.calls.at(-2)?.[0]).toBe(`https://queue.fal.run/${APP}/requests/abc-123/status`);
    expect(fetchMock.mock.calls.at(-1)?.[0]).toBe(`https://queue.fal.run/${APP}/requests/abc-123`);
  });

  it("aceita formatos alternativos de URL de vídeo do fal.ai", async () => {
    const id = `${MODEL}::abc-123`;
    fetchMock.mockResolvedValueOnce(json(200, { status: "COMPLETED" })).mockResolvedValueOnce(json(200, { output: { video: { url: "https://v3.fal.media/output.mp4" } } }));
    await expect(fal.falImageToVideoProvider.getStatus(id)).resolves.toMatchObject({ state: "SUCCEEDED", outputUrls: ["https://v3.fal.media/output.mp4"] });

    fetchMock.mockResolvedValueOnce(json(200, { output: { videos: [{ url: "https://v3.fal.media/from-status.mp4" }] } }));
    await expect(fal.falImageToVideoProvider.getStatus(id)).resolves.toMatchObject({ state: "SUCCEEDED", outputUrls: ["https://v3.fal.media/from-status.mp4"] });
  });

  it("recupera o vídeo pelo endpoint de resultado quando o status é recusado", async () => {
    const id = `${MODEL}::abc-123`;
    fetchMock
      .mockResolvedValueOnce(json(400, { detail: "status not available" }))
      .mockResolvedValueOnce(json(200, { video: { url: "https://v3.fal.media/recovered.mp4" } }));
    const recovered = await fal.falImageToVideoProvider.getStatus(id);
    expect(recovered).toMatchObject({ state: "SUCCEEDED", outputUrls: ["https://v3.fal.media/recovered.mp4"] });
    expect(fetchMock.mock.calls.at(-2)?.[0]).toBe(`https://queue.fal.run/${APP}/requests/abc-123/status`);
    expect(fetchMock.mock.calls.at(-1)?.[0]).toBe(`https://queue.fal.run/${APP}/requests/abc-123`);
  });

  it("nunca faz POST na fila ao consultar; 405/404 viram 'tentar de novo', não falha", async () => {
    const id = `${MODEL}::abc-123`;
    fetchMock
      .mockResolvedValueOnce(json(405, { detail: "Method Not Allowed" }))
      .mockResolvedValueOnce(json(405, { detail: "Method Not Allowed" }));
    const error = await fal.falImageToVideoProvider.getStatus(id).catch((e) => e);
    expect(error).toBeInstanceOf(ImageToVideoProviderError);
    expect(error.retryable).toBe(true);
    expect(fetchMock.mock.calls.every(([, init]) => init.method === "GET")).toBe(true);
  });

  it("concluído mas resultado ainda indisponível: tenta de novo (não reembolsa como vazio)", async () => {
    const id = `${MODEL}::abc-123`;
    fetchMock.mockResolvedValueOnce(json(200, { status: "COMPLETED" })).mockResolvedValueOnce(json(404, { detail: "Request not found" }));
    const error = await fal.falImageToVideoProvider.getStatus(id).catch((e) => e);
    expect(error).toBeInstanceOf(ImageToVideoProviderError);
    expect(error.code).toBe("RESULT_PENDING");
    expect(error.retryable).toBe(true);
  });

  it("base da fila: dono/app, com namespace quando houver", () => {
    expect(fal.falQueueAppId(MODEL)).toBe("fal-ai/wan");
    expect(fal.falQueueAppId("fal-ai/flux/dev")).toBe("fal-ai/flux");
    expect(fal.falQueueAppId("workflows/dono/app/sub")).toBe("workflows/dono/app");
    expect(fal.falRequestBaseUrl(MODEL, "r1")).toBe("https://queue.fal.run/fal-ai/wan/requests/r1");
  });

  it("cancelamento usa a base dono/app", async () => {
    fetchMock.mockResolvedValueOnce(json(200, {}));
    await fal.falImageToVideoProvider.cancel(`${MODEL}::abc-123`);
    expect(fetchMock.mock.calls[0][0]).toBe(`https://queue.fal.run/${APP}/requests/abc-123/cancel`);
    expect(fetchMock.mock.calls[0][1].method).toBe("PUT");
  });

  it("falhas: moderação, imagem inválida, técnica e 5xx temporário", async () => {
    const id = `${MODEL}::abc-123`;
    fetchMock.mockResolvedValueOnce(json(200, { status: "COMPLETED", error: "NSFW content detected", error_type: "content_policy" }));
    expect(await fal.falImageToVideoProvider.getStatus(id)).toMatchObject({ state: "FAILED", failureKind: "MODERATION" });
    fetchMock.mockResolvedValueOnce(json(200, { status: "COMPLETED" })).mockResolvedValueOnce(json(422, { detail: [{ msg: "Invalid image" }] }));
    expect(await fal.falImageToVideoProvider.getStatus(id)).toMatchObject({ state: "FAILED", failureKind: "USER_ERROR" });
    fetchMock.mockResolvedValueOnce(json(200, { status: "COMPLETED", error: "runner crashed" }));
    expect(await fal.falImageToVideoProvider.getStatus(id)).toMatchObject({ state: "FAILED", failureKind: "TECHNICAL" });
    fetchMock.mockResolvedValueOnce(json(503, {}));
    const error = await fal.falImageToVideoProvider.create(request).catch((e) => e);
    expect(error).toBeInstanceOf(ImageToVideoProviderError);
    expect(error.retryable).toBe(true);
  });

  it("sem FAL_KEY não chama a API e nunca expõe a chave", async () => {
    delete process.env.FAL_KEY;
    const error = await fal.falImageToVideoProvider.create(request).catch((e) => e);
    expect(error.code).toBe("NOT_CONFIGURED");
    expect(fetchMock).not.toHaveBeenCalled();
    process.env.FAL_KEY = "segredo-123";
    fetchMock.mockResolvedValueOnce(json(401, { detail: "bad key" }));
    const unauthorized = await fal.falImageToVideoProvider.create(request).catch((e) => e);
    expect(String(unauthorized.message)).not.toContain("segredo-123");
  });

  it("id de tarefa adulterado é recusado", () => {
    expect(() => fal.decodeFalTaskId("https://evil::x")).toThrow(ImageToVideoProviderError);
    expect(() => fal.decodeFalTaskId(`${MODEL}::../../x`)).toThrow(ImageToVideoProviderError);
  });
});
