import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MeuSistemaOperacionalTool } from "@/components/tools/meu-sistema-operacional/MeuSistemaOperacionalTool";

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

describe("MeuSistemaOperacionalTool", () => {
  it("mostra as informações do sistema operacional após o carregamento", async () => {
    mockFetchOnce({
      ip: null,
      ipVersion: null,
      isBot: false,
      userAgentString: "",
      language: null,
      browser: { name: null, version: null },
      engine: { name: null, version: null },
      os: { name: "Windows", version: "10" },
      device: { type: "mobile", vendor: "Samsung", model: "SM-G950" },
      cpu: { architecture: "arm64" },
    });

    render(<MeuSistemaOperacionalTool />);
    expect(screen.getByText(/detectando seu sistema/i)).toBeInTheDocument();

    await waitFor(() => expect(screen.getByText("Windows")).toBeInTheDocument());
    expect(screen.getByText("10")).toBeInTheDocument();
    expect(screen.getByText("mobile")).toBeInTheDocument();
    expect(screen.getByText("arm64")).toBeInTheDocument();
  });

  it("mostra 'Computador (desktop)' quando o tipo de dispositivo não é informado", async () => {
    mockFetchOnce({
      ip: null,
      ipVersion: null,
      isBot: false,
      userAgentString: "",
      language: null,
      browser: { name: null, version: null },
      engine: { name: null, version: null },
      os: { name: "macOS", version: null },
      device: { type: null, vendor: null, model: null },
      cpu: { architecture: null },
    });

    render(<MeuSistemaOperacionalTool />);
    await waitFor(() => expect(screen.getByText("Computador (desktop)")).toBeInTheDocument());
  });

  it("mostra mensagem de erro quando a busca falha", async () => {
    mockFetchOnce(null, false);
    render(<MeuSistemaOperacionalTool />);

    await waitFor(() =>
      expect(screen.getByText(/não foi possível detectar seu sistema operacional/i)).toBeInTheDocument()
    );
  });
});
