// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";
import {
  INSTAGRAM_OAUTH_STATE_COOKIE,
  OAUTH_STATE_MAX_AGE_SECONDS,
  generateOAuthState,
  isValidOAuthState,
  verifySignedOAuthState,
} from "@/lib/instagram/backend/oauth-state";

beforeEach(() => {
  process.env.AUTH_SECRET = "segredo-de-teste-para-o-state-oauth";
});

describe("generateOAuthState / verifySignedOAuthState", () => {
  it("gera state aleatório, assinado e preso ao usuário", () => {
    const state = generateOAuthState("user-1");
    expect(state.split(".")).toHaveLength(3);
    expect(generateOAuthState("user-1")).not.toBe(state);
    expect(verifySignedOAuthState(state, "user-1")).toBe("ok");
  });

  it("recusa state de outro usuário (CSRF / ligar conta à pessoa errada)", () => {
    expect(verifySignedOAuthState(generateOAuthState("atacante"), "vitima")).toBe("bad_signature");
  });

  it("expira em 10 minutos", () => {
    const t0 = new Date("2026-10-04T12:00:00Z");
    const state = generateOAuthState("user-1", t0);
    expect(verifySignedOAuthState(state, "user-1", new Date(t0.getTime() + 9 * 60_000))).toBe("ok");
    expect(verifySignedOAuthState(state, "user-1", new Date(t0.getTime() + 11 * 60_000))).toBe("expired");
  });

  it("recusa ausente, malformado e adulterado", () => {
    expect(verifySignedOAuthState(null, "user-1")).toBe("missing");
    expect(verifySignedOAuthState("abc", "user-1")).toBe("malformed");
    const [nonce, issuedAt] = generateOAuthState("user-1").split(".");
    expect(verifySignedOAuthState(`${nonce}.${issuedAt}.assinaturafalsa`, "user-1")).toBe("bad_signature");
  });
});

describe("isValidOAuthState (cookie)", () => {
  it("aceita igual e recusa diferente/ausente sem lançar", () => {
    const state = generateOAuthState("user-1");
    expect(isValidOAuthState(state, state)).toBe(true);
    expect(isValidOAuthState(state, generateOAuthState("user-1"))).toBe(false);
    expect(isValidOAuthState(null, state)).toBe(false);
    expect(isValidOAuthState(state, undefined)).toBe(false);
    expect(isValidOAuthState("abc", "abcdef")).toBe(false);
  });
});

describe("constantes", () => {
  it("expõe o nome do cookie e o tempo máximo esperados", () => {
    expect(INSTAGRAM_OAUTH_STATE_COOKIE).toBe("ig_oauth_state");
    expect(OAUTH_STATE_MAX_AGE_SECONDS).toBe(600);
  });
});
