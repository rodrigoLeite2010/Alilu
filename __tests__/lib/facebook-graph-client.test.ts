// @vitest-environment node
// Cliente HTTP da Pages API: formato das requisições (sem rede real) e
// parsing defensivo. Garante que o token nunca aparece em `details`.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/instagram/backend/meta-graph-client", () => ({ GRAPH_API_VERSION: "v25.0" }));
const client = await import("@/lib/facebook/backend/facebook-graph-client");

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

describe("facebook-graph-client", () => {
  it("foto: POST /{page}/photos com url, legenda e token no corpo (nunca na URL)", async () => {
    fetchMock.mockResolvedValue(json({ id: "photo-1", post_id: "page_1" }));
    const result = await client.publishPagePhoto({ pageId: "123", pageToken: "TOKEN", imageUrl: "https://blob/x.jpg", message: "Oi" });
    expect(result).toEqual({ photoId: "photo-1", postId: "page_1" });
    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(String(url)).toBe("https://graph.facebook.com/v25.0/123/photos");
    const body = new URLSearchParams(String(init.body));
    expect(body.get("url")).toBe("https://blob/x.jpg");
    expect(body.get("message")).toBe("Oi");
    expect(body.get("published")).toBe("true");
    expect(String(url)).not.toContain("TOKEN");
  });

  it("várias fotos: attached_media na ordem", async () => {
    fetchMock.mockResolvedValue(json({ id: "page_multi" }));
    await client.createPageMultiPhotoPost({ pageId: "123", pageToken: "T", message: "M", photoIds: ["a", "b", "c"] });
    const body = new URLSearchParams(String((fetchMock.mock.calls[0] as [URL, RequestInit])[1].body));
    expect(body.get("attached_media[0]")).toBe(JSON.stringify({ media_fbid: "a" }));
    expect(body.get("attached_media[2]")).toBe(JSON.stringify({ media_fbid: "c" }));
  });

  it("Reel: upload por URL hospedada em rupload.facebook.com com header file_url", async () => {
    fetchMock.mockResolvedValue(json({ success: true }));
    await client.uploadPageReelFromUrl({ videoId: "v1", pageToken: "T", fileUrl: "https://blob/v.mp4" });
    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(String(url)).toBe("https://rupload.facebook.com/video-upload/v25.0/v1");
    expect((init.headers as Record<string, string>).file_url).toBe("https://blob/v.mp4");
    expect((init.headers as Record<string, string>).Authorization).toBe("OAuth T");
  });

  it("Reel finish: video_state=PUBLISHED e descrição", async () => {
    fetchMock.mockResolvedValue(json({ success: true }));
    await client.finishPageReel({ pageId: "123", pageToken: "T", videoId: "v1", description: "Desc" });
    const body = new URLSearchParams(String((fetchMock.mock.calls[0] as [URL, RequestInit])[1].body));
    expect(body.get("upload_phase")).toBe("finish");
    expect(body.get("video_state")).toBe("PUBLISHED");
    expect(body.get("description")).toBe("Desc");
  });

  it("rede caiu num POST não idempotente → unknownOutcome", async () => {
    fetchMock.mockRejectedValue(new Error("socket"));
    await expect(client.publishPagePhoto({ pageId: "1", pageToken: "T", imageUrl: "u", message: "" })).rejects.toMatchObject({
      name: "FacebookGraphApiError",
      unknownOutcome: true,
    });
  });

  it("erro da Meta: não é resultado desconhecido e não carrega token", async () => {
    fetchMock.mockResolvedValue(json({ error: { code: 190, message: "bad access_token=EAAXYZ" } }, 400));
    const error = await client.publishPagePhoto({ pageId: "1", pageToken: "T", imageUrl: "u", message: "" }).catch((e) => e);
    expect(error.unknownOutcome).toBe(false);
    expect(JSON.stringify(error.details)).not.toContain("EAAXYZ");
  });

  it("parseReelStatus lê as fases", () => {
    const status = client.parseReelStatus({
      status: { video_status: "ready", uploading_phase: { status: "complete" }, processing_phase: { status: "complete" }, publishing_phase: { status: "complete", publish_status: "published" } },
    });
    expect(status).toMatchObject({ videoStatus: "ready", publishingStatus: "complete", publishStatus: "published" });
    expect(client.parseReelStatus(null).videoStatus).toBeNull();
  });

  it("lista Páginas com tarefas e só considera publicáveis as com CREATE_CONTENT/MANAGE", async () => {
    fetchMock.mockResolvedValue(json({
      data: [
        { id: "1", name: "Alilu", access_token: "PT1", tasks: ["CREATE_CONTENT"], instagram_business_account: { id: "ig1", username: "alilu.tec" } },
        { id: "2", name: "Só análise", access_token: "PT2", tasks: ["ANALYZE"] },
      ],
    }));
    const pages = await client.listManagedFacebookPages("UT");
    expect(pages.map((page) => [page.pageName, page.canPublish, page.linkedIgUsername])).toEqual([
      ["Alilu", true, "alilu.tec"],
      ["Só análise", false, null],
    ]);
  });

  it("recusa paginação para outro host", async () => {
    fetchMock.mockResolvedValue(json({ data: [], paging: { next: "https://evil.example.com/v25.0/me/accounts" } }));
    await expect(client.listManagedFacebookPages("UT")).rejects.toThrow(/paginação/);
  });
});
