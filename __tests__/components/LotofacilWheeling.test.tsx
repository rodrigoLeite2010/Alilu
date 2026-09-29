import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { LotofacilWheeling } from "@/components/lotteries/LotofacilWheeling";

/**
 * Testes de interface da ferramenta de desdobramento/fechamento: troca de
 * modo, seleção de números no volante, prévia de quantidade de jogos e
 * garantia, geração e exibição dos jogos. A prova matemática da garantia
 * em si já é verificada exaustivamente em
 * __tests__/lib/lotteries-wheeling.test.ts — aqui só testamos a UI.
 */

function mockClipboard() {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.assign(navigator, { clipboard: { writeText } });
  return writeText;
}

function pickNumbers(grid: HTMLElement, count: number) {
  for (let n = 1; n <= count; n += 1) {
    fireEvent.click(within(grid).getByRole("button", { name: new RegExp(`^${String(n).padStart(2, "0")}\\b`) }));
  }
}

describe("LotofacilWheeling", () => {
  it("começa no modo Desdobramento completo, sem jogos gerados", () => {
    render(<LotofacilWheeling />);
    expect(screen.getByRole("button", { name: /Desdobramento completo/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByText(/jogos gerados/)).not.toBeInTheDocument();
  });

  it("desdobramento completo com 16 números: prévia de 16 jogos e gera exatamente 16", () => {
    render(<LotofacilWheeling />);
    const grid = screen.getByLabelText("Números do grupo de desdobramento");
    pickNumbers(grid, 16);

    expect(screen.getByText(/vai gerar/)).toHaveTextContent("16 jogos");

    fireEvent.click(screen.getByRole("button", { name: "Gerar desdobramento" }));
    expect(screen.getByText("16 jogos gerados")).toBeInTheDocument();
  });

  it("recusa gerar com menos de 16 números marcados (botão desabilitado)", () => {
    render(<LotofacilWheeling />);
    const grid = screen.getByLabelText("Números do grupo de desdobramento");
    pickNumbers(grid, 15);

    expect(screen.getByRole("button", { name: "Gerar desdobramento" })).toBeDisabled();
  });

  it("não deixa marcar mais números do que o teto do modo atual (18 no desdobramento completo)", () => {
    render(<LotofacilWheeling />);
    const grid = screen.getByLabelText("Números do grupo de desdobramento");
    pickNumbers(grid, 20);

    expect(screen.getByText("18 marcados")).toBeInTheDocument();
  });

  it("modo Fechamento reduzido com 18 números: prévia de 6 jogos garantindo 13 pontos, e mostra a garantia após gerar", () => {
    render(<LotofacilWheeling />);
    fireEvent.click(screen.getByRole("button", { name: /Fechamento reduzido/ }));
    const grid = screen.getByLabelText("Números do grupo de desdobramento");
    pickNumbers(grid, 18);

    expect(screen.getByText(/vai gerar/)).toHaveTextContent("6 jogos");
    expect(screen.getByText(/vai gerar/)).toHaveTextContent("13 pontos");

    fireEvent.click(screen.getByRole("button", { name: "Gerar fechamento" }));
    expect(screen.getByText("6 jogos gerados")).toBeInTheDocument();
    expect(screen.getByText("Garantia deste fechamento")).toBeInTheDocument();
    expect(screen.getByText(/no mínimo/)).toHaveTextContent("13 pontos");
  });

  it("no fechamento reduzido, o teto de números marcáveis sobe para 20", () => {
    render(<LotofacilWheeling />);
    fireEvent.click(screen.getByRole("button", { name: /Fechamento reduzido/ }));
    const grid = screen.getByLabelText("Números do grupo de desdobramento");
    pickNumbers(grid, 25);

    expect(screen.getByText("20 marcados")).toBeInTheDocument();
  });

  it("trocar de modo depois de já ter gerado jogos limpa o resultado anterior", () => {
    render(<LotofacilWheeling />);
    const grid = screen.getByLabelText("Números do grupo de desdobramento");
    pickNumbers(grid, 16);
    fireEvent.click(screen.getByRole("button", { name: "Gerar desdobramento" }));
    expect(screen.getByText("16 jogos gerados")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Fechamento reduzido/ }));
    expect(screen.queryByText(/jogos gerados/)).not.toBeInTheDocument();
  });

  it("copiar todos os jogos gerados usa a área de transferência", async () => {
    const writeText = mockClipboard();
    render(<LotofacilWheeling />);
    const grid = screen.getByLabelText("Números do grupo de desdobramento");
    pickNumbers(grid, 16);
    fireEvent.click(screen.getByRole("button", { name: "Gerar desdobramento" }));

    fireEvent.click(screen.getByRole("button", { name: "Copiar todos" }));
    await screen.findByText("Copiado!");
    expect(writeText).toHaveBeenCalledTimes(1);
  });
});
