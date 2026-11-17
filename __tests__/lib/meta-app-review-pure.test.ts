// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { CHECKLIST_ORDER, computeChecklist, permissionMatrix, type ChecklistEvidence } from "@/lib/instagram/meta-app-review/checklist";
import { CHECKLIST_LABEL, RECORDING_SCRIPT, REVIEW_TEXT, SUBMISSION_TEXT, parseReviewLang } from "@/lib/instagram/meta-app-review/i18n";
import { sanitizeOAuthReturnPath } from "@/lib/instagram/backend/oauth-state";
import { fetchInstagramProfileDetails, fetchPublishedMedia, InstagramGraphApiError } from "@/lib/instagram/backend/meta-graph-client";

const START = new Date("2026-11-17T12:00:00Z");
const at = (minutes: number) => new Date(START.getTime() + minutes * 60_000);
const base = (): ChecklistEvidence => ({
  sessionStartedAt: START,
  manualChecks: {},
  oauthEvents: [],
  account: null,
  profileCheckedAt: null,
  profileOk: false,
  post: null,
  verifiedAt: null,
  verifiedPermalink: null,
});
const done = (items: ReturnType<typeof computeChecklist>) => items.filter((item) => item.done).map((item) => item.key);

describe("checklist da gravação", () => {
  it("nada é marcado sem evidência; eventos anteriores à sessão não contam", () => {
    expect(done(computeChecklist(base()))).toEqual([]);
    const old = computeChecklist({ ...base(), oauthEvents: [{ message: "OAUTH_START", outcome: "info", at: at(-5) }], manualChecks: { login_shown: at(-1).toISOString() } });
    expect(done(old)).toEqual([]);
  });

  it("itens técnicos seguem os estados reais, na ordem do fluxo", () => {
    const items = computeChecklist({
      ...base(),
      manualChecks: { login_shown: at(1).toISOString() },
      oauthEvents: [
        { message: "OAUTH_START", outcome: "info", at: at(2) },
        { message: "CODE_RECEIVED", outcome: "info", at: at(3) },
        { message: "OAUTH_SUCCESS", outcome: "success", at: at(4) },
      ],
      account: { status: "connected", scopes: ["instagram_business_basic", "instagram_business_content_publish"], authProvider: "instagram_login", updatedAt: at(4) },
      profileCheckedAt: at(5),
      profileOk: true,
      post: { createdAt: at(6), caption: "Meu Reel", hasVideo: true, status: "PUBLISHED", publishedAt: at(8), metaMediaId: "1789" },
      verifiedAt: at(9),
      verifiedPermalink: "https://www.instagram.com/reel/abc/",
    });
    expect(done(items)).toEqual(CHECKLIST_ORDER.filter((key) => key !== "reel_viewed" && key !== "recording_legible"));
    expect(items.find((item) => item.key === "reel_viewed")).toMatchObject({ manual: true, done: false });
  });

  it("permissão parcial, Facebook Login ou publicação não confirmada não contam", () => {
    const items = computeChecklist({
      ...base(),
      oauthEvents: [{ message: "OAUTH_SUCCESS", outcome: "success", at: at(1) }],
      account: { status: "connected", scopes: ["instagram_business_basic"], authProvider: "instagram_login", updatedAt: at(1) },
      post: { createdAt: at(2), caption: " ", hasVideo: true, status: "PROCESSING", publishedAt: null, metaMediaId: null },
    });
    expect(done(items)).toEqual(["account_connected", "video_selected"]);
    const fb = computeChecklist({ ...base(), account: { status: "connected", scopes: ["instagram_basic"], authProvider: "facebook_login", updatedAt: at(1) } });
    expect(done(fb)).toEqual([]);
  });

  it("matriz de permissões nunca afirma aprovação", () => {
    expect(permissionMatrix(["instagram_business_basic"], null)[0]).toEqual({
      scope: "instagram_business_basic",
      requested: true,
      grantedByUser: null,
      appAccessLevel: "manual",
      appReviewApproved: "manual",
    });
    expect(permissionMatrix(["a", "b"], ["a"]).map((row) => row.grantedByUser)).toEqual([true, false]);
  });
});

describe("textos (Português / English)", () => {
  it("os dois idiomas têm as mesmas chaves e os textos exigidos", () => {
    expect(Object.keys(REVIEW_TEXT.en).sort()).toEqual(Object.keys(REVIEW_TEXT.pt).sort());
    expect(Object.keys(CHECKLIST_LABEL.en).sort()).toEqual([...CHECKLIST_ORDER].sort());
    expect(REVIEW_TEXT.en.step1).toBe("Step 1 — Sign in to Alilu");
    expect(REVIEW_TEXT.en.step2).toBe("Step 2 — Connect your Instagram account");
    expect(REVIEW_TEXT.en.connect).toBe("Connect Instagram");
    expect(REVIEW_TEXT.en.step3).toBe("Step 3 — Connected Instagram Account");
    expect(REVIEW_TEXT.en.step3Explain).toBe("This information is retrieved using the instagram_business_basic permission.");
    expect(REVIEW_TEXT.en.step4).toBe("Step 4 — Create Instagram Content");
    expect(REVIEW_TEXT.en.step5).toBe("Step 5 — Publish Instagram Reel");
    expect(REVIEW_TEXT.en.publish).toBe("Publish Reel");
    expect(REVIEW_TEXT.en.publishing).toBe("Publishing in progress...");
    expect(REVIEW_TEXT.en.published).toBe("Reel published successfully.");
    expect(REVIEW_TEXT.en.step6).toBe("Step 6 — View Published Reel");
    expect(REVIEW_TEXT.en.viewOnInstagram).toBe("View on Instagram");
    expect(REVIEW_TEXT.en.step6Explain).toBe("This Reel was published using the instagram_business_content_publish permission.");
    expect(RECORDING_SCRIPT.map((scene) => scene.scene)).toEqual([
      "Scene 1 — Alilu Login",
      "Scene 2 — Instagram Authorization",
      "Scene 3 — Account Information",
      "Scene 4 — Content Creation",
      "Scene 5 — Publishing",
      "Scene 6 — Verification",
    ]);
    expect(SUBMISSION_TEXT.map((item) => item.permission)).toEqual(["instagram_business_basic", "instagram_business_content_publish"]);
    expect(SUBMISSION_TEXT.map((item) => item.description).join(" ")).not.toMatch(/approved|aprovad/i);
    expect(parseReviewLang("en")).toBe("en");
    expect(parseReviewLang("xx")).toBe("pt");
  });
});

describe("retorno do OAuth para o painel", () => {
  it("aceita o painel de revisão e continua recusando destinos externos", () => {
    expect(sanitizeOAuthReturnPath("/admin/meta-app-review?lang=en")).toBe("/admin/meta-app-review?lang=en");
    expect(sanitizeOAuthReturnPath("/admin/assinaturas")).toBeNull();
    expect(sanitizeOAuthReturnPath("//evil.com/admin/meta-app-review")).toBeNull();
    expect(sanitizeOAuthReturnPath("https://evil.com/admin/meta-app-review")).toBeNull();
  });
});

describe("consultas à Graph API (rede simulada)", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("GET /me com os campos de instagram_business_basic: só os devolvidos", async () => {
    const fetchMock = vi.fn<(url: string) => Promise<Response>>(async () =>
      Response.json({ user_id: "1784", username: "gta6br", account_type: "MEDIA_CREATOR", profile_picture_url: "https://scontent.cdninstagram.com/p.jpg" }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const profile = await fetchInstagramProfileDetails("TOKEN");
    expect(profile).toMatchObject({ userId: "1784", username: "gta6br", accountType: "MEDIA_CREATOR", name: null, mediaCount: null });
    expect(profile.returnedFields).toEqual(["user_id", "username", "account_type", "profile_picture_url"]);
    const url = new URL(fetchMock.mock.calls[0][0]);
    expect(url.hostname).toBe("graph.instagram.com");
    expect(url.searchParams.get("fields")).toContain("account_type");
  });

  it("token inválido/expirado vira erro da Meta (nunca dado inventado)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ error: { message: "Error validating access token", code: 190 } }, { status: 400 })));
    await expect(fetchInstagramProfileDetails("TOKEN")).rejects.toBeInstanceOf(InstagramGraphApiError);
  });

  it("GET /{media-id}: confirma id, permalink do instagram.com e data", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ id: "1789", permalink: "https://www.instagram.com/reel/XYZ/", timestamp: "2026-11-17T12:10:00+0000", media_type: "VIDEO", media_product_type: "REELS" })));
    expect(await fetchPublishedMedia("1789", "TOKEN")).toMatchObject({ id: "1789", permalink: "https://www.instagram.com/reel/XYZ/", mediaProductType: "REELS" });
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ id: "1789", permalink: "https://evil.com/x" })));
    expect((await fetchPublishedMedia("1789", "TOKEN")).permalink).toBeNull();
    await expect(fetchPublishedMedia("../me", "TOKEN")).rejects.toThrow(/inválido/);
  });
});
