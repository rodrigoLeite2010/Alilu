import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { SubscriptionsManager } from "@/components/financas/SubscriptionsManager";
import type { FinEntry } from "@/lib/financas/types";

afterEach(() => vi.restoreAllMocks());

function expense(partial: Partial<FinEntry> & Pick<FinEntry, "id" | "description" | "amountCents">): FinEntry {
  return {
    kind: "expense",
    category: "Assinaturas",
    nature: "fixed",
    date: "2026-01-05",
    recurrence: "monthly",
    recurrenceEnd: null,
    paymentMethod: null,
    note: null,
    paidAt: null,
    ...partial,
  };
}

describe("SubscriptionsManager", () => {
  it("mostra só as assinaturas ativas, com o total por mês e por ano", async () => {
    const entries: FinEntry[] = [
      expense({ id: "1", description: "Netflix", amountCents: 3990 }),
      expense({ id: "2", description: "Academia", amountCents: 12000 }),
      expense({ id: "3", description: "Aluguel", amountCents: 150000, category: "Moradia" }),
      expense({ id: "4", description: "Compra avulsa", amountCents: 5000, recurrence: "none" }),
    ];
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ entries }) }),
    );

    render(<SubscriptionsManager />);

    expect(await screen.findByText("Netflix")).toBeInTheDocument();
    expect(screen.getByText("Academia")).toBeInTheDocument();
    expect(screen.queryByText("Aluguel")).not.toBeInTheDocument();
    expect(screen.queryByText("Compra avulsa")).not.toBeInTheDocument();

    // Total por mês: R$ 39,90 + R$ 120,00 = R$ 159,90
    expect(screen.getByText("R$ 159,90")).toBeInTheDocument();
    // Total por ano: R$ 159,90 × 12 = R$ 1.918,80
    expect(screen.getByText("R$ 1.918,80")).toBeInTheDocument();
  });

  it("sem assinaturas, mostra o aviso e nenhum total", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ entries: [] }) }));
    render(<SubscriptionsManager />);
    expect(await screen.findByText(/Nenhuma assinatura cadastrada ainda/)).toBeInTheDocument();
  });

  it("exclui uma assinatura após confirmação", async () => {
    const entries: FinEntry[] = [expense({ id: "1", description: "Netflix", amountCents: 3990 })];
    const fetchMock = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (init?.method === "DELETE") return Promise.resolve({ ok: true, json: async () => ({ ok: true }) });
      return Promise.resolve({ ok: true, json: async () => ({ entries }) });
    });
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("confirm", vi.fn().mockReturnValue(true));

    render(<SubscriptionsManager />);
    await screen.findByText("Netflix");
    screen.getByRole("button", { name: "Excluir" }).click();

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/financas/entries/1", expect.objectContaining({ method: "DELETE" })));
  });
});
