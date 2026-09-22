// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  INSTAGRAM_OAUTH_STATE_COOKIE,
  OAUTH_STATE_MAX_AGE_SECONDS,
  generateOAuthState,
  isValidOAuthState,
} from "@/lib/instagram/backend/oauth-state";

describe("generateOAuthState", () => {
  it("gera uma string hexadecimal não vazia", () => {
    const state = generateOAuthState();
    expect(state.length).toBeGreaterThan(0);
    expect(state).toMatch(/^[0-9a-f]+$/);
  });

  it("gera valores diferentes a cada chamada", () => {
    expect(generateOAuthState()).not.toBe(generateOAuthState());
  });
});

describe("isValidOAuthState", () => {
  it("aceita quando o state do callback bate com o do cookie", () => {
    const state = generateOAuthState();
    expect(isValidOAuthState(state, state)).toBe(true);
  });

  it("rejeita quando os valores são diferentes", () => {
    expect(isValidOAuthState(generateOAuthState(), generateOAuthState())).toBe(false);
  });

  it("rejeita quando falta o state do callback", () => {
    expect(isValidOAuthState(null, generateOAuthState())).toBe(false);
    expect(isValidOAuthState(undefined, generateOAuthState())).toBe(false);
    expect(isValidOAuthState("", generateOAuthState())).toBe(false);
  });

  it("rejeita quando falta o state do cookie", () => {
    const state = generateOAuthState();
    expect(isValidOAuthState(state, null)).toBe(false);
    expect(isValidOAuthState(state, undefined)).toBe(false);
  });

  it("rejeita com segurança quando os tamanhos são diferentes (sem lançar)", () => {
    expect(isValidOAuthState("abc", "abcdef")).toBe(false);
  });
});

describe("constantes", () => {
  it("expõe o nome do cookie e o tempo máximo esperados", () => {
    expect(INSTAGRAM_OAUTH_STATE_COOKIE).toBe("ig_oauth_state");
    expect(OAUTH_STATE_MAX_AGE_SECONDS).toBe(600);
  });
});
