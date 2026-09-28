import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { EntryDialog } from "@/components/financas/EntryDialog";

afterEach(() => vi.restoreAllMocks());

describe("EntryDialog (adicionar gasto rápido)", () => {
  it("envia só valor, categoria e descrição como gasto já pago, de hoje", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: "x" }) });
    vi.stubGlobal("fetch", fetchMock);
    const onClose = vi.fn();

    render(<EntryDialog open mode="quick-expense" onClose={onClose} />);
    fireEvent.change(screen.getByLabelText("Valor (R$)"), { target: { value: "45,90" } });
    fireEvent.change(screen.getByLabelText("Categoria"), { target: { value: "Alimentação" } });
    fireEvent.change(screen.getByLabelText(/Descrição/), { target: { value: "Padaria" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/financas/entries");
    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({
      kind: "expense",
      amountCents: 4590,
      category: "Alimentação",
      description: "Padaria",
      recurrence: "none",
      paid: true,
    });
    expect(body.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("não envia quando o valor é inválido", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<EntryDialog open mode="quick-expense" onClose={() => undefined} />);
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Informe um valor maior que zero.");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
