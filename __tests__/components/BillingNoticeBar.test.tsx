import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { BillingNoticeBar } from "@/components/billing/BillingNoticeBar";

let pathname = "/instagram/criar-post";
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));

function mockFetch(routes: Record<string, unknown>) {
  global.fetch = vi.fn().mockImplementation(async (url: string) => {
    const body = routes[url];
    return body === undefined ? { ok: false, json: async () => ({}) } : { ok: true, json: async () => body };
  }) as unknown as typeof fetch;
}

const signedIn = { user: { name: "Ana", email: "a@exemplo.com", image: null } };
const warning = { code: "PLAN_LIMIT_NEAR", level: "warning", message: "Você usou 75 de 90 publicações com IA do ciclo. Restam 15." };
const blocked = { code: "PLAN_LIMIT_REACHED", level: "blocked", message: "Você usou todas as 90 publicações com IA do ciclo." };

describe("BillingNoticeBar", () => {
  const originalFetch = global.fetch;
  beforeEach(() => {
    pathname = "/instagram/criar-post";
    window.sessionStorage.clear();
  });
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("deslogado não aparece e não consulta o plano", async () => {
    mockFetch({ "/api/auth/session": {} });
    const { container } = render(<BillingNoticeBar />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
    expect(container).toBeEmptyDOMElement();
  });

  it("aviso de 80%: mostra com link para planos e pode ser dispensado na sessão", async () => {
    mockFetch({ "/api/auth/session": signedIn, "/api/billing/summary": { summary: { notices: [warning] } } });
    const { unmount } = render(<BillingNoticeBar />);
    expect(await screen.findByText(/Restam 15\./)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver planos" })).toHaveAttribute("href", "/planos");

    fireEvent.click(screen.getByRole("button", { name: "Dispensar" }));
    expect(screen.queryByText(/Restam 15\./)).toBeNull();
    unmount();

    render(<BillingNoticeBar />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(4));
    expect(screen.queryByText(/Restam 15\./)).toBeNull();
  });

  it("limite atingido (bloqueio) não tem botão de dispensar", async () => {
    mockFetch({ "/api/auth/session": signedIn, "/api/billing/summary": { summary: { notices: [blocked, warning] } } });
    render(<BillingNoticeBar />);
    expect(await screen.findByText(/usou todas as 90/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Dispensar" })).toBeNull();
  });

  it("no Piloto Automático (que já mostra seus avisos) não renderiza", async () => {
    pathname = "/instagram/piloto-automatico";
    mockFetch({ "/api/auth/session": signedIn, "/api/billing/summary": { summary: { notices: [blocked] } } });
    const { container } = render(<BillingNoticeBar />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
    expect(container).toBeEmptyDOMElement();
  });
});
