import { beforeEach, describe, expect, it, vi } from "vitest";

const ph = {
  init: vi.fn(),
  register: vi.fn(),
  capture: vi.fn(),
  identify: vi.fn(),
  reset: vi.fn(),
  get_distinct_id: vi.fn(() => "anon-1"),
  get_property: vi.fn(() => "anonymous"),
};
vi.mock("posthog-js", () => ({ default: ph }));

const client = await import("@/lib/analytics/posthog-client");

function enable(hostname = "www.alilu.com.br") {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "phc_test");
  Object.defineProperty(window, "location", { value: new URL(`https://${hostname}/x?code=SECRET`), writable: true });
}

beforeEach(() => {
  client.__resetAnalyticsForTests();
  Object.values(ph).forEach((fn) => "mockClear" in fn && fn.mockClear());
  ph.get_distinct_id.mockReturnValue("anon-1");
  ph.get_property.mockReturnValue("anonymous");
  vi.unstubAllEnvs();
});

describe("analytics no navegador", () => {
  it("shouldEnableAnalytics: só produção, com chave, fora de localhost/IP local", () => {
    const base = { key: "k", host: undefined, nodeEnv: "production", hostname: "alilu.com.br" };
    expect(client.shouldEnableAnalytics(base)).toBe(true);
    expect(client.shouldEnableAnalytics({ ...base, hostname: "localhost" })).toBe(false);
    expect(client.shouldEnableAnalytics({ ...base, hostname: "127.0.0.1" })).toBe(false);
    expect(client.shouldEnableAnalytics({ ...base, hostname: "192.168.0.5" })).toBe(false);
    expect(client.shouldEnableAnalytics({ ...base, nodeEnv: "development" })).toBe(false);
    expect(client.shouldEnableAnalytics({ ...base, key: undefined })).toBe(false);
  });

  it("localhost não envia nada (nem inicializa)", async () => {
    enable("localhost");
    await client.trackPageView("/instagram");
    expect(ph.init).not.toHaveBeenCalled();
    expect(ph.capture).not.toHaveBeenCalled();
  });

  it("pageview: inicializa uma única vez e envia só o pathname (sem query)", async () => {
    enable();
    await client.trackPageView("/instagram?code=SECRET#x");
    await client.trackPageView("/instagram/carrossel");
    expect(ph.init).toHaveBeenCalledTimes(1);
    expect(ph.init.mock.calls[0][1]).toMatchObject({ capture_pageview: false, autocapture: false, disable_session_recording: true });
    expect(ph.capture).toHaveBeenNthCalledWith(1, "$pageview", { $current_url: "https://www.alilu.com.br/instagram", $pathname: "/instagram" });
    expect(ph.capture).toHaveBeenNthCalledWith(2, "$pageview", expect.objectContaining({ $pathname: "/instagram/carrossel" }));
    expect(ph.register).toHaveBeenCalledWith(expect.objectContaining({ environment: "production" }));
  });

  it("login: identify com id interno + user_login só na transição; logout: user_logout + reset", async () => {
    enable();
    await client.identifyUser({ id: "user-42", isAdmin: false });
    expect(ph.identify).toHaveBeenCalledWith("user-42", { role: "user", isAdmin: false });
    expect(ph.capture).toHaveBeenCalledWith("user_login");

    ph.identify.mockClear();
    ph.capture.mockClear();
    ph.get_distinct_id.mockReturnValue("user-42"); // recarregou a página já logado
    await client.identifyUser({ id: "user-42" });
    expect(ph.identify).not.toHaveBeenCalled();
    expect(ph.capture).not.toHaveBeenCalledWith("user_login");

    await client.trackLogoutAndReset();
    expect(ph.capture).toHaveBeenCalledWith("user_logout", undefined, { send_instantly: true });
    expect(ph.reset).toHaveBeenCalled();
  });

  it("sessão expirada com navegador identificado: reseta", async () => {
    enable();
    ph.get_property.mockReturnValue("identified");
    await client.resetIfIdentified();
    expect(ph.reset).toHaveBeenCalled();
  });

  it("falha do PostHog nunca estoura (login/logout/pageview seguem)", async () => {
    enable();
    ph.capture.mockImplementation(() => {
      throw new Error("blocked by adblock");
    });
    await expect(client.trackPageView("/a")).resolves.toBeUndefined();
    await expect(client.trackLogoutAndReset()).resolves.toBeUndefined();
    await expect(client.identifyUser({ id: "u" })).resolves.toBeUndefined();
    ph.capture.mockReset();
  });
});
