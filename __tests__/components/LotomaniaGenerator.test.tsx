import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { LotomaniaGenerator } from "@/components/lotteries/LotomaniaGenerator";

/**
 * Testes de interface do Gerador Estatístico da Lotomania: troca de modo,
 * geração de um único jogo com análise (sempre 50 dezenas), geração
 * múltipla sem repetição, validação do modo Personalizado (conflito
 * incluir/excluir), copiar/baixar CSV, modo Diversificar e botão "Salvar"
 * só aparecem logado, reutilizar um jogo via ?reutilizar= na URL — mesmo
 * espírito de QuinaGenerator.test.tsx, SEM os testes de seletor de
 * "quantidade de dezenas" (esse controle não existe aqui: a aposta da
 * Lotomania é sempre fixa em 50 números, ver LotomaniaGenerator.tsx).
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

const originalFetch = global.fetch;

beforeEach(() => {
  mockClipboard();
  searchParamsValue = new URLSearchParams();
  mockFetch();
});

afterEach(() => {
  global.fetch = originalFetch;
});

describe("LotomaniaGenerator", () => {
  it("gera um jogo no modo Aleatório com análise completa, sempre de 50 dezenas", () => {
    render(<LotomaniaGenerator />);
    fireEvent.click(screen.getByRole("button", { name: /gerar combinação/i }));

    expect(screen.getByText("Seu jogo")).toBeInTheDocument();
    expect(dezenasValue()).toBe("50");
  });

  it("não mostra nenhum seletor de quantidade de dezenas (a aposta é sempre fixa em 50)", () => {
    render(<LotomaniaGenerator />);
    expect(screen.queryByText("Quantidade de dezenas")).not.toBeInTheDocument();
  });

  it("mostra os controles do modo Personalizado somente quando selecionado", () => {
    render(<LotomaniaGenerator />);
    expect(screen.queryByText("Quero incluir")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^personalizado/i }));
    expect(screen.getByText("Quero incluir")).toBeInTheDocument();
    expect(screen.getByText("Não quero incluir")).toBeInTheDocument();
  });

  it("bloqueia a geração no modo Personalizado quando o número de obrigatórios excede a aposta (50)", () => {
    render(<LotomaniaGenerator />);
    fireEvent.click(screen.getByRole("button", { name: /^personalizado/i }));

    // Marca 51 números obrigatórios (00 a 50) no grid "Quero incluir" — um a
    // mais do que os 50 que a aposta permite.
    const includeHeading = screen.getByText("Quero incluir");
    const includeGrid = includeHeading.nextElementSibling as HTMLElement;
    for (let n = 0; n <= 50; n += 1) {
      const label = String(n).padStart(2, "0");
      fireEvent.click(within(includeGrid).getByRole("button", { name: new RegExp(`^${label}`) }));
    }

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /gerar combinação/i })).toBeDisabled();
  });

  it("permite marcar o número 00 no modo Personalizado (off-by-one fácil de errar)", () => {
    render(<LotomaniaGenerator />);
    fireEvent.click(screen.getByRole("button", { name: /^personalizado/i }));

    const includeHeading = screen.getByText("Quero incluir");
    const includeGrid = includeHeading.nextElementSibling as HTMLElement;
    const zeroButton = within(includeGrid).getByRole("button", { name: /^00/ });
    fireEvent.click(zeroButton);

    expect(zeroButton).toHaveAttribute("aria-pressed", "true");
  });

  it("gera múltiplos jogos sem repetição e mostra os botões de copiar/baixar", () => {
    render(<LotomaniaGenerator />);
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

  it("copia todos os jogos gerados para a área de transferência", async () => {
    const writeText = mockClipboard();
    render(<LotomaniaGenerator />);
    const quantityHeading = screen.getByText("Quantidade de jogos");
    const quantityGroup = quantityHeading.nextElementSibling as HTMLElement;
    fireEvent.click(within(quantityGroup).getByRole("button", { name: "5" }));
    fireEvent.click(screen.getByRole("button", { name: /gerar 5 jogos/i }));
    fireEvent.click(screen.getByRole("button", { name: /copiar todos/i }));

    expect(writeText).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole("button", { name: /copiado!/i })).toBeInTheDocument();
  });
});

describe("LotomaniaGenerator — deslogado", () => {
  it("não mostra o modo Diversificar nem o botão Salvar, só o convite para entrar", async () => {
    render(<LotomaniaGenerator />);
    await screen.findByText(/entre/i);

    expect(screen.queryByRole("button", { name: /^diversificar/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /gerar combinação/i }));
    expect(await screen.findByRole("link", { name: /entrar para salvar este jogo/i })).toBeInTheDocument();
  });
});

describe("LotomaniaGenerator — logado", () => {
  it("mostra o modo Diversificar e permite salvar o jogo gerado", async () => {
    mockFetch({ signedIn: true });
    render(<LotomaniaGenerator />);

    expect(await screen.findByRole("button", { name: /^diversificar/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /gerar combinação/i }));
    const saveButton = await screen.findByRole("button", { name: /salvar no meu histórico/i });
    fireEvent.click(saveButton);

    expect(await screen.findByText(/salvo/i)).toBeInTheDocument();
  });

  it("gera com o modo Diversificar sem quebrar (jogo válido de 50 dezenas)", async () => {
    mockFetch({ signedIn: true });
    render(<LotomaniaGenerator />);

    fireEvent.click(await screen.findByRole("button", { name: /^diversificar/i }));
    fireEvent.click(screen.getByRole("button", { name: /gerar combinação/i }));

    expect(await screen.findByText("Seu jogo")).toBeInTheDocument();
    expect(dezenasValue()).toBe("50");
  });

  it("mostra o link para ver os jogos salvos da Lotomania depois de gerar", async () => {
    mockFetch({ signedIn: true });
    render(<LotomaniaGenerator />);

    fireEvent.click(screen.getByRole("button", { name: /gerar combinação/i }));

    expect(await screen.findByRole("link", { name: /ver meus jogos salvos/i })).toHaveAttribute(
      "href",
      "/loterias/lotomania/meus-jogos"
    );
  });
});

describe("LotomaniaGenerator — reutilizar jogo (?reutilizar=)", () => {
  it("pré-preenche o modo Personalizado com os 50 números da URL", () => {
    const reuseGame = Array.from({ length: 50 }, (_, i) => i); // 00..49
    searchParamsValue = new URLSearchParams({
      reutilizar: reuseGame.join(","),
    });
    render(<LotomaniaGenerator />);

    expect(screen.getByRole("button", { name: /^personalizado/i })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Quero incluir")).toBeInTheDocument();
  });

  it("ignora ?reutilizar= com uma quantidade diferente de 50 números", () => {
    searchParamsValue = new URLSearchParams({
      reutilizar: [1, 2, 3].join(","),
    });
    render(<LotomaniaGenerator />);

    expect(screen.getByRole("button", { name: /^aleatório/i })).toHaveAttribute("aria-pressed", "true");
  });
});
