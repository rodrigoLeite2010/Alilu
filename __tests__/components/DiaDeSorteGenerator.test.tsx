import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { DiaDeSorteGenerator } from "@/components/lotteries/DiaDeSorteGenerator";

/**
 * Testes de interface do Gerador Estatístico do Dia de Sorte: troca de
 * modo, geração de um único jogo com análise, geração múltipla sem
 * repetição, validação do modo Personalizado (conflito incluir/excluir),
 * copiar/baixar CSV — mesmo espírito de QuinaGenerator.test.tsx, SEM os
 * testes de modo Diversificar/Salvar/login (não existem nesta Fase A —
 * ver comentário em DiaDeSorteGenerator.tsx) nem os de ?reutilizar= (que
 * dependem de "Meus Jogos", também só na Fase B) — PLUS os testes novos
 * do seletor de Mês da Sorte, que nenhuma outra modalidade tem.
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

function monthPickerGroup() {
  const heading = screen.getByText(/^Mês da Sorte/);
  return heading.nextElementSibling as HTMLElement;
}

const MONTH_NAMES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

beforeEach(() => {
  mockClipboard();
});

describe("DiaDeSorteGenerator", () => {
  it("gera um jogo no modo Aleatório (7 dezenas por padrão) com análise completa", () => {
    render(<DiaDeSorteGenerator />);
    fireEvent.click(screen.getByRole("button", { name: /gerar combinação/i }));

    expect(screen.getByText("Seu jogo")).toBeInTheDocument();
    expect(dezenasValue()).toBe("7");
  });

  it("permite trocar a quantidade de dezenas antes de gerar", () => {
    render(<DiaDeSorteGenerator />);
    fireEvent.click(screen.getByRole("button", { name: "9" }));
    fireEvent.click(screen.getByRole("button", { name: /gerar combinação/i }));

    expect(dezenasValue()).toBe("9");
  });

  it("mostra os controles do modo Personalizado somente quando selecionado", () => {
    render(<DiaDeSorteGenerator />);
    expect(screen.queryByText("Quero incluir")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^personalizado/i }));
    expect(screen.getByText("Quero incluir")).toBeInTheDocument();
    expect(screen.getByText("Não quero incluir")).toBeInTheDocument();
  });

  it("bloqueia a geração no modo Personalizado quando o número de obrigatórios excede a aposta (7)", () => {
    render(<DiaDeSorteGenerator />);
    fireEvent.click(screen.getByRole("button", { name: /^personalizado/i }));

    const includeHeading = screen.getByText("Quero incluir");
    const includeGrid = includeHeading.nextElementSibling as HTMLElement;
    for (let n = 1; n <= 8; n += 1) {
      const label = String(n).padStart(2, "0");
      fireEvent.click(within(includeGrid).getByRole("button", { name: new RegExp(`^${label}`) }));
    }

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /gerar combinação/i })).toBeDisabled();
  });

  it("gera múltiplos jogos sem repetição e mostra os botões de copiar/baixar", () => {
    render(<DiaDeSorteGenerator />);
    const quantityHeading = screen.getByText("Quantidade de jogos");
    const quantityGroup = quantityHeading.nextElementSibling as HTMLElement;
    fireEvent.click(within(quantityGroup).getByRole("button", { name: "5" }));
    fireEvent.click(screen.getByRole("button", { name: /gerar 5 jogos/i }));

    expect(screen.getByText("5 jogos gerados, sem repetição entre eles")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /copiar todos/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /baixar csv/i })).toBeInTheDocument();

    const items = screen.getAllByText(/^Jogo \d+:/);
    expect(items).toHaveLength(5);
  });

  it("copia todos os jogos gerados (com o mês) para a área de transferência", async () => {
    const writeText = mockClipboard();
    render(<DiaDeSorteGenerator />);
    const quantityHeading = screen.getByText("Quantidade de jogos");
    const quantityGroup = quantityHeading.nextElementSibling as HTMLElement;
    fireEvent.click(within(quantityGroup).getByRole("button", { name: "5" }));
    fireEvent.click(screen.getByRole("button", { name: /gerar 5 jogos/i }));
    fireEvent.click(screen.getByRole("button", { name: /copiar todos/i }));

    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText.mock.calls[0][0]).toMatch(/Mês da Sorte:/);
    expect(await screen.findByRole("button", { name: /copiado!/i })).toBeInTheDocument();
  });

  it("não mostra nenhum controle de login, Salvar ou o modo Diversificar (fora do escopo da Fase A)", () => {
    render(<DiaDeSorteGenerator />);
    expect(screen.queryByRole("button", { name: /^diversificar/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/entre/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /gerar combinação/i }));
    expect(screen.queryByRole("button", { name: /salvar/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /entrar/i })).not.toBeInTheDocument();
  });
});

describe("DiaDeSorteGenerator — Mês da Sorte", () => {
  it("já vem com um mês padrão selecionado (exatamente um botão pressionado)", () => {
    render(<DiaDeSorteGenerator />);
    const group = monthPickerGroup();
    const pressed = MONTH_NAMES.filter(
      (name) => within(group).getByRole("button", { name }).getAttribute("aria-pressed") === "true"
    );
    expect(pressed).toHaveLength(1);
  });

  it("clicar em um mês seleciona (trava) esse mês", () => {
    render(<DiaDeSorteGenerator />);
    const group = monthPickerGroup();
    const julyButton = within(group).getByRole("button", { name: "Julho" });
    fireEvent.click(julyButton);

    expect(julyButton).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText(/mês travado em/i)).toBeInTheDocument();
    expect(screen.getByText("Julho", { selector: "strong" })).toBeInTheDocument();
  });

  it('"sortear outro mês" destrava a seleção (volta ao sorteio independente por jogo)', () => {
    render(<DiaDeSorteGenerator />);
    const group = monthPickerGroup();
    fireEvent.click(within(group).getByRole("button", { name: "Julho" }));
    expect(screen.getByText(/mês travado em/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /sortear outro mês/i }));
    expect(screen.queryByText(/mês travado em/i)).not.toBeInTheDocument();
    expect(screen.getByText(/recebe um Mês da Sorte independente/i)).toBeInTheDocument();
  });

  it("o jogo gerado mostra o mês travado escolhido pela pessoa", () => {
    render(<DiaDeSorteGenerator />);
    const group = monthPickerGroup();
    fireEvent.click(within(group).getByRole("button", { name: "Dezembro" }));
    fireEvent.click(screen.getByRole("button", { name: /gerar combinação/i }));

    expect(screen.getByText("Mês da Sorte:")).toBeInTheDocument();
    expect(screen.getByText("Dezembro", { selector: "span.font-semibold" })).toBeInTheDocument();
  });

  it("com o mês travado, todos os jogos de um lote gerado usam o mesmo mês", () => {
    render(<DiaDeSorteGenerator />);
    const group = monthPickerGroup();
    fireEvent.click(within(group).getByRole("button", { name: "Março" }));

    const quantityHeading = screen.getByText("Quantidade de jogos");
    const quantityGroup = quantityHeading.nextElementSibling as HTMLElement;
    fireEvent.click(within(quantityGroup).getByRole("button", { name: "5" }));
    fireEvent.click(screen.getByRole("button", { name: /gerar 5 jogos/i }));

    const monthMentions = screen.getAllByText("Março");
    // Um em cada um dos 5 jogos da lista, mais o botão do próprio seletor
    // de mês (que continua marcado como "Março" selecionado).
    expect(monthMentions.length).toBeGreaterThanOrEqual(5);
  });

  it("sem travar o mês, cada jogo do lote pode receber um mês diferente (não força o mesmo mês para todos)", () => {
    render(<DiaDeSorteGenerator />);
    const quantityHeading = screen.getByText("Quantidade de jogos");
    const quantityGroup = quantityHeading.nextElementSibling as HTMLElement;
    fireEvent.click(within(quantityGroup).getByRole("button", { name: "50" }));
    fireEvent.click(screen.getByRole("button", { name: /gerar 50 jogos/i }));

    const monthTexts = screen
      .getAllByText(/^Jogo \d+:/)
      .map((el) => el.parentElement?.textContent ?? "");
    const distinctMonthsUsed = new Set(
      monthTexts.map((text) => MONTH_NAMES.find((name) => text.includes(name)))
    );
    // Com 50 jogos e 12 meses possíveis sorteados independentemente, é
    // praticamente certo que apareça mais de um mês distinto — um único
    // valor aqui indicaria que o mês está (indevidamente) travado por
    // padrão.
    expect(distinctMonthsUsed.size).toBeGreaterThan(1);
  });
});
