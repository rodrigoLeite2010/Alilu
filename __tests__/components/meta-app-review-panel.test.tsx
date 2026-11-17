import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

vi.mock("@vercel/blob/client", () => ({ uploadPresigned: vi.fn() }));
import { MetaAppReviewPanel } from "@/components/admin/MetaAppReviewPanel";

const overview = {
  session: { startedAt: "2026-11-17T12:00:00.000Z" },
  config: {
    oauthFlow: "Instagram API with Instagram Login (Business Login for Instagram)",
    appId: "123",
    appConfigured: true,
    redirectUri: "https://alilu.com.br/api/instagram/oauth/callback",
    requestedScopes: ["instagram_business_basic", "instagram_business_content_publish"],
  },
  accounts: [{ id: "11111111-1111-4111-8111-111111111111", igUserId: "1784", username: "gta6br", status: "connected", authProvider: "instagram_login", grantedScopes: ["instagram_business_basic"], tokenExpiresAt: null, updatedAt: null }],
  selectedAccountId: "11111111-1111-4111-8111-111111111111",
  permissions: [
    { scope: "instagram_business_basic", requested: true, grantedByUser: true, appAccessLevel: "manual", appReviewApproved: "manual" },
    { scope: "instagram_business_content_publish", requested: true, grantedByUser: false, appAccessLevel: "manual", appReviewApproved: "manual" },
  ],
  profile: null,
  profileCheckedAt: null,
  profileError: null,
  videos: [],
  post: null,
  verified: null,
  verifiedAt: null,
  lastMetaError: null,
  checklist: [
    { key: "oauth_started", manual: false, done: false, evidence: null },
    { key: "reel_viewed", manual: true, done: false, evidence: null },
  ],
  checklistOrder: [],
};

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(overview))));
});

describe("Meta App Review — painel", () => {
  it("troca para inglês, usa o OAuth real e não permite publicar sem publicação preparada", async () => {
    render(<MetaAppReviewPanel userId="u1" initialLang="pt" />);
    expect(await screen.findByText("Passo 1 — Entrar no Alilu")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "English" }));
    expect(screen.getByText("Step 1 — Sign in to Alilu")).toBeInTheDocument();
    expect(screen.getByText("Step 3 — Connected Instagram Account")).toBeInTheDocument();
    const connect = screen.getByRole("link", { name: "Connect Instagram" });
    expect(connect.getAttribute("href")).toMatch(/^\/api\/instagram\/oauth\/start\?returnTo=%2Fadmin%2Fmeta-app-review%3Flang%3Den&forceReauth=1$/);
    expect(screen.getByRole("button", { name: "Publish Reel" })).toBeDisabled();
    expect(screen.queryByText("Reel published successfully.")).not.toBeInTheDocument();
    expect(screen.getAllByText("check in Meta for Developers").length).toBe(4);
    expect(screen.getAllByRole("button", { name: "Copy Description" })).toHaveLength(2);
    expect(screen.getByText("Scene 6 — Verification")).toBeInTheDocument();
  });
});
