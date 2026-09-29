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
    onGenerateFromImages: vi.fn(),
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

function makeImageFiles(names: string[]) {
  return names.map((name) => new File(["png"], name, { type: "image/png" }));
}

async function pickMultiImages(names: string[]) {
  const input = screen.getByTestId("carousel-quick-create-multi-images");
  fireEvent.change(input, { target: { files: makeImageFiles(names) } });
  await screen.findByText(names[names.length - 1]);
}

function switchToMultiMode() {
  fireEvent.click(screen.getByRole("button", { name: /várias imagens/i }));
}

describe("CarouselQuickCreate — Estado 1 (Criação)", () => {
  it("mostra o convite inicial e mantém 'Gerar carrossel' desabilitado sem imagem e sem texto", () => {
    renderQuickCreate();
    expect(screen.getByText("Crie seu carrossel")).toBeInTheDocument();
    expect(screen.getByText("Escolha a imagem de fundo")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /gerar carrossel/i })).toBeDisabled();
  });

  it("mostra o seletor de modo com 'Uma imagem + vários textos' selecionado por padrão", () => {
    renderQuickCreate();
    expect(screen.getByText("Como você deseja criar seu carrossel?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /uma imagem \+ vários textos/i })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(screen.getByRole("button", { name: /^várias imagens/i })).toHaveAttribute("aria-pressed", "false");
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

describe("CarouselQuickCreate — modo 'Várias imagens'", () => {
  it("trocar para 'Várias imagens' mostra a área de upload múltiplo, sem nenhum conteúdo do modo anterior", () => {
    renderQuickCreate();
    switchToMultiMode();
    expect(screen.getByText("Imagens do carrossel")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Envie uma imagem para cada slide. Você pode adicionar, remover e reorganizar as imagens antes de gerar o carrossel."
      )
    ).toBeInTheDocument();
    expect(screen.queryByText("Escolha a imagem de fundo")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Texto completo")).not.toBeInTheDocument();
  });

  it("Gerar carrossel começa desabilitado sem nenhuma imagem", () => {
    renderQuickCreate();
    switchToMultiMode();
    expect(screen.getByRole("button", { name: /gerar carrossel/i })).toBeDisabled();
  });

  it("Cenário completo do pedido: enviar [1,2,3], depois [4,5] concatena em vez de substituir", async () => {
    renderQuickCreate();
    switchToMultiMode();

    await pickMultiImages(["1.jpg", "2.jpg", "3.jpg"]);
    expect(screen.getByText("1.jpg")).toBeInTheDocument();
    expect(screen.getByText("2.jpg")).toBeInTheDocument();
    expect(screen.getByText("3.jpg")).toBeInTheDocument();
    expect(screen.getByText("3 de 20 imagens")).toBeInTheDocument();

    await pickMultiImages(["4.jpg", "5.jpg"]);

    // As 5 imagens devem estar presentes — nenhuma foi substituída (Seções 3/9/23).
    for (const name of ["1.jpg", "2.jpg", "3.jpg", "4.jpg", "5.jpg"]) {
      expect(screen.getByText(name)).toBeInTheDocument();
    }
    expect(screen.getByText("5 de 20 imagens")).toBeInTheDocument();

    // Ordem inicial: 1,2,3,4,5 — confirmado pela numeração dos slides.
    const slideLabels = screen.getAllByText(/^Slide \d+$/);
    expect(slideLabels.map((el) => el.textContent)).toEqual(["Slide 1", "Slide 2", "Slide 3", "Slide 4", "Slide 5"]);
  });

  it("remover uma imagem do meio renumera os slides sem afetar as outras (Seção 23)", async () => {
    renderQuickCreate();
    switchToMultiMode();
    await pickMultiImages(["1.jpg", "2.jpg", "3.jpg", "4.jpg", "5.jpg"]);

    fireEvent.click(screen.getByRole("button", { name: "Remover imagem 3" }));

    expect(screen.queryByText("3.jpg")).not.toBeInTheDocument();
    for (const name of ["1.jpg", "2.jpg", "4.jpg", "5.jpg"]) {
      expect(screen.getByText(name)).toBeInTheDocument();
    }
    expect(screen.getByText("4 de 20 imagens")).toBeInTheDocument();

    const slideLabels = screen.getAllByText(/^Slide \d+$/);
    expect(slideLabels.map((el) => el.textContent)).toEqual(["Slide 1", "Slide 2", "Slide 3", "Slide 4"]);
  });

  it("mover uma imagem para o início com os botões reordena a lista (Seção 23: 5 para a 1ª posição)", async () => {
    renderQuickCreate();
    switchToMultiMode();
    // Simula o estado após a remoção do teste anterior: [1,2,4,5].
    await pickMultiImages(["1.jpg", "2.jpg", "4.jpg", "5.jpg"]);

    // "5.jpg" é o 4º item — precisa subir 3 posições para virar o 1º.
    fireEvent.click(screen.getByRole("button", { name: "Mover imagem 4 para cima" }));
    fireEvent.click(screen.getByRole("button", { name: "Mover imagem 3 para cima" }));
    fireEvent.click(screen.getByRole("button", { name: "Mover imagem 2 para cima" }));

    const fileNameLabels = screen
      .getAllByText(/^\d\.jpg$/)
      .map((el) => el.textContent);
    expect(fileNameLabels).toEqual(["5.jpg", "1.jpg", "2.jpg", "4.jpg"]);
  });

  it("gera o carrossel na ordem atual, chamando onGenerateFromImages com uma entrada por imagem", async () => {
    const handlers = renderQuickCreate();
    switchToMultiMode();
    await pickMultiImages(["a.jpg", "b.jpg"]);

    const button = screen.getByRole("button", { name: /gerar carrossel/i });
    expect(button).not.toBeDisabled();
    fireEvent.click(button);

    expect(handlers.onGenerateFromImages).toHaveBeenCalledTimes(1);
    expect(handlers.onGenerateFromImages).toHaveBeenCalledWith([
      expect.objectContaining({ fileName: "a.jpg", url: "blob:nova" }),
      expect.objectContaining({ fileName: "b.jpg", url: "blob:nova" }),
    ]);
  });

  it("um arquivo inválido no lote não cancela os outros — só ele é reportado como erro (Seção 16)", async () => {
    renderQuickCreate();
    switchToMultiMode();

    const input = screen.getByTestId("carousel-quick-create-multi-images");
    const files = [
      new File(["png"], "boa.png", { type: "image/png" }),
      new File(["txt"], "ruim.txt", { type: "text/plain" }),
    ];
    fireEvent.change(input, { target: { files } });

    await screen.findByText("boa.png");
    expect(screen.queryByText("ruim.txt")).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(/ruim\.txt/);
    expect(screen.getByText("1 de 20 imagens")).toBeInTheDocument();
  });

  it("troca de modo com conteúdo já preenchido pede confirmação antes de trocar", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    renderQuickCreate();
    await pickImage();

    switchToMultiMode();

    expect(confirmSpy).toHaveBeenCalledWith(
      "Você já adicionou conteúdo. Trocar o modo pode remover a configuração atual. Deseja continuar?"
    );
    // Cancelou — continua no modo "Uma imagem + vários textos", com a imagem preservada.
    expect(screen.getByText("foto.png")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /uma imagem \+ vários textos/i })).toHaveAttribute(
      "aria-pressed",
      "true"
    );

    confirmSpy.mockRestore();
  });

  it("confirmando a troca de modo limpa o conteúdo do modo anterior", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    renderQuickCreate();
    await pickImage();
    fireEvent.change(screen.getByLabelText("Texto completo"), { target: { value: "Algum texto" } });

    switchToMultiMode();

    expect(screen.getByRole("button", { name: /^várias imagens/i })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Imagens do carrossel")).toBeInTheDocument();

    // Volta para "Uma imagem + vários textos" sem confirmação necessária, pois o modo "Várias imagens" está vazio.
    confirmSpy.mockReturnValue(true);
    fireEvent.click(screen.getByRole("button", { name: /uma imagem \+ vários textos/i }));
    expect(screen.queryByText("foto.png")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Texto completo")).toHaveValue("");

    confirmSpy.mockRestore();
  });
});
