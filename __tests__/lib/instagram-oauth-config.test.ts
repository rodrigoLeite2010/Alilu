// @vitest-environment node
// redirect_uri único por ambiente (precisa bater com o painel da Meta).
import { describe, expect, it } from "vitest";
import { InstagramRedirectConfigError, INSTAGRAM_OAUTH_SCOPES, getInstagramRedirectUri } from "@/lib/instagram/backend/instagram-oauth-config";

const env = (vars: Record<string, string>) => vars as unknown as NodeJS.ProcessEnv;

describe("getInstagramRedirectUri", () => {
  it("produção: sempre o domínio canônico, mesmo se a requisição vier por www/preview", () => {
    expect(getInstagramRedirectUri("https://www.alilu.com.br/api/instagram/oauth/start", env({ VERCEL_ENV: "production", NODE_ENV: "production" }))).toBe(
      "https://alilu.com.br/api/instagram/oauth/callback",
    );
  });

  it("desenvolvimento: usa a origem local", () => {
    expect(getInstagramRedirectUri("http://localhost:3000/api/instagram/oauth/start", env({ NODE_ENV: "development" }))).toBe(
      "http://localhost:3000/api/instagram/oauth/callback",
    );
  });

  it("variável explícita tem prioridade; localhost/http em produção é recusado", () => {
    expect(getInstagramRedirectUri(undefined, env({ INSTAGRAM_OAUTH_REDIRECT_URI: "https://preview.alilu.com.br/api/instagram/oauth/callback" }))).toBe(
      "https://preview.alilu.com.br/api/instagram/oauth/callback",
    );
    expect(() =>
      getInstagramRedirectUri(undefined, env({ VERCEL_ENV: "production", INSTAGRAM_OAUTH_REDIRECT_URI: "http://localhost:3000/api/instagram/oauth/callback" })),
    ).toThrow(InstagramRedirectConfigError);
  });

  it("pede só as permissões usadas pelo Alilu", () => {
    expect([...INSTAGRAM_OAUTH_SCOPES]).toEqual(["instagram_business_basic", "instagram_business_content_publish"]);
  });
});
