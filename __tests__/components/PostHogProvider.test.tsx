import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

let pathname = "/instagram";
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));
const trackPageView = vi.fn();
const identifyUser = vi.fn();
const resetIfIdentified = vi.fn();
vi.mock("@/lib/analytics/posthog-client", () => ({
  trackPageView: (...a: unknown[]) => trackPageView(...a),
  identifyUser: (...a: unknown[]) => identifyUser(...a),
  resetIfIdentified: (...a: unknown[]) => resetIfIdentified(...a),
}));

const { PostHogProvider } = await import("@/components/analytics/PostHogProvider");

function session(body: unknown, ok = true) {
  global.fetch = vi.fn(async () => ({ ok, json: async () => body }) as Response) as unknown as typeof fetch;
}

beforeEach(() => {
  pathname = "/instagram";
  trackPageView.mockReset();
  identifyUser.mockReset();
  resetIfIdentified.mockReset();
});

describe("PostHogProvider", () => {
  it("navegação SPA: cada rota gera um pageview, sem duplicar a mesma rota", async () => {
    session({});
    const view = render(<PostHogProvider />);
    pathname = "/instagram/carrossel";
    view.rerender(<PostHogProvider />);
    view.rerender(<PostHogProvider />); // mesma rota: sem duplicata
    pathname = "/agenda";
    view.rerender(<PostHogProvider />);
    expect(trackPageView.mock.calls.map((c) => c[0])).toEqual(["/instagram", "/instagram/carrossel", "/agenda"]);
  });

  it("logado: identifica pelo id; deslogado: reset; erro de rede: ignora", async () => {
    session({ user: { id: "user-1", isAdmin: true } });
    render(<PostHogProvider />);
    await waitFor(() => expect(identifyUser).toHaveBeenCalledWith({ id: "user-1", isAdmin: true }));

    session({});
    render(<PostHogProvider />);
    await waitFor(() => expect(resetIfIdentified).toHaveBeenCalled());

    global.fetch = vi.fn(async () => {
      throw new Error("offline");
    }) as unknown as typeof fetch;
    expect(() => render(<PostHogProvider />)).not.toThrow();
  });
});
