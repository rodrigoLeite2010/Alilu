import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MegaSenaGenerator } from "@/components/lotteries/MegaSenaGenerator";

/**
 * Testes de interface do Gerador Estatístico da Mega-Sena: troca de modo,
 * geração de um único jogo com análise, geração múltipla sem repetição,
 * validação do modo Personalizado (conflito incluir/excluir), copiar/
 * baixar CSV (MVP da Fase A) e, da Fase B ("Meus Jogos"): modo
 * Diversificar e botão "Salvar" só aparecem logado, reutilizar um jogo
 * via ?reutilizar= na URL — mesmo espírito de
 * LotofacilGenerator.test.tsx.
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

describe("MegaSenaGenerator", () => {
  it("gera um jogo no modo Aleatório (6 dezenas por padrão) com análise completa", () => {
    render(<MegaSenaGenerator />);
    fireEvent.click(screen.getByRole("button", { name: /gerar combinação/i }));

    expect(screen.getByText("Seu jogo")).toBeInTheDocument();
    expect(dezenasValue()).toBe("6");
  });

  it("permite trocar a quantidade de dezenas antes de gerar", () => {
    render(<MegaSenaGenerator />);
    fireEvent.click(screen.getByRole("button", { name: "9" }));
    fireEvent.click(screen.getByRole("button", { name: /gerar combinação/i }));

    expect(dezenasValue()).toBe("9");
  });

  it("mostra os controles do modo Personalizado somente quando selecionado", () => {
    render(<MegaSenaGenerator />);
    expect(screen.queryByText("Quero incluir")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^personalizado/i }));
    expect(screen.getByText("Quero incluir")).toBeInTheDocument();
    expect(screen.getByText("Não quero incluir")).toBeInTheDocument();
  });

  it("bloqueia a geração no modo Personalizado quando o número de obrigatórios excede a aposta", () => {
    render(<MegaSenaGenerator />);
    fireEvent.click(screen.getByRole("button", { name: /^personalizado/i }));

    // Aposta padrão = 6 dezenas; marca 7 números obrigatórios (01 a 07) no
    // primeiro grid ("Quero incluir").
    const includeHeading = screen.getByText("Quero incluir");
    const includeGrid = includeHeading.nextElementSibling as HTMLElement;
    for (let n = 1; n <= 7; n += 1) {
      const label = String(n).padStart(2, "0");
      fireEvent.click(within(includeGrid).getByRole("button", { name: new RegExp(`^${label}`) }));
    }

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /gerar combinação/i })).toBeDisabled();
  });

  it("gera múltiplos jogos sem repetição e mostra os botões de copiar/baixar", () => {
    render(<MegaSenaGenerator />);
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
    render(<MegaSenaGenerator />);
    fireEvent.click(screen.getByRole("button", { name: "5" }));
    fireEvent.click(screen.getByRole("button", { name: /gerar 5 jogos/i }));
    fireEvent.click(screen.getByRole("button", { name: /copiar todos/i }));

    expect(writeText).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole("button", { name: /copiado!/i })).toBeInTheDocument();
  });
});

describe("MegaSenaGenerator — deslogado (Fase B)", () => {
  it("não mostra o modo Diversificar nem o botão Salvar, só o convite para entrar", async () => {
    render(<MegaSenaGenerator />);
    await screen.findByText(/entre/i);

    expect(screen.queryByRole("button", { name: /^diversificar/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /gerar combinação/i }));
    expect(await screen.findByRole("link", { name: /entrar para salvar este jogo/i })).toBeInTheDocument();
  });
});

describe("MegaSenaGenerator — logado (Fase B)", () => {
  it("mostra o modo Diversificar e permite salvar o jogo gerado", async () => {
    mockFetch({ signedIn: true });
    render(<MegaSenaGenerator />);

    expect(await screen.findByRole("button", { name: /^diversificar/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /gerar combinação/i }));
    const saveButton = await screen.findByRole("button", { name: /salvar no meu histórico/i });
    fireEvent.click(saveButton);

    expect(await screen.findByText(/salvo/i)).toBeInTheDocument();
  });

  it("gera com o modo Diversificar sem quebrar (jogo válido de 6 dezenas)", async () => {
    mockFetch({ signedIn: true });
    render(<MegaSenaGenerator />);

    fireEvent.click(await screen.findByRole("button", { name: /^diversificar/i }));
    fireEvent.click(screen.getByRole("button", { name: /gerar combinação/i }));

    expect(await screen.findByText("Seu jogo")).toBeInTheDocument();
    expect(dezenasValue()).toBe("6");
  });

  it("mostra o link para ver os jogos salvos da Mega-Sena depois de gerar", async () => {
    mockFetch({ signedIn: true });
    render(<MegaSenaGenerator />);

    fireEvent.click(screen.getByRole("button", { name: /gerar combinação/i }));

    expect(await screen.findByRole("link", { name: /ver meus jogos salvos/i })).toHaveAttribute(
      "href",
      "/loterias/mega-sena/meus-jogos"
    );
  });
});

describe("MegaSenaGenerator — reutilizar jogo (?reutilizar=, Fase B)", () => {
  it("pré-preenche o modo Personalizado com os números da URL", () => {
    searchParamsValue = new URLSearchParams({
      reutilizar: [1, 2, 3, 4, 5, 6].join(","),
    });
    render(<MegaSenaGenerator />);

    expect(screen.getByRole("button", { name: /^personalizado/i })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Quero incluir")).toBeInTheDocument();
  });
});
