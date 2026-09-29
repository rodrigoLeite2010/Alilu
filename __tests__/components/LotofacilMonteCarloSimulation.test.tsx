import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { LotofacilMonteCarloSimulation } from "@/components/lotteries/LotofacilMonteCarloSimulation";

describe("LotofacilMonteCarloSimulation", () => {
  it("roda a simulação padrão (15 números, 10.000 sorteios) e mostra a tabela de resultado", async () => {
    render(<LotofacilMonteCarloSimulation />);

    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Rodar simulação" }));

    const table = await screen.findByRole("table");
    expect(table).toHaveTextContent("10.000 sorteios");
    // Aposta de 15 números: a linha de 15 acertos sempre existe na tabela.
    const rows = table.querySelectorAll("tbody tr");
    expect(rows.length).toBeGreaterThan(0);
  });

  it("deixa escolher outro tamanho de aposta e outra quantidade de sorteios antes de rodar", async () => {
    render(<LotofacilMonteCarloSimulation />);

    fireEvent.click(screen.getByRole("button", { name: "18" }));
    fireEvent.click(screen.getByRole("button", { name: "10.000" }));
    fireEvent.click(screen.getByRole("button", { name: "Rodar simulação" }));

    const table = await screen.findByRole("table");
    expect(table).toHaveTextContent("10.000 sorteios");
  });
});
