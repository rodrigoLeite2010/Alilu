import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { AnnualPlanView } from "@/components/financas/AnnualPlanView";
import type { Occurrence } from "@/lib/financas/types";

afterEach(() => vi.restoreAllMocks());

function occ(partial: Partial<Occurrence> & Pick<Occurrence, "kind" | "amountCents" | "date">): Occurrence {
  return {
    entryId: partial.date,
    description: "x",
    category: partial.kind === "income" ? "Salário" : "Moradia",
    nature: partial.kind === "expense" ? "fixed" : null,
    recurring: false,
    paid: false,
    paidAt: null,
    ...partial,
  };
}

describe("AnnualPlanView", () => {
  it("mostra os totais do ano e o saldo de cada mês, buscando o ano atual por padrão", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        year: "2026",
        today: "2026-09-25",
        occurrences: [
          occ({ kind: "income", amountCents: 500000, date: "2026-01-05" }),
          occ({ kind: "expense", amountCents: 300000, date: "2026-01-10" }),
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<AnnualPlanView />);

    await screen.findByText("Receitas no ano");
    expect(screen.getByText("Receitas no ano").nextElementSibling).toHaveTextContent("R$ 5.000,00");
    expect(screen.getByText("Despesas no ano").nextElementSibling).toHaveTextContent("R$ 3.000,00");
    expect(screen.getByText("Saldo do ano").nextElementSibling).toHaveTextContent("R$ 2.000,00");

    const januaryRow = screen.getByRole("row", { name: /Jan/ });
    expect(within(januaryRow).getByText("R$ 5.000,00")).toBeInTheDocument();
    expect(within(januaryRow).getByText("R$ 3.000,00")).toBeInTheDocument();
    expect(within(januaryRow).getByText("R$ 2.000,00")).toBeInTheDocument();

    const februaryRow = screen.getByRole("row", { name: /Fev/ });
    expect(within(februaryRow).getAllByText("R$ 0,00")).toHaveLength(3);

    expect(fetchMock.mock.calls[0][0]).toBe("/api/financas/year?year=2026");
  });

  it("sem sessão configurada, mostra o erro devolvido pela API", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: "Faça login para ver seus dados." }) }));
    render(<AnnualPlanView />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Faça login para ver seus dados.");
  });

  it("botão de próximo ano busca o ano seguinte", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ year: "2026", today: "2026-09-25", occurrences: [] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<AnnualPlanView />);
    await screen.findByText("2026");
    fireEvent.click(screen.getByRole("button", { name: "Próximo ano" }));

    expect(await screen.findByText("2027")).toBeInTheDocument();
    expect(fetchMock.mock.calls.at(-1)?.[0]).toBe("/api/financas/year?year=2027");
  });
});
