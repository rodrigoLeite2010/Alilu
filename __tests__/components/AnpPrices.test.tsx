import { render, screen, fireEvent } from "@testing-library/react";
import { it, expect, vi, afterEach } from "vitest";
import { AnpPrices } from "@/components/viagens/AnpPrices";
afterEach(() => vi.unstubAllGlobals());
it("aplica somente a referência explicitamente escolhida e identifica pesquisa e escopo", async () => {
  const apply = vi.fn(); vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ from: "2026-10-11", to: "2026-10-17", source: "https://www.gov.br/anp/research.xlsx", entries: [{ state: "SAO PAULO", city: "", fuel: "gasolina", price: 6.3, stations: 1000 }, { state: "SAO PAULO", city: "CAMPINAS", fuel: "gasolina", price: 6.2, stations: 40 }] }) }));
  render(<AnpPrices fuel="gasolina" onApply={apply} />); fireEvent.click(screen.getByRole("button", { name: "Consultar médias oficiais" }));
  fireEvent.change(await screen.findByLabelText("Estado da pesquisa"), { target: { value: "SAO PAULO" } });
  expect(apply).not.toHaveBeenCalled(); expect(screen.getByText(/11\/10\/2026/)).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Município ou média estadual"), { target: { value: "CAMPINAS" } });
  fireEvent.click(screen.getByRole("button", { name: "Usar este preço como estimativa" })); expect(apply).toHaveBeenCalledWith(6.2);
});
it("mantém modo manual quando o snapshot está indisponível", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
  render(<AnpPrices fuel="gasolina" onApply={vi.fn()} />); fireEvent.click(screen.getByRole("button", { name: "Consultar médias oficiais" }));
  expect(await screen.findByText(/Continue com o preço manual/)).toBeInTheDocument();
});
