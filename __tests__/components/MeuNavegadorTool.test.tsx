import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MeuNavegadorTool } from "@/components/tools/meu-navegador/MeuNavegadorTool";

function mockFetchOnce(payload: unknown, ok = true) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok,
      json: () => Promise.resolve(payload),
    })
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("MeuNavegadorTool", () => {
  it("mostra as informações do navegador após o carregamento", async () => {
    mockFetchOnce({
      ip: null,
      ipVersion: null,
      isBot: false,
      userAgentString: "Mozilla/5.0 Teste",
      language: "pt-BR",
      browser: { name: "Chrome", version: "120.0" },
      engine: { name: "Blink", version: "120.0" },
      os: { name: "Windows", version: "10" },
      device: { type: null, vendor: null, model: null },
      cpu: { architecture: null },
    });

    render(<MeuNavegadorTool />);
    expect(screen.getByText(/detectando seu navegador/i)).toBeInTheDocument();

    await waitFor(() => expect(screen.getByText("Chrome")).toBeInTheDocument());
    expect(screen.getByText("120.0")).toBeInTheDocument();
    expect(screen.getByText("Blink")).toBeInTheDocument();
    expect(screen.getByText("pt-BR")).toBeInTheDocument();
  });

  it("mostra mensagem de erro quando a busca falha", async () => {
    mockFetchOnce(null, false);
    render(<MeuNavegadorTool />);

    await waitFor(() =>
      expect(screen.getByText(/não foi possível detectar as informações do navegador/i)).toBeInTheDocument()
    );
  });
});
