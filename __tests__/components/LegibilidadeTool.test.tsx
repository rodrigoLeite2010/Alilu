import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { LegibilidadeTool } from "@/components/tools/legibilidade/LegibilidadeTool";

function typeText(value: string) {
  fireEvent.change(screen.getByLabelText(/cole ou escreva seu texto/i), { target: { value } });
}

describe("LegibilidadeTool", () => {
  it("texto vazio: mensagem amigável, sem resultado", () => {
    render(<LegibilidadeTool />);
    fireEvent.click(screen.getByRole("button", { name: "Analisar" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Digite um texto para analisar.");
    expect(screen.queryByTestId("readability-result")).not.toBeInTheDocument();
  });

  it("contador em tempo real e análise com nota, índices, destaques e sugestão de troca", () => {
    render(<LegibilidadeTool />);
    typeText("Precisamos utilizar o sistema hoje. Depois a gente conversa.");
    expect(screen.getByText(/caracteres · 9 palavras/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Analisar" }));

    expect(screen.getByTestId("readability-score")).toHaveTextContent("/ 100");
    for (const key of ["flesch", "gulpease", "fleschKincaid", "gunningFog", "ari", "colemanLiau"]) {
      expect(screen.getByTestId(`index-${key}`)).toBeInTheDocument();
    }
    const highlight = screen.getByTestId("readability-highlight");
    fireEvent.click(within(highlight).getByRole("button", { name: "utilizar" }));
    expect(screen.getByText(/Possível substituição:/)).toHaveTextContent("usar");
    // O texto original aparece inteiro e intacto.
    expect(highlight.textContent).toBe("Precisamos utilizar o sistema hoje. Depois a gente conversa.");
  });

  it("acima de 20.000 caracteres: avisa claramente e não analisa", () => {
    render(<LegibilidadeTool />);
    typeText("a".repeat(20_001));
    expect(screen.getByText(/Limite de 20\.000 caracteres excedido/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Analisar" })).toBeDisabled();
  });

  it("copiar e limpar", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    render(<LegibilidadeTool />);
    typeText("Olá mundo.");
    fireEvent.click(screen.getByRole("button", { name: "Copiar texto" }));
    expect(await screen.findByText("Texto copiado.")).toBeInTheDocument();
    expect(writeText).toHaveBeenCalledWith("Olá mundo.");
    fireEvent.click(screen.getByRole("button", { name: "Limpar" }));
    expect(screen.getByLabelText(/cole ou escreva seu texto/i)).toHaveValue("");
  });
});

describe("LegibilidadeTool — reescrita com IA", () => {
  const original = global.fetch;
  afterEach(() => {
    global.fetch = original;
  });

  function mockFetch(status: object, rewrite: { ok: boolean; status?: number; body: object }) {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) =>
      init?.method === "POST"
        ? ({ ok: rewrite.ok, status: rewrite.status ?? 200, json: async () => rewrite.body } as Response)
        : ({ ok: true, json: async () => status } as Response),
    );
    global.fetch = fetchMock as unknown as typeof fetch;
    return fetchMock;
  }

  function analyzeHard() {
    typeText("Faz-se necessário que os colaboradores efetuem a verificação minuciosa das funcionalidades disponibilizadas.");
    fireEvent.click(screen.getByRole("button", { name: "Analisar" }));
  }

  it("sem login: convida a entrar e a análise continua", async () => {
    mockFetch({ enabled: true, authenticated: false, quota: null }, { ok: true, body: {} });
    render(<LegibilidadeTool />);
    analyzeHard();
    expect(await screen.findByText(/para simplificar o texto com IA/)).toBeInTheDocument();
    expect(screen.getByTestId("readability-score")).toBeInTheDocument();
  });

  it("IA desligada: painel some e a análise funciona", async () => {
    const fetchMock = mockFetch({ enabled: false, authenticated: true, quota: null }, { ok: true, body: {} });
    render(<LegibilidadeTool />);
    analyzeHard();
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(screen.queryByTestId("rewrite-panel")).not.toBeInTheDocument();
    expect(screen.getByTestId("readability-score")).toBeInTheDocument();
  });

  it("criança de 10 anos: envia público certo, mostra antes/depois e a comparação", async () => {
    const fetchMock = mockFetch(
      { enabled: true, authenticated: true, quota: { used: 0, limit: 30, unlimited: false } },
      {
        ok: true,
        body: {
          text: "A equipe precisa conferir tudo com calma.",
          parts: null,
          before: { score: 10, levelLabel: "Muito difícil", words: 13, complexWords: 6, longSentences: 0 },
          after: { score: 90, levelLabel: "Muito fácil", words: 7, complexWords: 0, longSentences: 0 },
          improved: true,
          missingFacts: [],
          quota: { used: 1, limit: 30, unlimited: false },
        },
      },
    );
    render(<LegibilidadeTool />);
    analyzeHard();
    fireEvent.click(await screen.findByRole("button", { name: "Criança de 10 anos" }));
    expect(await screen.findByTestId("rewrite-text")).toHaveTextContent("A equipe precisa conferir tudo com calma.");
    const postCall = fetchMock.mock.calls.find((call) => call[1]?.method === "POST")!;
    expect(JSON.parse(String(postCall[1]!.body))).toMatchObject({ goal: "simplify", audience: "child10" });
    expect(screen.getByText("Muito fácil")).toBeInTheDocument();
    expect(screen.getByTestId("rewrite-quota")).toHaveTextContent("1 de 30");
    expect(screen.queryByText(/não ficou mais simples/)).not.toBeInTheDocument();
  });

  it("versão pior: avisa e oferece tentar novamente; erro: mensagem amigável", async () => {
    mockFetch(
      { enabled: true, authenticated: true, quota: { used: 0, limit: 30, unlimited: false } },
      {
        ok: true,
        body: {
          text: "Texto mais rebuscado.",
          parts: null,
          before: { score: 60, levelLabel: "Moderado", words: 13, complexWords: 1, longSentences: 0 },
          after: { score: 40, levelLabel: "Difícil", words: 3, complexWords: 1, longSentences: 0 },
          improved: false,
          missingFacts: [],
          quota: { used: 1, limit: 30, unlimited: false },
        },
      },
    );
    render(<LegibilidadeTool />);
    analyzeHard();
    fireEvent.click(await screen.findByRole("button", { name: "Mais persuasivo" }));
    expect(await screen.findByText(/Esta versão não ficou mais simples que o original/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tentar novamente" })).toBeInTheDocument();

    mockFetch({ enabled: true, authenticated: true, quota: null }, { ok: false, status: 502, body: { error: "Não conseguimos simplificar o texto agora. Tente novamente." } });
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(await screen.findByText("Não conseguimos simplificar o texto agora. Tente novamente.")).toBeInTheDocument();
  });
});
