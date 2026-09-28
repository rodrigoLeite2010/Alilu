import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { CarouselEditorTool } from "@/components/tools/instagram-carousel-creator/CarouselEditorTool";
import {
  createCarouselSlide,
  createInitialCarouselState,
  GENERATED_CAROUSEL_TEMPLATE_ID,
  GENERATED_CAROUSEL_TEXT_SLOT,
  type CarouselEditorState,
} from "@/lib/instagram/carousel/carousel-state";
import { updateTextValue } from "@/lib/instagram/editor-state";

// "Gerar carrossel"/"Redistribuir texto" (Estado 1 → Estado 2) passam por
// buildCarouselFromPastedText (auto-carousel.ts), que por baixo dos panos
// precisa de um <canvas> de verdade para medir texto — indisponível no
// jsdom (ver "Not implemented: HTMLCanvasElement's getContext()" nos
// outros testes deste arquivo). Simulamos essa função para testar a
// ORQUESTRAÇÃO (troca de Estado 1 → Estado 2, aviso de limite, botões de
// "Carrossel automático") sem depender de canvas de verdade — o algoritmo
// de divisão de texto em si já tem cobertura própria e completa em
// __tests__/lib/instagram-carousel-generate-slides.test.ts e
// __tests__/lib/instagram-carousel-auto-carousel.test.ts.
vi.mock("@/lib/instagram/carousel/auto-carousel", async () => {
  const actual = await vi.importActual<typeof import("@/lib/instagram/carousel/auto-carousel")>(
    "@/lib/instagram/carousel/auto-carousel"
  );
  return { ...actual, buildCarouselFromPastedText: vi.fn() };
});
vi.mock("@/lib/instagram/image-utils", async () => {
  const actual = await vi.importActual<typeof import("@/lib/instagram/image-utils")>("@/lib/instagram/image-utils");
  return {
    ...actual,
    createImageObjectUrl: () => "blob:nova",
    revokeImageObjectUrl: vi.fn(),
    loadImageElement: vi.fn().mockResolvedValue({ naturalWidth: 800, naturalHeight: 600 }),
  };
});

const { buildCarouselFromPastedText } = await import("@/lib/instagram/carousel/auto-carousel");
const mockedBuildCarouselFromPastedText = buildCarouselFromPastedText as Mock;

/** Monta um CarouselEditorState "gerado" (originalText presente) sem depender de canvas/fetch reais — um slide por pedaço, mesmo template/slot que createCarouselStateFromTextChunks usa de verdade. */
function buildGeneratedState(chunks: string[], originalText = chunks.join("\n\n")): CarouselEditorState {
  const slides = chunks.map((chunk, index) => {
    const slide = createCarouselSlide("quadrado", GENERATED_CAROUSEL_TEMPLATE_ID);
    const withImage = {
      ...slide.state,
      backgroundImage: { ...slide.state.backgroundImage, url: `blob:seed-${index}`, fileName: "foto.jpg" },
    };
    const withText = updateTextValue(withImage, GENERATED_CAROUSEL_TEXT_SLOT, chunk);
    return { ...slide, order: index, state: withText };
  });
  return { formatId: "quadrado", slides, selectedSlideId: slides[0].id, originalText };
}

// Todos os testes abaixo cobrem o Estado 2 ("Revisão") — o editor completo de
// sempre — então renderizam já com um `initialState` pronto (mesmo formato de
// PublicCarouselCreator.tsx ao restaurar um rascunho), em vez de depender do
// comportamento padrão sem login: desde o Carrossel automático (ETAPA 8/9),
// `<CarouselEditorTool />` sem `initialState` abre no Estado 1 ("Criação"),
// coberto à parte em "CarouselEditorTool — Estado 1 (Criação) e Carrossel
// automático" mais abaixo.
function renderReview(props: Parameters<typeof CarouselEditorTool>[0] = {}) {
  return render(<CarouselEditorTool initialState={createInitialCarouselState()} {...props} />);
}

describe("CarouselEditorTool — criação inicial (ETAPA 2)", () => {
  it("começa com 5 slides editáveis, o primeiro selecionado, e mostra a prévia", () => {
    renderReview();

    expect(screen.getByText("5 de 20 slides")).toBeInTheDocument();
    expect(screen.getByTestId("instagram-post-canvas")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Selecionar slide 1" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Editando: Slide 1 de 5")).toBeInTheDocument();
    expect(screen.getByLabelText("Título")).toHaveValue("Novo horário de atendimento");
  });
});

describe("CarouselEditorTool — edição independente por slide (ETAPA 3)", () => {
  it("editar um slide não altera os outros, e o conteúdo é preservado ao navegar entre slides", () => {
    renderReview();

    fireEvent.change(screen.getByLabelText("Título"), { target: { value: "Conteúdo do slide 1" } });
    expect(screen.getByLabelText("Título")).toHaveValue("Conteúdo do slide 1");

    fireEvent.click(screen.getByRole("button", { name: "Selecionar slide 2" }));
    expect(screen.getByLabelText("Título")).toHaveValue("Novo horário de atendimento");
    expect(screen.getByText("Editando: Slide 2 de 5")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Título"), { target: { value: "Conteúdo do slide 2" } });

    fireEvent.click(screen.getByRole("button", { name: "Selecionar slide 1" }));
    expect(screen.getByLabelText("Título")).toHaveValue("Conteúdo do slide 1");

    fireEvent.click(screen.getByRole("button", { name: "Selecionar slide 2" }));
    expect(screen.getByLabelText("Título")).toHaveValue("Conteúdo do slide 2");
  });
});

describe("CarouselEditorTool — adicionar, duplicar, reordenar, excluir e exportar", () => {
  it("adicionar um slide aumenta a contagem e seleciona o novo slide, logo após o selecionado", () => {
    renderReview();

    fireEvent.click(screen.getByRole("button", { name: "Adicionar slide" }));

    expect(screen.getByText("6 de 20 slides")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Selecionar slide 2" })).toHaveAttribute("aria-pressed", "true");
  });

  it("excluir sempre deixa pelo menos 1 slide — o botão de excluir fica desabilitado com um único slide restante", () => {
    renderReview();

    for (let i = 0; i < 4; i += 1) {
      fireEvent.click(screen.getByRole("button", { name: "Excluir slide 1" }));
    }

    expect(screen.getByText("1 de 20 slides")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Excluir slide 1" })).toBeDisabled();
  });

  it("cenário completo: criar, duplicar, reordenar (setas de mover, usadas também no celular), excluir e exportar", async () => {
    renderReview();

    // Editar o slide 1 (selecionado por padrão) para poder rastrear seu conteúdo.
    fireEvent.change(screen.getByLabelText("Título"), { target: { value: "Original A" } });

    // Duplicar o slide 1 — deve virar 6 slides, com a cópia selecionada logo após o original,
    // levando consigo o conteúdo já editado (cópia independente, ETAPA 3).
    fireEvent.click(screen.getByRole("button", { name: "Duplicar slide 1" }));
    await waitFor(() => expect(screen.getByText("6 de 20 slides")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Selecionar slide 2" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText("Título")).toHaveValue("Original A");

    // Editar a cópia não deve afetar o slide original.
    fireEvent.change(screen.getByLabelText("Título"), { target: { value: "Cópia editada" } });

    // Reordenar: mover a cópia (posição 2) para baixo — vira posição 3 — usando os
    // controles de mover para cima/baixo (os mesmos disponíveis no celular, ETAPA 4/14).
    fireEvent.click(screen.getByRole("button", { name: "Mover slide 2 para baixo" }));
    expect(screen.getByRole("button", { name: "Selecionar slide 3" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText("Título")).toHaveValue("Cópia editada");

    // O slide 1 original continua com seu próprio conteúdo, intacto.
    fireEvent.click(screen.getByRole("button", { name: "Selecionar slide 1" }));
    expect(screen.getByLabelText("Título")).toHaveValue("Original A");

    // Excluir o slide 1 (não é o selecionado no momento da exclusão) não deve
    // alterar a seleção nem o conteúdo dos demais slides.
    fireEvent.click(screen.getByRole("button", { name: "Selecionar slide 3" }));
    fireEvent.click(screen.getByRole("button", { name: "Excluir slide 1" }));
    expect(screen.getByText("5 de 20 slides")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Selecionar slide 2" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText("Título")).toHaveValue("Cópia editada");

    // Exportar: o botão existe, fica ocupado durante o processamento e trata erro
    // de forma amigável (o jsdom não implementa canvas de verdade) sem travar a
    // página nem deixar o botão preso em "Gerando...".
    const exportButton = screen.getByRole("button", { name: /baixar carrossel em zip/i });
    fireEvent.click(exportButton);

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: /baixar carrossel em zip/i })).not.toBeDisabled());
  });
});

describe("CarouselEditorTool — formato do carrossel (ETAPA 5)", () => {
  it("trocar o formato marca o novo formato como selecionado e preserva o texto já editado", () => {
    renderReview();

    fireEvent.change(screen.getByLabelText("Título"), { target: { value: "Preservado na troca de formato" } });

    const vertical = screen.getByRole("button", { name: /vertical/i });
    fireEvent.click(vertical);

    expect(vertical).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText("Título")).toHaveValue("Preservado na troca de formato");
  });
});

describe("CarouselEditorTool — modelos prontos de carrossel (ETAPA 7)", () => {
  it("aplicar um modelo pede confirmação e, quando confirmado, substitui todos os slides", () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    renderReview();

    fireEvent.click(screen.getByRole("button", { name: /^dicas/i }));

    expect(confirmSpy).toHaveBeenCalled();
    expect(screen.getByText("5 de 20 slides")).toBeInTheDocument();
    expect(screen.getByLabelText("Título")).toHaveValue("Dicas rápidas sobre este assunto");

    confirmSpy.mockRestore();
  });

  it("aplicar um modelo não faz nada se o usuário cancelar a confirmação", () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    renderReview();

    fireEvent.change(screen.getByLabelText("Título"), { target: { value: "Não deveria ser apagado" } });
    fireEvent.click(screen.getByRole("button", { name: /^dicas/i }));

    expect(screen.getByLabelText("Título")).toHaveValue("Não deveria ser apagado");

    confirmSpy.mockRestore();
  });
});

describe("CarouselEditorTool — slot opcional de publicação real (calendário editorial)", () => {
  it("sem publishPanel (uso público, sem login) não renderiza nenhum conteúdo extra de publicação", () => {
    renderReview();
    expect(screen.queryByTestId("carousel-publish-panel-slot")).not.toBeInTheDocument();
  });

  it("com publishPanel, renderiza o componente recebendo os slides e o formato atuais", () => {
    function TestPublishPanel({
      slides,
      formatId,
    }: {
      slides: { id: string }[];
      formatId: string;
    }) {
      return (
        <div data-testid="carousel-publish-panel-slot">
          {formatId} — slides: {slides.length}
        </div>
      );
    }

    renderReview({ publishPanel: TestPublishPanel });

    expect(screen.getByTestId("carousel-publish-panel-slot")).toHaveTextContent("quadrado — slides: 5");
  });
});

describe("CarouselEditorTool — integração com o Gerador de Legendas (ETAPA 12)", () => {
  it("o link para criar legenda leva o assunto do primeiro slide preenchido pelo usuário", () => {
    renderReview();

    fireEvent.change(screen.getByLabelText("Título"), { target: { value: "Assunto do carrossel" } });

    const link = screen.getByRole("link", { name: /criar uma legenda para este carrossel/i });
    expect(link).toHaveAttribute("href", "/instagram/legendas?assunto=Assunto%20do%20carrossel");
  });

  it("com todos os títulos em branco, o link para legendas não leva assunto", () => {
    renderReview();

    // Esvazia o título de todos os slides — só então nenhum assunto pode ser sugerido.
    for (let i = 1; i <= 5; i += 1) {
      fireEvent.click(screen.getByRole("button", { name: `Selecionar slide ${i}` }));
      fireEvent.change(screen.getByLabelText("Título"), { target: { value: "" } });
    }

    const link = screen.getByRole("link", { name: /criar uma legenda para este carrossel/i });
    expect(link).toHaveAttribute("href", "/instagram/legendas");
  });
});

describe("CarouselEditorTool — Estado 1 (Criação) e Carrossel automático (ETAPA 8/9)", () => {
  it("sem initialState, abre no Estado 1 (Criação) — sem 'Editando: Slide', só imagem + texto + Gerar carrossel", () => {
    render(<CarouselEditorTool />);
    expect(screen.getByText("Crie seu carrossel")).toBeInTheDocument();
    expect(screen.queryByText(/Editando: Slide/)).not.toBeInTheDocument();
  });

  it("com initialState (rascunho restaurado), abre direto no Estado 2 (Revisão)", () => {
    renderReview();
    expect(screen.queryByText("Crie seu carrossel")).not.toBeInTheDocument();
    expect(screen.getByText("Editando: Slide 1 de 5")).toBeInTheDocument();
  });

  it("gerar com sucesso troca para o Estado 2, com o número de slides e o texto originais preservados", async () => {
    mockedBuildCarouselFromPastedText.mockResolvedValueOnce({
      state: buildGeneratedState(["Primeiro slide.", "Segundo slide.", "Terceiro slide."]),
      overflowText: null,
    });

    render(<CarouselEditorTool />);
    fireEvent.change(screen.getByTestId("carousel-quick-create-image"), {
      target: { files: [new File(["png"], "foto.jpg", { type: "image/png" })] },
    });
    await screen.findByText("foto.jpg");
    fireEvent.change(screen.getByLabelText("Texto completo"), {
      target: { value: "Primeiro slide.\n\nSegundo slide.\n\nTerceiro slide." },
    });
    fireEvent.click(screen.getByRole("button", { name: /gerar carrossel/i }));

    await screen.findByText("Editando: Slide 1 de 3");
    expect(screen.getByText("3 de 20 slides")).toBeInTheDocument();
    // O painel de ações do Carrossel automático só aparece para carrosséis gerados (originalText presente).
    expect(screen.getByRole("button", { name: "Editar texto original" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /redistribuir texto/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /trocar imagem de fundo/i })).toBeInTheDocument();
  });

  it("mais slides do que o limite de publicação do Instagram mostra o aviso, com as duas opções pedidas", async () => {
    const chunks = Array.from({ length: 12 }, (_, i) => `Slide ${i + 1}.`);
    mockedBuildCarouselFromPastedText.mockResolvedValueOnce({
      state: buildGeneratedState(chunks),
      overflowText: null,
    });

    render(<CarouselEditorTool />);
    fireEvent.change(screen.getByTestId("carousel-quick-create-image"), {
      target: { files: [new File(["png"], "foto.jpg", { type: "image/png" })] },
    });
    await screen.findByText("foto.jpg");
    fireEvent.change(screen.getByLabelText("Texto completo"), { target: { value: chunks.join("\n\n") } });
    fireEvent.click(screen.getByRole("button", { name: /gerar carrossel/i }));

    await screen.findByText(/Seu conteúdo gerou 12 slides/);
    expect(screen.getByText(/O Instagram permite até 10 imagens por carrossel/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reduzir conteúdo" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Criar outro carrossel com o restante" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Dispensar" }));
    expect(screen.queryByText(/Seu conteúdo gerou 12 slides/)).not.toBeInTheDocument();
  });

  it("'Editar texto original' volta para o Estado 1 com o texto original pré-preenchido", async () => {
    mockedBuildCarouselFromPastedText.mockResolvedValueOnce({
      state: buildGeneratedState(["Parágrafo um.", "Parágrafo dois."]),
      overflowText: null,
    });

    render(<CarouselEditorTool />);
    fireEvent.change(screen.getByTestId("carousel-quick-create-image"), {
      target: { files: [new File(["png"], "foto.jpg", { type: "image/png" })] },
    });
    await screen.findByText("foto.jpg");
    fireEvent.change(screen.getByLabelText("Texto completo"), { target: { value: "Parágrafo um.\n\nParágrafo dois." } });
    fireEvent.click(screen.getByRole("button", { name: /gerar carrossel/i }));
    await screen.findByText("Editando: Slide 1 de 2");

    fireEvent.click(screen.getByRole("button", { name: "Editar texto original" }));

    expect(screen.getByText("Crie seu carrossel")).toBeInTheDocument();
    expect(screen.getByLabelText("Texto completo")).toHaveValue("Parágrafo um.\n\nParágrafo dois.");
  });

  it("sem canvas de verdade (jsdom), 'Gerar carrossel' mostra um erro amigável em vez de travar", async () => {
    // Usa a implementação REAL (não mocada) de buildCarouselFromPastedText para este teste específico —
    // confirma que o caminho de erro (sem canvas no jsdom) aparece como mensagem amigável.
    const actual = await vi.importActual<typeof import("@/lib/instagram/carousel/auto-carousel")>(
      "@/lib/instagram/carousel/auto-carousel"
    );
    mockedBuildCarouselFromPastedText.mockImplementationOnce(actual.buildCarouselFromPastedText);

    render(<CarouselEditorTool />);
    fireEvent.change(screen.getByTestId("carousel-quick-create-image"), {
      target: { files: [new File(["png"], "foto.jpg", { type: "image/png" })] },
    });
    await screen.findByText("foto.jpg");
    fireEvent.change(screen.getByLabelText("Texto completo"), { target: { value: "Algum texto." } });
    fireEvent.click(screen.getByRole("button", { name: /gerar carrossel/i }));

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("Crie seu carrossel")).toBeInTheDocument();
  });
});

describe("CarouselEditorTool — Redistribuir texto e Trocar imagem de fundo (ETAPA 9)", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ blob: async () => new Blob() }) as unknown as Response)
    );
    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL: vi.fn(() => "blob:cloned"),
      revokeObjectURL: vi.fn(),
    });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("'Redistribuir texto' chama buildCarouselFromPastedText de novo com o mesmo originalText", async () => {
    mockedBuildCarouselFromPastedText.mockResolvedValueOnce({
      state: buildGeneratedState(["Um.", "Dois."]),
      overflowText: null,
    });
    render(<CarouselEditorTool />);
    fireEvent.change(screen.getByTestId("carousel-quick-create-image"), {
      target: { files: [new File(["png"], "foto.jpg", { type: "image/png" })] },
    });
    await screen.findByText("foto.jpg");
    fireEvent.change(screen.getByLabelText("Texto completo"), { target: { value: "Um.\n\nDois." } });
    fireEvent.click(screen.getByRole("button", { name: /gerar carrossel/i }));
    await screen.findByText("Editando: Slide 1 de 2");

    mockedBuildCarouselFromPastedText.mockResolvedValueOnce({
      state: buildGeneratedState(["Um.", "Dois.", "Três."]),
      overflowText: null,
    });
    fireEvent.click(screen.getByRole("button", { name: /redistribuir texto/i }));

    await screen.findByText("Editando: Slide 1 de 3");
    const lastCall = mockedBuildCarouselFromPastedText.mock.calls.at(-1)?.[0];
    expect(lastCall.text).toBe("Um.\n\nDois.");
  });

  it("'Trocar imagem de fundo' aplica a nova imagem a todos os slides sem alterar os textos", async () => {
    mockedBuildCarouselFromPastedText.mockResolvedValueOnce({
      state: buildGeneratedState(["Texto do slide 1.", "Texto do slide 2."]),
      overflowText: null,
    });
    render(<CarouselEditorTool />);
    fireEvent.change(screen.getByTestId("carousel-quick-create-image"), {
      target: { files: [new File(["png"], "foto.jpg", { type: "image/png" })] },
    });
    await screen.findByText("foto.jpg");
    fireEvent.change(screen.getByLabelText("Texto completo"), {
      target: { value: "Texto do slide 1.\n\nTexto do slide 2." },
    });
    fireEvent.click(screen.getByRole("button", { name: /gerar carrossel/i }));
    await screen.findByText("Editando: Slide 1 de 2");

    fireEvent.change(screen.getByTestId("carousel-change-background-image"), {
      target: { files: [new File(["png"], "nova-imagem.png", { type: "image/png" })] },
    });

    await waitFor(() => expect(screen.getByLabelText("Frase principal")).toBeInTheDocument());
    // O texto do slide continua o mesmo depois de trocar só a imagem.
    fireEvent.click(screen.getByRole("button", { name: "Selecionar slide 2" }));
    expect(screen.getByLabelText("Frase principal")).toHaveValue("Texto do slide 2.");
  });
});
