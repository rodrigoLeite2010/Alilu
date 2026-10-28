// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FACEBOOK_LOGIN_PERMISSIONS, buildFacebookAuthorizeUrl, listManagedInstagramAccounts } from "@/lib/instagram/backend/facebook-login";

describe("Instagram API with Facebook Login", () => {
  const originalFetch = global.fetch;
  const fetchMock = vi.fn();
  beforeEach(() => { global.fetch = fetchMock as unknown as typeof fetch; fetchMock.mockReset(); });
  afterEach(() => { global.fetch = originalFetch; });

  it("usa a configuração salva do Facebook Login for Business sem enviar scopes clássicos", () => {
    const url = new URL(buildFacebookAuthorizeUrl({ appId: "fb-app", configId: "fb-config", redirectUri: "https://alilu.com.br/api/instagram/facebook-oauth/callback", state: "signed" }));
    expect(url.origin + url.pathname).toBe("https://www.facebook.com/v25.0/dialog/oauth");
    expect(url.searchParams.get("client_id")).toBe("fb-app");
    expect(url.searchParams.get("redirect_uri")).toBe("https://alilu.com.br/api/instagram/facebook-oauth/callback");
    expect(url.searchParams.get("config_id")).toBe("fb-config");
    expect(url.searchParams.has("scope")).toBe(false);
    expect(FACEBOOK_LOGIN_PERMISSIONS).toEqual(["pages_show_list", "pages_read_engagement", "instagram_basic", "instagram_content_publish"]);
    expect(url.searchParams.get("state")).toBe("signed");
  });

  it("lista somente contas profissionais vinculadas a Páginas com permissão de publicação", async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ data: [
      { id: "page-ok", name: "Alilu", access_token: "page-secret", tasks: ["CREATE_CONTENT"], instagram_business_account: { id: "ig-1", username: "alilu.tec" } },
      { id: "page-read-only", name: "Leitura", access_token: "read-token", tasks: ["ANALYZE"], instagram_business_account: { id: "ig-2", username: "read.only" } },
      { id: "page-no-ig", name: "Sem Instagram", access_token: "token", tasks: ["MANAGE"] },
    ], paging: { next: "https://graph.facebook.com/v25.0/me/accounts?after=cursor" } }), { status: 200 }));
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ data: [
      { id: "page-next", name: "Outra", access_token: "page-secret-2", tasks: ["MANAGE"], instagram_business_account: { id: "ig-3", username: "outra" } },
    ] }), { status: 200 }));

    const accounts = await listManagedInstagramAccounts("user-secret");
    expect(accounts.map(({ pageId, igUserId }) => ({ pageId, igUserId }))).toEqual([
      { pageId: "page-ok", igUserId: "ig-1" }, { pageId: "page-next", igUserId: "ig-3" },
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0][0])).toContain("access_token=user-secret");
  });

  it("recusa URL de paginação fora do Graph da Meta", async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ data: [], paging: { next: "https://attacker.example/steal" } }), { status: 200 }));
    await expect(listManagedInstagramAccounts("user-secret")).rejects.toThrow("URL de paginação inválida");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
