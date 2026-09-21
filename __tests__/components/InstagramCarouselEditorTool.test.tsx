import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { CarouselEditorTool } from "@/components/tools/instagram-carousel-creator/CarouselEditorTool";

describe("CarouselEditorTool — criação inicial (ETAPA 2)", () => {
  it("começa com 5 slides editáveis, o primeiro selecionado, e mostra a prévia", () => {
    render(<CarouselEditorTool />);

    expect(screen.getByText("5 de 20 slides")).toBeInTheDocument();
    expect(screen.getByTestId("instagram-post-canvas")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Selecionar slide 1" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Editando: Slide 1 de 5")).toBeInTheDocument();
    expect(screen.getByLabelText("Título")).toHaveValue("Novo horário de atendimento");
  });
});

describe("CarouselEditorTool — edição independente por slide (ETAPA 3)", () => {
  it("editar um slide não altera os outros, e o conteúdo é preservado ao navegar entre slides", () => {
    render(<CarouselEditorTool />);

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
    render(<CarouselEditorTool />);

    fireEvent.click(screen.getByRole("button", { name: "Adicionar slide" }));

    expect(screen.getByText("6 de 20 slides")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Selecionar slide 2" })).toHaveAttribute("aria-pressed", "true");
  });

  it("excluir sempre deixa pelo menos 1 slide — o botão de excluir fica desabilitado com um único slide restante", () => {
    render(<CarouselEditorTool />);

    for (let i = 0; i < 4; i += 1) {
      fireEvent.click(screen.getByRole("button", { name: "Excluir slide 1" }));
    }

    expect(screen.getByText("1 de 20 slides")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Excluir slide 1" })).toBeDisabled();
  });

  it("cenário completo: criar, duplicar, reordenar (setas de mover, usadas também no celular), excluir e exportar", async () => {
    render(<CarouselEditorTool />);

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
    render(<CarouselEditorTool />);

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
    render(<CarouselEditorTool />);

    fireEvent.click(screen.getByRole("button", { name: /^dicas/i }));

    expect(confirmSpy).toHaveBeenCalled();
    expect(screen.getByText("5 de 20 slides")).toBeInTheDocument();
    expect(screen.getByLabelText("Título")).toHaveValue("Dicas rápidas sobre este assunto");

    confirmSpy.mockRestore();
  });

  it("aplicar um modelo não faz nada se o usuário cancelar a confirmação", () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<CarouselEditorTool />);

    fireEvent.change(screen.getByLabelText("Título"), { target: { value: "Não deveria ser apagado" } });
    fireEvent.click(screen.getByRole("button", { name: /^dicas/i }));

    expect(screen.getByLabelText("Título")).toHaveValue("Não deveria ser apagado");

    confirmSpy.mockRestore();
  });
});

describe("CarouselEditorTool — integração com o Gerador de Legendas (ETAPA 12)", () => {
  it("o link para criar legenda leva o assunto do primeiro slide preenchido pelo usuário", () => {
    render(<CarouselEditorTool />);

    fireEvent.change(screen.getByLabelText("Título"), { target: { value: "Assunto do carrossel" } });

    const link = screen.getByRole("link", { name: /criar uma legenda para este carrossel/i });
    expect(link).toHaveAttribute("href", "/instagram/legendas?assunto=Assunto%20do%20carrossel");
  });

  it("com todos os títulos em branco, o link para legendas não leva assunto", () => {
    render(<CarouselEditorTool />);

    // Esvazia o título de todos os slides — só então nenhum assunto pode ser sugerido.
    for (let i = 1; i <= 5; i += 1) {
      fireEvent.click(screen.getByRole("button", { name: `Selecionar slide ${i}` }));
      fireEvent.change(screen.getByLabelText("Título"), { target: { value: "" } });
    }

    const link = screen.getByRole("link", { name: /criar uma legenda para este carrossel/i });
    expect(link).toHaveAttribute("href", "/instagram/legendas");
  });
});
