import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { DebtsManager } from "@/components/financas/DebtsManager";
import type { Debt } from "@/lib/financas/debts";

afterEach(() => vi.restoreAllMocks());

describe("DebtsManager", () => {
  it("sem dívidas, mostra o aviso de lista vazia", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ debts: [] }) }));
    render(<DebtsManager />);
    expect(await screen.findByText("Nenhuma dívida cadastrada ainda.")).toBeInTheDocument();
  });

  it("mostra saldo devedor, parcela e a previsão de término", async () => {
    const debts: Debt[] = [{ id: "1", name: "Financiamento do carro", balanceCents: 250000, installmentCents: 100000 }];
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ debts }) }));
    render(<DebtsManager />);

    expect(await screen.findByText("Financiamento do carro")).toBeInTheDocument();
    expect(screen.getByText(/Saldo devedor: R\$ 2\.500,00/)).toBeInTheDocument();
    expect(screen.getByText(/Parcela: R\$ 1\.000,00/)).toBeInTheDocument();
    expect(screen.getByText(/Faltam 3 parcelas · previsão de término/)).toBeInTheDocument();
  });

  it("dívida com saldo zerado mostra 'Quitada!' e não mostra o formulário de pagamento", async () => {
    const debts: Debt[] = [{ id: "1", name: "Cartão", balanceCents: 0, installmentCents: 50000 }];
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ debts }) }));
    render(<DebtsManager />);

    expect(await screen.findByText(/Quitada!/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "− Paguei" })).not.toBeInTheDocument();
  });

  it("registrar um pagamento envia o valor positivo (reduz o saldo devedor)", async () => {
    const debts: Debt[] = [{ id: "1", name: "Cartão", balanceCents: 100000, installmentCents: 50000 }];
    const fetchMock = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (init?.method === "POST") return Promise.resolve({ ok: true, json: async () => ({ ok: true }) });
      return Promise.resolve({ ok: true, json: async () => ({ debts }) });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<DebtsManager />);
    const row = (await screen.findByText("Cartão")).closest("li")!;
    fireEvent.change(within(row).getByLabelText("Valor para Cartão"), { target: { value: "300,00" } });
    fireEvent.click(within(row).getByRole("button", { name: "− Paguei" }));

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(([u]) => u === "/api/financas/dividas/1/pagamento");
      expect(call).toBeTruthy();
      expect(JSON.parse((call![1] as RequestInit).body as string)).toEqual({ deltaCents: 30000 });
    });
  });
});
