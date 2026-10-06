import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { PlansPanel } from "@/components/billing/PlansPanel";

const plans = [
  { code: "AUTOMATION", name: "Automático", priceCents: 1900, includesAi: false, aiPostsPerCycle: null, aiDailyReference: null, includesImporter: true, features: ["Piloto Automático com o seu texto"], upcoming: [] },
  { code: "CREATOR", name: "Criador", priceCents: 2490, includesAi: true, aiPostsPerCycle: 90, aiDailyReference: 3, includesImporter: true, features: ["90 publicações com IA por ciclo"], upcoming: [] },
  { code: "PRO", name: "Pro", priceCents: 4990, includesAi: true, aiPostsPerCycle: 300, aiDailyReference: 10, includesImporter: true, features: ["300 publicações com IA por ciclo"], upcoming: ["Mais de uma conta do Instagram"] },
];

function summary(overrides: Record<string, unknown> = {}) {
  return {
    access: { allowed: true, status: "NEW", reason: null, trialEndsAt: null, remainingToday: 3, currentPeriodEndsAt: null },
    plan: null,
    pendingPlan: null,
    aiUsage: null,
    notices: [],
    ...overrides,
  };
}

function mockSummary(body: unknown) {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => body });
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

describe("PlansPanel", () => {
  const originalFetch = global.fetch;
  const originalLocation = window.location;
  afterEach(() => {
    global.fetch = originalFetch;
    Object.defineProperty(window, "location", { value: originalLocation, writable: true, configurable: true });
    vi.restoreAllMocks();
  });

  it("deslogado: mostra os três planos com preço e convite para entrar", async () => {
    mockSummary({ authenticated: false, plans, summary: null });
    render(<PlansPanel />);
    expect(await screen.findByText("Criador")).toBeInTheDocument();
    expect(screen.getByText(/R\$\s*19,00/)).toBeInTheDocument();
    expect(screen.getByText(/R\$\s*49,90/)).toBeInTheDocument();
    const links = screen.getAllByRole("link", { name: "Entrar para assinar" });
    expect(links).toHaveLength(3);
    expect(links[0].getAttribute("href")).toContain("/entrar?callbackUrl=");
    expect(screen.getByText(/Mais de uma conta do Instagram/)).toBeInTheDocument();
  });

  it("logado sem plano: assinar abre o checkout e envia o plano escolhido", async () => {
    const fetchMock = mockSummary({ authenticated: true, plans, summary: summary() });
    delete (window as unknown as { location?: unknown }).location;
    Object.defineProperty(window, "location", { value: { href: "" }, writable: true, configurable: true });
    render(<PlansPanel />);

    fireEvent.click(await screen.findByRole("button", { name: "Assinar Criador" }));
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ checkoutUrl: "https://www.asaas.com/i/pay_1" }) });
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByPlaceholderText("Como está no seu documento"), { target: { value: "Fulano da Silva" } });
    fireEvent.change(within(dialog).getByPlaceholderText("Exigido para emitir a cobrança"), { target: { value: "12345678900" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Continuar para o pagamento" }));

    await waitFor(() => expect(window.location.href).toBe("https://www.asaas.com/i/pay_1"));
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/billing/automation-subscription",
      expect.objectContaining({
        body: JSON.stringify({ action: "checkout", planCode: "CREATOR", name: "Fulano da Silva", cpfCnpj: "12345678900" }),
      }),
    );
  });

  it("assinante do Criador: vê o uso da franquia, o aviso, upgrade para Pro e troca no próximo ciclo para Automático", async () => {
    mockSummary({
      authenticated: true,
      plans,
      summary: summary({
        access: { allowed: true, status: "ACTIVE", reason: null, trialEndsAt: null, remainingToday: null, currentPeriodEndsAt: "2026-10-21T00:00:00.000Z" },
        plan: { code: "CREATOR", name: "Criador", priceCents: 2490 },
        aiUsage: { used: 75, limit: 90, remaining: 15, cycleEndsAt: "2026-10-21T00:00:00.000Z", dailyUsed: 1, dailyReference: 3 },
        notices: [{ code: "PLAN_LIMIT_NEAR", level: "warning", message: "Você usou 75 de 90 publicações com IA do ciclo. Restam 15." }],
      }),
    });
    render(<PlansPanel />);

    expect(await screen.findByText("Seu plano")).toBeInTheDocument();
    expect(screen.getByText("75 de 90")).toBeInTheDocument();
    expect(screen.getByText(/Restam 15\./, { selector: "p.rounded-lg" })).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "75");
    expect(screen.getByRole("button", { name: "Fazer upgrade" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mudar no próximo ciclo" })).toBeInTheDocument();
  });

  it("upgrade: pede confirmação, chama change-plan e vai para a cobrança proporcional", async () => {
    const fetchMock = mockSummary({
      authenticated: true,
      plans,
      summary: summary({
        access: { allowed: true, status: "ACTIVE", reason: null, trialEndsAt: null, remainingToday: null, currentPeriodEndsAt: "2026-10-21T00:00:00.000Z" },
        plan: { code: "AUTOMATION", name: "Automático", priceCents: 1900 },
      }),
    });
    delete (window as unknown as { location?: unknown }).location;
    Object.defineProperty(window, "location", { value: { href: "" }, writable: true, configurable: true });
    render(<PlansPanel />);

    const upgradeButtons = await screen.findAllByRole("button", { name: "Fazer upgrade" });
    fireEvent.click(upgradeButtons[0]);
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ kind: "upgrade", checkoutUrl: "https://www.asaas.com/i/up", amountCents: 500 }) });
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(/só a diferença proporcional/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Continuar para o pagamento" }));

    await waitFor(() => expect(window.location.href).toBe("https://www.asaas.com/i/up"));
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/billing/automation-subscription",
      expect.objectContaining({ body: JSON.stringify({ action: "change-plan", planCode: "CREATOR" }) }),
    );
  });

  it("downgrade agendado aparece e pode ser desfeito", async () => {
    const fetchMock = mockSummary({
      authenticated: true,
      plans,
      summary: summary({
        access: { allowed: true, status: "ACTIVE", reason: null, trialEndsAt: null, remainingToday: null, currentPeriodEndsAt: "2026-10-21T00:00:00.000Z" },
        plan: { code: "PRO", name: "Pro", priceCents: 4990 },
        pendingPlan: { code: "CREATOR", name: "Criador" },
      }),
    });
    render(<PlansPanel />);

    expect(await screen.findByText("Agendado para o próximo ciclo")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Desfazer" }));
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ subscription: {} }) });
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Manter plano atual" }));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/billing/automation-subscription",
        expect.objectContaining({ body: JSON.stringify({ action: "cancel-plan-change" }) }),
      ),
    );
  });

  it("login com acesso liberado (isento) não mostra botões de assinar", async () => {
    mockSummary({ authenticated: true, plans, summary: summary({ access: { allowed: true, status: "EXEMPT", reason: null, trialEndsAt: null, remainingToday: null, currentPeriodEndsAt: null } }) });
    render(<PlansPanel />);
    expect(await screen.findAllByText("Seu login já tem acesso liberado.")).toHaveLength(3);
    expect(screen.queryByRole("button", { name: /Assinar/ })).toBeNull();
  });
});
