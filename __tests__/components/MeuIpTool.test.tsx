import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MeuIpTool } from "@/components/tools/meu-ip/MeuIpTool";

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

describe("MeuIpTool", () => {
  it("mostra o IP detectado após o carregamento", async () => {
    mockFetchOnce({
      ip: "203.0.113.10",
      ipVersion: "IPv4",
      isBot: false,
      userAgentString: "",
      language: "pt-BR",
      browser: { name: null, version: null },
      engine: { name: null, version: null },
      os: { name: null, version: null },
      device: { type: null, vendor: null, model: null },
      cpu: { architecture: null },
    });

    render(<MeuIpTool />);
    expect(screen.getByText(/detectando seu ip/i)).toBeInTheDocument();

    await waitFor(() => expect(screen.getByText("203.0.113.10")).toBeInTheDocument());
    expect(screen.getByText("IPv4")).toBeInTheDocument();
  });

  it("mostra mensagem de erro quando a busca falha", async () => {
    mockFetchOnce(null, false);
    render(<MeuIpTool />);

    await waitFor(() => expect(screen.getByText(/não foi possível detectar seu ip/i)).toBeInTheDocument());
  });

  it("exibe o aviso de privacidade", () => {
    mockFetchOnce({});
    render(<MeuIpTool />);
    expect(screen.getByText(/não é armazenado por esta ferramenta/i)).toBeInTheDocument();
  });
});
