import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

vi.mock("@/lib/instagram/image-utils", async () => {
  const actual = await vi.importActual<typeof import("@/lib/instagram/image-utils")>("@/lib/instagram/image-utils");
  return {
    ...actual,
    createImageObjectUrl: () => "blob:nova",
    revokeImageObjectUrl: vi.fn(),
    loadImageElement: vi.fn().mockResolvedValue({ naturalWidth: 800, naturalHeight: 600 }),
  };
});

const { CarouselQuickCreate } = await import(
  "@/components/tools/instagram-carousel-creator/CarouselQuickCreate"
);

function renderQuickCreate(extra: Record<string, unknown> = {}) {
  const handlers = {
    formatId: "quadrado" as const,
    onFormatChange: vi.fn(),
    busy: false,
    error: null,
    onGenerate: vi.fn(),
    ...extra,
  };
  render(<CarouselQuickCreate {...handlers} />);
  return handlers;
}

async function pickImage(testId = "carousel-quick-create-image") {
  const input = screen.getByTestId(testId);
  fireEvent.change(input, { target: { files: [new File(["png"], "foto.png", { type: "image/png" })] } });
  await screen.findByText("foto.png");
}

describe("CarouselQuickCreate — Estado 1 (Criação)", () => {
  it("mostra o convite inicial e mantém 'Gerar carrossel' desabilitado sem imagem e sem texto", () => {
    renderQuickCreate();
    expect(screen.getByText("Crie seu carrossel")).toBeInTheDocument();
    expect(screen.getByText("Escolha a imagem de fundo")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /gerar carrossel/i })).toBeDisabled();
  });

  it("com imagem mas sem texto, o botão continua desabilitado", async () => {
    renderQuickCreate();
    await pickImage();
    expect(screen.getByRole("button", { name: /gerar carrossel/i })).toBeDisabled();
  });

  it("mostra a contagem de caracteres ao digitar", () => {
    renderQuickCreate();
    fireEvent.change(screen.getByLabelText("Texto completo"), { target: { value: "Olá mundo" } });
    expect(screen.getByText("9 caracteres")).toBeInTheDocument();
  });

  it("com imagem e texto, habilita o botão e chama onGenerate com o texto e a imagem escolhidos", async () => {
    const handlers = renderQuickCreate();
    await pickImage();
    fireEvent.change(screen.getByLabelText("Texto completo"), { target: { value: "Meu conteúdo completo aqui." } });

    const button = screen.getByRole("button", { name: /gerar carrossel/i });
    expect(button).not.toBeDisabled();
    fireEvent.click(button);

    expect(handlers.onGenerate).toHaveBeenCalledWith(
      "Meu conteúdo completo aqui.",
      expect.objectContaining({ url: "blob:nova", fileName: "foto.png", naturalWidth: 800, naturalHeight: 600 })
    );
  });

  it("com uma prévia herdada (Editar texto original) e nenhuma imagem nova escolhida, onGenerate recebe image: null", () => {
    const handlers = renderQuickCreate({
      initialText: "Texto de origem",
      initialImagePreview: { url: "blob:atual", fileName: "atual.jpg", naturalWidth: 1000, naturalHeight: 1000 },
    });

    expect(screen.getByDisplayValue("Texto de origem")).toBeInTheDocument();
    expect(screen.getByText("atual.jpg")).toBeInTheDocument();

    const button = screen.getByRole("button", { name: /gerar carrossel/i });
    expect(button).not.toBeDisabled();
    fireEvent.click(button);

    expect(handlers.onGenerate).toHaveBeenCalledWith("Texto de origem", null);
  });

  it("trocar a imagem herdada por uma nova faz onGenerate usar a nova imagem", async () => {
    const handlers = renderQuickCreate({
      initialText: "Texto de origem",
      initialImagePreview: { url: "blob:atual", fileName: "atual.jpg", naturalWidth: 1000, naturalHeight: 1000 },
    });

    fireEvent.change(screen.getByTestId("carousel-quick-create-image-replace"), {
      target: { files: [new File(["png"], "nova.png", { type: "image/png" })] },
    });
    await screen.findByText("nova.png");

    fireEvent.click(screen.getByRole("button", { name: /gerar carrossel/i }));
    expect(handlers.onGenerate).toHaveBeenLastCalledWith(
      "Texto de origem",
      expect.objectContaining({ fileName: "nova.png" })
    );
  });

  it("remover a imagem escolhida volta para o convite de upload", async () => {
    renderQuickCreate();
    await pickImage();
    fireEvent.click(screen.getByRole("button", { name: "Remover" }));
    expect(screen.getByText("Escolha a imagem de fundo")).toBeInTheDocument();
  });

  it("troca de formato chama onFormatChange", () => {
    const handlers = renderQuickCreate();
    fireEvent.click(screen.getByRole("button", { name: /vertical/i }));
    expect(handlers.onFormatChange).toHaveBeenCalledWith("vertical");
  });

  it("estado ocupado (busy) desabilita o botão e mostra 'Gerando carrossel...'", async () => {
    renderQuickCreate({ busy: true });
    expect(screen.getByRole("button", { name: /gerando carrossel/i })).toBeDisabled();
  });

  it("mostra a mensagem de erro quando fornecida", () => {
    renderQuickCreate({ error: "Não foi possível gerar o carrossel agora." });
    expect(screen.getByRole("alert")).toHaveTextContent("Não foi possível gerar o carrossel agora.");
  });
});
