import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import {
  AutomationBillingBanner,
  type AutomationAccessDto,
} from "@/components/instagram/content-automation/AutomationBillingBanner";

function access(overrides: Partial<AutomationAccessDto> = {}): AutomationAccessDto {
  return {
    allowed: true,
    status: "TRIAL",
    reason: null,
    trialEndsAt: null,
    remainingToday: 3,
    currentPeriodEndsAt: null,
    ...overrides,
  };
}

describe("AutomationBillingBanner", () => {
  const originalFetch = global.fetch;
  const originalLocation = window.location;

  afterEach(() => {
    global.fetch = originalFetch;
    Object.defineProperty(window, "location", { value: originalLocation, writable: true, configurable: true });
    vi.restoreAllMocks();
  });

  it("mostra o período de teste com os usos restantes de hoje", () => {
    render(
      <AutomationBillingBanner
        initialAccess={access({ status: "TRIAL", remainingToday: 2, trialEndsAt: "2026-10-02T12:00:00.000Z" })}
      />,
    );
    expect(screen.getByText("Período de teste")).toBeInTheDocument();
    expect(screen.getByText(/2 de 3 automações restantes hoje/)).toBeInTheDocument();
  });

  it("limite diário atingido mostra convite para assinar, sem bloquear a tela", () => {
    render(
      <AutomationBillingBanner
        initialAccess={access({ status: "TRIAL", allowed: false, remainingToday: 0, reason: "Você atingiu o limite de 3 automações de hoje." })}
      />,
    );
    expect(screen.getByText("Limite de hoje atingido")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Assinar por R$ 19/mês" })).toBeInTheDocument();
  });

  it("trial encerrado: preenche o checkout e redireciona para o link do Asaas", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ checkoutUrl: "https://www.asaas.com/i/pay_1" }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    delete (window as unknown as { location?: unknown }).location;
    Object.defineProperty(window, "location", { value: { href: "" }, writable: true, configurable: true });

    render(<AutomationBillingBanner initialAccess={access({ status: "EXPIRED", allowed: false })} />);

    fireEvent.click(screen.getByRole("button", { name: "Assinar por R$ 19/mês" }));
    fireEvent.change(screen.getByPlaceholderText("Como está no seu documento"), { target: { value: "Fulano da Silva" } });
    fireEvent.change(screen.getByPlaceholderText("Exigido pelo Asaas para emitir a cobrança"), {
      target: { value: "12345678900" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Continuar para o pagamento" }));

    await waitFor(() => expect(window.location.href).toBe("https://www.asaas.com/i/pay_1"));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/billing/automation-subscription",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ action: "checkout", name: "Fulano da Silva", cpfCnpj: "12345678900", email: undefined }),
      }),
    );
  });

  it("assinante ativo: cancelar pede confirmação e depois atualiza o status mostrado", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ subscription: { status: "CANCELED" } }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => access({ status: "CANCELED", allowed: true, currentPeriodEndsAt: "2026-10-15T00:00:00.000Z" }),
      });
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<AutomationBillingBanner initialAccess={access({ status: "ACTIVE", allowed: true })} />);

    expect(screen.getByText("Assinatura ativa")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar assinatura" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancelar assinatura" }));

    await waitFor(() => expect(screen.getByText("Assinatura cancelada")).toBeInTheDocument());
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/billing/automation-subscription",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ action: "cancel" }) }),
    );
  });

  it("pagamento pendente e atrasado mostram avisos informativos, sem pedir ação do usuário", () => {
    const pending = render(<AutomationBillingBanner initialAccess={access({ status: "PENDING_PAYMENT", allowed: false })} />);
    expect(screen.getByText("Pagamento aguardando confirmação")).toBeInTheDocument();
    pending.unmount();

    render(<AutomationBillingBanner initialAccess={access({ status: "PAST_DUE", allowed: false })} />);
    expect(screen.getByText("Pagamento em atraso")).toBeInTheDocument();
  });
});
