import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { LotofacilGenerator } from "@/components/lotteries/LotofacilGenerator";

/**
 * Testes de interface do Gerador Estatístico da Lotofácil (MVP): troca de
 * modo, geração de um único jogo com análise, geração múltipla sem
 * repetição, validação do modo Personalizado (conflito incluir/excluir) e
 * copiar/baixar CSV.
 */

function mockClipboard() {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.assign(navigator, { clipboard: { writeText } });
  return writeText;
}

function dezenasValue() {
  const dezenasDt = screen.getByText("Dezenas");
  return dezenasDt.parentElement?.querySelector("dd")?.textContent;
}

beforeEach(() => {
  mockClipboard();
});

describe("LotofacilGenerator", () => {
  it("gera um jogo no modo Aleatório (15 dezenas por padrão) com análise completa", () => {
    render(<LotofacilGenerator />);
    fireEvent.click(screen.getByRole("button", { name: /gerar combinação/i }));

    expect(screen.getByText("Seu jogo")).toBeInTheDocument();
    expect(dezenasValue()).toBe("15");
  });

  it("permite trocar a quantidade de dezenas antes de gerar", () => {
    render(<LotofacilGenerator />);
    fireEvent.click(screen.getByRole("button", { name: "18" }));
    fireEvent.click(screen.getByRole("button", { name: /gerar combinação/i }));

    expect(dezenasValue()).toBe("18");
  });

  it("mostra os controles do modo Personalizado somente quando selecionado", () => {
    render(<LotofacilGenerator />);
    expect(screen.queryByText("Quero incluir")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^personalizado/i }));
    expect(screen.getByText("Quero incluir")).toBeInTheDocument();
    expect(screen.getByText("Não quero incluir")).toBeInTheDocument();
  });

  it("bloqueia a geração no modo Personalizado quando o número de obrigatórios excede a aposta", () => {
    render(<LotofacilGenerator />);
    fireEvent.click(screen.getByRole("button", { name: /^personalizado/i }));

    // Aposta padrão = 15 dezenas; marca 16 números obrigatórios (01 a 16)
    // no primeiro grid ("Quero incluir").
    const includeHeading = screen.getByText("Quero incluir");
    const includeGrid = includeHeading.nextElementSibling as HTMLElement;
    for (let n = 1; n <= 16; n += 1) {
      const label = String(n).padStart(2, "0");
      fireEvent.click(within(includeGrid).getByRole("button", { name: new RegExp(`^${label}`) }));
    }

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /gerar combinação/i })).toBeDisabled();
  });

  it("gera múltiplos jogos sem repetição e mostra os botões de copiar/baixar", () => {
    render(<LotofacilGenerator />);
    fireEvent.click(screen.getByRole("button", { name: "5" }));
    fireEvent.click(screen.getByRole("button", { name: /gerar 5 jogos/i }));

    expect(screen.getByText("5 jogos gerados, sem repetição entre eles")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /copiar todos/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /baixar csv/i })).toBeInTheDocument();

    const items = screen.getAllByText(/^Jogo \d+:/);
    expect(items).toHaveLength(5);
  });

  it("copia todos os jogos gerados para a área de transferência", async () => {
    const writeText = mockClipboard();
    render(<LotofacilGenerator />);
    fireEvent.click(screen.getByRole("button", { name: "5" }));
    fireEvent.click(screen.getByRole("button", { name: /gerar 5 jogos/i }));
    fireEvent.click(screen.getByRole("button", { name: /copiar todos/i }));

    expect(writeText).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole("button", { name: /copiado!/i })).toBeInTheDocument();
  });
});
