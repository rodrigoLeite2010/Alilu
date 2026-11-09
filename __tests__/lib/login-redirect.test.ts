import { describe, expect, it } from "vitest";
import { DEFAULT_CALLBACK, isInAppBrowser, safeCallbackUrl } from "@/lib/auth/login-redirect";

describe("safeCallbackUrl", () => {
  it("aceita caminhos internos", () => {
    expect(safeCallbackUrl("/amigo-secreto/convite/abc?x=1")).toBe("/amigo-secreto/convite/abc?x=1");
  });
  it.each(["https://evil.com", "//evil.com", "/\\evil.com", "javascript:alert(1)", " /x", "/a\nb", "", null])("recusa %s", (raw) => {
    expect(safeCallbackUrl(raw as string | null)).toBe(DEFAULT_CALLBACK);
  });
});

describe("isInAppBrowser", () => {
  it("detecta Instagram e Facebook", () => {
    expect(isInAppBrowser("Mozilla/5.0 (iPhone) Mobile/15E148 Instagram 300.0.0")).toBe(true);
    expect(isInAppBrowser("Mozilla/5.0 (Linux; Android 13) [FBAN/EMA;FBAV/400.0]")).toBe(true);
  });
  it("não marca Chrome/Safari comuns", () => {
    expect(isInAppBrowser("Mozilla/5.0 (iPhone) Version/17.0 Mobile Safari/604.1")).toBe(false);
  });
});
