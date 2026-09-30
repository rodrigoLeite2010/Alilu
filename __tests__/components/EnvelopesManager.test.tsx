import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { EnvelopesManager } from "@/components/financas/EnvelopesManager";

afterEach(() => vi.restoreAllMocks());

function stubFetch(limits: { category: string; limitCents: number }[], occurrences: unknown[] = []) {
  const fetchMock = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
    if (typeof url === "string" && url.startsWith("/api/financas/limites/") && init?.method === "PUT") {
      return Promise.resolve({ ok: true, json: async () => ({ ok: true }) });
    }
    if (typeof url === "string" && url.startsWith("/api/financas/limites/") && init?.method === "DELETE") {
      return Promise.resolve({ ok: true, json: async () => ({ ok: true }) });
    }
    if (url === "/api/financas/limites") {
      return Promise.resolve({ ok: true, json: async () => ({ limits }) });
    }
    return Promise.resolve({
      ok: true,
      json: async () => ({ month: "2026-09", today: "2026-09-25", occurrences, savingsGoalCents: 0, openingBalanceCents: 0 }),
    });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("EnvelopesManager", () => {
  it("mostra todas as categorias de despesa; sem limite mostra 'Sem limite definido'", async () => {
    stubFetch([]);
    render(<EnvelopesManager />);
    expect(await screen.findByText("Alimentação")).toBeInTheDocument();
    const row = screen.getByText("Alimentação").closest("li")!;
    expect(within(row).getByText("Sem limite definido")).toBeInTheDocument();
    expect(within(row).getByRole("button", { name: "Definir limite" })).toBeInTheDocument();
  });

  it("com limite definido, mostra gasto/limite e a barra de progresso", async () => {
    const occurrences = [
      { entryId: "1", kind: "expense", description: "Mercado", category: "Alimentação", nature: "variable", amountCents: 85000, date: "2026-09-10", recurring: false, paid: true, paidAt: "2026-09-10T00:00:00Z" },
    ];
    stubFetch([{ category: "Alimentação", limitCents: 100000 }], occurrences);
    render(<EnvelopesManager />);

    const row = (await screen.findByText("Alimentação")).closest("li")!;
    expect(within(row).getByText("R$ 850,00 de R$ 1.000,00")).toBeInTheDocument();
    expect(within(row).getByText(/85% usado/)).toBeInTheDocument();
    expect(within(row).getByRole("button", { name: "Editar" })).toBeInTheDocument();
    expect(within(row).getByRole("button", { name: "Remover" })).toBeInTheDocument();
  });

  it("define um novo limite pelo formulário inline", async () => {
    const fetchMock = stubFetch([]);
    render(<EnvelopesManager />);

    const row = (await screen.findByText("Lazer")).closest("li")!;
    fireEvent.click(within(row).getByRole("button", { name: "Definir limite" }));
    fireEvent.change(within(row).getByLabelText("Limite mensal para Lazer"), { target: { value: "300,00" } });
    fireEvent.click(within(row).getByRole("button", { name: "Salvar" }));

    await vi.waitFor(() => {
      const call = fetchMock.mock.calls.find(([url]) => url === "/api/financas/limites/Lazer");
      expect(call).toBeTruthy();
      expect(JSON.parse((call![1] as RequestInit).body as string)).toEqual({ limitCents: 30000 });
    });
  });
});
