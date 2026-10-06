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

  afterEach(() => {
    global.fetch = originalFetch;
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
    expect(screen.getByRole("link", { name: "Ver planos" })).toHaveAttribute("href", "/planos");
  });

  it("trial encerrado: convida a escolher um plano na página de planos", () => {
    render(<AutomationBillingBanner initialAccess={access({ status: "EXPIRED", allowed: false })} />);
    expect(screen.getByText("Período de teste encerrado")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver planos" })).toHaveAttribute("href", "/planos");
  });

  it("assinante ativo mostra o nome do plano e o atalho para gerenciar", () => {
    render(
      <AutomationBillingBanner
        initialAccess={access({ status: "ACTIVE", allowed: true, currentPeriodEndsAt: "2026-10-15T00:00:00.000Z" })}
        planName="Criador"
        planPriceLabel="R$ 24,90"
      />,
    );
    expect(screen.getByText("Plano Criador")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Gerenciar plano" })).toHaveAttribute("href", "/planos");
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

  it("assinatura cancelada dentro do período pago: reativar pede confirmação e depois mostra assinatura ativa", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ subscription: { status: "ACTIVE" } }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => access({ status: "ACTIVE", allowed: true, remainingToday: null, currentPeriodEndsAt: "2026-10-15T00:00:00.000Z" }),
      });
    global.fetch = fetchMock as unknown as typeof fetch;

    render(
      <AutomationBillingBanner
        initialAccess={access({ status: "CANCELED", allowed: true, remainingToday: null, currentPeriodEndsAt: "2026-10-15T00:00:00.000Z" })}
      />,
    );

    expect(screen.getByText("Assinatura cancelada")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Reativar assinatura" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(/Você não paga nada agora/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Reativar assinatura" }));

    await waitFor(() => expect(screen.getByText("Assinatura ativa")).toBeInTheDocument());
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/billing/automation-subscription",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ action: "reactivate" }) }),
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
