import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { DiaDeSorteGenerator } from "@/components/lotteries/DiaDeSorteGenerator";

/**
 * Testes de interface do Gerador Estatístico do Dia de Sorte: troca de
 * modo, geração de um único jogo com análise, geração múltipla sem
 * repetição, validação do modo Personalizado (conflito incluir/excluir),
 * copiar/baixar CSV, modo Diversificar e botão "Salvar" só aparecem
 * logado, reutilizar um jogo via ?reutilizar= na URL (Fase B — mesmo
 * espírito de QuinaGenerator.test.tsx/LotomaniaGenerator.test.tsx) — PLUS
 * os testes do seletor de Mês da Sorte, que nenhuma outra modalidade tem
 * (mantidos da Fase A).
 */

let searchParamsValue = new URLSearchParams();
vi.mock("next/navigation", () => ({
  useSearchParams: () => searchParamsValue,
}));

function mockClipboard() {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.assign(navigator, { clipboard: { writeText } });
  return writeText;
}

/** signedIn=false → GET /api/auth/session devolve {} (useHeaderAuth trata como deslogado). */
function mockFetch({ signedIn = false, bets = [] as unknown[] } = {}) {
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    if (url.includes("/api/auth/session")) {
      return Promise.resolve({
        ok: true,
        json: async () => (signedIn ? { user: { name: "Ana", email: "ana@exemplo.com", image: null } } : {}),
      });
    }
    if (url.includes("/api/loterias/apostas") && (!init || init.method === undefined)) {
      return Promise.resolve({ ok: true, json: async () => ({ bets }) });
    }
    if (url.includes("/api/loterias/apostas") && init?.method === "POST") {
      return Promise.resolve({
        ok: true,
        json: async () => ({ bet: { id: "bet-1", games: [] }, skippedDuplicates: 0 }),
      });
    }
    return Promise.resolve({ ok: true, json: async () => ({}) });
  });
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
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

const originalFetch = global.fetch;

beforeEach(() => {
  mockClipboard();
  searchParamsValue = new URLSearchParams();
  mockFetch();
});

afterEach(() => {
  global.fetch = originalFetch;
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

describe("DiaDeSorteGenerator — deslogado", () => {
  it("não mostra o modo Diversificar nem o botão Salvar, só o convite para entrar", async () => {
    render(<DiaDeSorteGenerator />);
    await screen.findByText(/entre/i);

    expect(screen.queryByRole("button", { name: /^diversificar/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /gerar combinação/i }));
    expect(await screen.findByRole("link", { name: /entrar para salvar este jogo/i })).toBeInTheDocument();
  });
});

describe("DiaDeSorteGenerator — logado", () => {
  it("mostra o modo Diversificar e permite salvar o jogo gerado (com o mês incluído)", async () => {
    mockFetch({ signedIn: true });
    render(<DiaDeSorteGenerator />);

    expect(await screen.findByRole("button", { name: /^diversificar/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /gerar combinação/i }));
    const saveButton = await screen.findByRole("button", { name: /salvar no meu histórico/i });
    fireEvent.click(saveButton);

    expect(await screen.findByText(/salvo/i)).toBeInTheDocument();
  });

  it("gera com o modo Diversificar sem quebrar (jogo válido de 7 dezenas)", async () => {
    mockFetch({ signedIn: true });
    render(<DiaDeSorteGenerator />);

    fireEvent.click(await screen.findByRole("button", { name: /^diversificar/i }));
    fireEvent.click(screen.getByRole("button", { name: /gerar combinação/i }));

    expect(await screen.findByText("Seu jogo")).toBeInTheDocument();
    expect(dezenasValue()).toBe("7");
  });

  it("mostra o link para ver os jogos salvos do Dia de Sorte depois de gerar", async () => {
    mockFetch({ signedIn: true });
    render(<DiaDeSorteGenerator />);

    fireEvent.click(screen.getByRole("button", { name: /gerar combinação/i }));

    expect(await screen.findByRole("link", { name: /ver meus jogos salvos/i })).toHaveAttribute(
      "href",
      "/loterias/dia-de-sorte/meus-jogos"
    );
  });
});

describe("DiaDeSorteGenerator — reutilizar jogo (?reutilizar=)", () => {
  it("pré-preenche o modo Personalizado com os números da URL", () => {
    searchParamsValue = new URLSearchParams({
      reutilizar: [1, 2, 3, 4, 5, 6, 7].join(","),
    });
    render(<DiaDeSorteGenerator />);

    expect(screen.getByRole("button", { name: /^personalizado/i })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Quero incluir")).toBeInTheDocument();
  });

  it("ignora ?reutilizar= com uma quantidade de números fora da faixa 7-15", () => {
    searchParamsValue = new URLSearchParams({
      reutilizar: [1, 2, 3].join(","),
    });
    render(<DiaDeSorteGenerator />);

    expect(screen.getByRole("button", { name: /^aleatório/i })).toHaveAttribute("aria-pressed", "true");
  });

  it("?reutilizar= não afeta o Mês da Sorte, que continua vindo pré-selecionado normalmente", () => {
    searchParamsValue = new URLSearchParams({
      reutilizar: [1, 2, 3, 4, 5, 6, 7].join(","),
    });
    render(<DiaDeSorteGenerator />);

    const group = monthPickerGroup();
    const pressed = MONTH_NAMES.filter(
      (name) => within(group).getByRole("button", { name }).getAttribute("aria-pressed") === "true"
    );
    expect(pressed).toHaveLength(1);
  });
});
