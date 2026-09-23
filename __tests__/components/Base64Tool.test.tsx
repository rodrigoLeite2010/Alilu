import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Base64Tool } from "@/components/tools/base64/Base64Tool";
import { Base64CategoryTools } from "@/components/tools/base64/Base64CategoryTools";
import { base64ToolConfigs } from "@/components/tools/base64/base64-tools";
import { base64ToolComponents } from "@/components/tools/base64/base64-registry";
import { base64ToolContent } from "@/components/tools/base64/base64-content";
import { getToolsByCategory } from "@/data/tools";

function renderTool(id: string) {
  return render(<Base64Tool config={base64ToolConfigs[id]} />);
}

function typeInput(label: RegExp, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

function convert() {
  fireEvent.click(screen.getByRole("button", { name: "Converter" }));
}

beforeEach(() => {
  let counter = 0;
  vi.stubGlobal("URL", Object.assign(URL, {
    createObjectURL: vi.fn(() => `blob:mock-${(counter += 1)}`),
    revokeObjectURL: vi.fn(),
  }));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("catálogo do Conversor Base64", () => {
  const catalogIds = getToolsByCategory("conversor-base64").map((tool) => tool.id).sort();

  it("tem as 19 ferramentas, todas ativas, com componente, configuração e conteúdo", () => {
    expect(catalogIds).toHaveLength(19);
    expect(Object.keys(base64ToolConfigs).sort()).toEqual(catalogIds);
    expect(Object.keys(base64ToolComponents).sort()).toEqual(catalogIds);
    expect(Object.keys(base64ToolContent).sort()).toEqual(catalogIds);
    expect(getToolsByCategory("conversor-base64").every((tool) => tool.status === "ativo")).toBe(true);
  });

  it("separa 9 decoders e 10 encoders", () => {
    const configs = Object.values(base64ToolConfigs);
    expect(configs.filter((config) => config.group === "decode")).toHaveLength(9);
    expect(configs.filter((config) => config.group === "encode")).toHaveLength(10);
  });

  it("liga cada ferramenta à sua inversa nas relacionadas", () => {
    const tools = getToolsByCategory("conversor-base64");
    const related = (id: string) => tools.find((tool) => tool.id === id)?.relatedTools[0];
    expect(related("base64-para-imagem")).toBe("imagem-para-base64");
    expect(related("imagem-para-base64")).toBe("base64-para-imagem");
    expect(related("base64-para-pdf")).toBe("pdf-para-base64");
    expect(related("pdf-para-base64")).toBe("base64-para-pdf");
    expect(related("base64-para-texto")).toBe("texto-para-base64");
    expect(related("texto-para-base64")).toBe("base64-para-texto");
    expect(related("base64-para-hex")).toBe("hex-para-base64");
    expect(related("hex-para-base64")).toBe("base64-para-hex");
  });
});

describe("Base64CategoryTools", () => {
  it("divide as seções e filtra pela busca", () => {
    render(<Base64CategoryTools tools={getToolsByCategory("conversor-base64")} />);
    expect(screen.getByRole("heading", { name: "Decodificar Base64" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Converter para Base64" })).toBeInTheDocument();
    expect(screen.getAllByRole("link")).toHaveLength(19);

    fireEvent.change(screen.getByLabelText("O que você quer converter?"), { target: { value: "pdf" } });
    expect(screen.getAllByRole("link")).toHaveLength(2);
  });
});

describe("Base64Tool", () => {
  it("codifica texto com acentos e emojis", async () => {
    renderTool("texto-para-base64");
    typeInput(/^Texto$/, "🚀 Alilu");
    convert();
    expect(await screen.findByDisplayValue("8J+agCBBbGlsdQ==")).toBeInTheDocument();
    expect(screen.getByText("Conversão concluída.")).toBeInTheDocument();
  });

  it("decodifica texto UTF-8", async () => {
    renderTool("base64-para-texto");
    typeInput(/^Base64$/, "U8OjbyBKb3PDqSBkb3MgQ2FtcG9z");
    convert();
    expect(await screen.findByDisplayValue("São José dos Campos")).toBeInTheDocument();
  });

  it("mostra erro amigável para Base64 inválido", async () => {
    renderTool("base64-para-texto");
    typeInput(/^Base64$/, "@@@");
    convert();
    expect(await screen.findByRole("alert")).toHaveTextContent("Base64 inválido.");
    expect(screen.getByLabelText(/^Base64$/)).toHaveAttribute("aria-invalid", "true");
  });

  it("decodifica Basic Auth separando usuário e senha", async () => {
    renderTool("basic-auth-decode");
    expect(screen.getByText(/Não use senhas reais/)).toBeInTheDocument();
    typeInput(/Cabeçalho Basic Auth/, "Basic dXNlcjpwYXNzd29yZA==");
    convert();
    expect(await screen.findByText("user")).toBeInTheDocument();
    expect(screen.getByText("password")).toBeInTheDocument();
    expect(screen.getByText("user:password")).toBeInTheDocument();
  });

  it("alterna maiúsculas no hexadecimal sem converter de novo", async () => {
    renderTool("base64-para-hex");
    typeInput(/^Base64$/, "QWxpbHU=");
    convert();
    expect(await screen.findByDisplayValue("416c696c75")).toBeInTheDocument();
    expect(screen.getByText("5 bytes")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(/Letras maiúsculas/));
    expect(screen.getByDisplayValue("416C696C75")).toBeInTheDocument();
  });

  it("gera Data URI de HTML sem renderizar o código", async () => {
    const { container } = renderTool("html-para-base64");
    typeInput(/Código HTML/, "<h1>Olá</h1><script>window.x=1</script>");
    convert();
    expect(await screen.findByLabelText("Data URI")).toHaveValue(
      `data:text/html;charset=utf-8;base64,${Buffer.from("<h1>Olá</h1><script>window.x=1</script>").toString("base64")}`
    );
    expect(container.querySelector("h1, script")).toBeNull();
  });

  it("converte o texto da URL no modo padrão", async () => {
    renderTool("url-para-base64");
    typeInput(/^URL$/, "https://alilu.com.br");
    convert();
    expect(await screen.findByDisplayValue("aHR0cHM6Ly9hbGlsdS5jb20uYnI=")).toBeInTheDocument();
  });

  it("baixa o conteúdo da URL pelo navegador, sem credenciais", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(new Uint8Array([0x41, 0x6c, 0x69, 0x6c, 0x75]), {
        status: 200,
        headers: { "content-type": "text/plain" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);
    renderTool("url-para-base64");
    fireEvent.click(screen.getByLabelText(/Conteúdo da URL/));
    typeInput(/URL do arquivo/, "https://example.com/a.txt");
    convert();
    expect(await screen.findByDisplayValue("QWxpbHU=")).toBeInTheDocument();
    expect(screen.getByLabelText("Data URI")).toHaveValue("data:text/plain;base64,QWxpbHU=");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.com/a.txt",
      expect.objectContaining({ credentials: "omit", mode: "cors" })
    );
  });

  it("rejeita protocolos que não são http(s) no modo conteúdo", async () => {
    renderTool("url-para-base64");
    fireEvent.click(screen.getByLabelText(/Conteúdo da URL/));
    typeInput(/URL do arquivo/, "file:///etc/passwd");
    convert();
    expect(await screen.findByRole("alert")).toHaveTextContent(/http/);
  });

  it("converte arquivo para Base64 e Data URI", async () => {
    renderTool("arquivo-para-base64");
    const file = new File(["Alilu"], "nota.txt", { type: "text/plain" });
    fireEvent.change(screen.getByTestId(/.+/), { target: { files: [file] } });
    expect(screen.getByText("nota.txt")).toBeInTheDocument();
    convert();
    expect(await screen.findByDisplayValue("QWxpbHU=")).toBeInTheDocument();
    expect(screen.getByLabelText("Data URI")).toHaveValue("data:text/plain;base64,QWxpbHU=");
  });

  it("recusa arquivo que não é PDF no PDF para Base64", async () => {
    renderTool("pdf-para-base64");
    const file = new File(["oi"], "foto.png", { type: "image/png" });
    fireEvent.change(screen.getByTestId(/.+/), { target: { files: [file] } });
    expect(await screen.findByRole("alert")).toHaveTextContent("Arquivo não suportado.");
  });

  it("recusa arquivo acima do limite", async () => {
    renderTool("imagem-para-base64");
    const file = new File(["x"], "grande.png", { type: "image/png" });
    Object.defineProperty(file, "size", { value: 25 * 1024 * 1024 });
    fireEvent.change(screen.getByTestId(/.+/), { target: { files: [file] } });
    expect(await screen.findByRole("alert")).toHaveTextContent("O arquivo é muito grande para processamento no navegador.");
  });

  it("decodifica PDF, valida o cabeçalho e oferece visualizar/baixar", async () => {
    renderTool("base64-para-pdf");
    typeInput(/Base64 ou Data URI do PDF/, "data:application/pdf;base64,JVBERi0xLjcK");
    convert();
    expect(await screen.findByRole("button", { name: "Baixar PDF" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Visualizar PDF" })).toHaveAttribute("href", expect.stringMatching(/^blob:/));
    expect(screen.getByText(/MIME: application\/pdf/)).toBeInTheDocument();
  });

  it("recusa Base64 que não é PDF", async () => {
    renderTool("base64-para-pdf");
    typeInput(/Base64 ou Data URI do PDF/, "QWxpbHU=");
    convert();
    expect(await screen.findByRole("alert")).toHaveTextContent(/não parece ser um PDF/);
  });

  it("mostra prévia de imagem com alt text", async () => {
    renderTool("base64-para-imagem");
    typeInput(/Base64 ou Data URI da imagem/, "iVBORw0KGgoAAAANSUhEUg==");
    convert();
    expect(await screen.findByAltText("Prévia da imagem")).toBeInTheDocument();
    expect(screen.getByText(/MIME: image\/png/)).toBeInTheDocument();
  });

  it("recusa Base64 que não é imagem", async () => {
    renderTool("base64-para-imagem");
    typeInput(/Base64 ou Data URI da imagem/, "QWxpbHU=");
    convert();
    expect(await screen.findByRole("alert")).toHaveTextContent(/não parece ser uma imagem/);
  });

  it("limpa entrada, resultado e libera o Blob URL", async () => {
    renderTool("base64-para-imagem");
    typeInput(/Base64 ou Data URI da imagem/, "iVBORw0KGgoAAAANSUhEUg==");
    convert();
    await screen.findByAltText("Prévia da imagem");
    fireEvent.click(screen.getByRole("button", { name: "Limpar" }));
    await waitFor(() => expect(screen.queryByAltText("Prévia da imagem")).toBeNull());
    expect(screen.getByLabelText(/Base64 ou Data URI da imagem/)).toHaveValue("");
    expect(URL.revokeObjectURL).toHaveBeenCalled();
  });
});
