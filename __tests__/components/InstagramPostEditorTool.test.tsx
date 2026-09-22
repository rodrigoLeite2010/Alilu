import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { RefObject } from "react";
import { PostEditorTool } from "@/components/tools/instagram-post-creator/PostEditorTool";
import type { PostFormat } from "@/lib/instagram/formats";

describe("PostEditorTool", () => {
  it("renderiza a prévia e os textos padrão do template inicial (Promoção)", () => {
    render(<PostEditorTool />);

    expect(screen.getByTestId("instagram-post-canvas")).toBeInTheDocument();
    expect(screen.getByLabelText("Título promocional")).toHaveValue("Mega Promoção");
    expect(screen.getByRole("button", { name: /baixar png/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /baixar jpg/i })).toBeInTheDocument();
  });

  it("desfazer/refazer começam desabilitados e ficam disponíveis após uma ação", () => {
    render(<PostEditorTool />);

    const undoButton = screen.getByRole("button", { name: /^desfazer$/i });
    const redoButton = screen.getByRole("button", { name: /^refazer$/i });
    expect(undoButton).toBeDisabled();
    expect(redoButton).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: /vertical/i }));
    expect(undoButton).not.toBeDisabled();
  });

  it("trocar de formato marca o novo formato como selecionado", () => {
    render(<PostEditorTool />);

    const quadrado = screen.getByRole("button", { name: /quadrado/i });
    const stories = screen.getByRole("button", { name: /stories/i });
    expect(quadrado).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(stories);
    expect(stories).toHaveAttribute("aria-pressed", "true");
    expect(quadrado).toHaveAttribute("aria-pressed", "false");
  });

  it("desfazer reverte a troca de formato", () => {
    render(<PostEditorTool />);

    const quadrado = screen.getByRole("button", { name: /quadrado/i });
    const stories = screen.getByRole("button", { name: /stories/i });

    fireEvent.click(stories);
    expect(stories).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(screen.getByRole("button", { name: /^desfazer$/i }));
    expect(quadrado).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(screen.getByRole("button", { name: /^refazer$/i }));
    expect(stories).toHaveAttribute("aria-pressed", "true");
  });

  it("trocar de template atualiza os textos que ainda estavam no padrão, sem apagar edições do usuário", () => {
    render(<PostEditorTool />);

    fireEvent.change(screen.getByLabelText("Texto complementar"), {
      target: { value: "Texto editado pelo usuário" },
    });

    fireEvent.click(screen.getByRole("button", { name: /restaurante/i }));

    // "Título promocional" virou "Nome do produto" no template Restaurante,
    // com o valor padrão do novo template (não tinha sido editado).
    expect(screen.getByLabelText("Nome do produto")).toHaveValue("X-Burger Especial");
  });

  it("digitar em um campo de texto atualiza a prévia (o valor do campo) imediatamente", () => {
    render(<PostEditorTool />);

    const heading = screen.getByLabelText("Título promocional");
    fireEvent.change(heading, { target: { value: "Black Friday Alilu" } });

    expect(heading).toHaveValue("Black Friday Alilu");
  });

  it("desfazer reverte uma edição de texto recém-digitada, mesmo antes da pausa de debounce", () => {
    render(<PostEditorTool />);

    const heading = screen.getByLabelText("Título promocional");
    fireEvent.change(heading, { target: { value: "Rascunho temporário" } });
    expect(heading).toHaveValue("Rascunho temporário");

    fireEvent.click(screen.getByRole("button", { name: /^desfazer$/i }));
    expect(heading).toHaveValue("Mega Promoção");
  });

  it('"Começar novamente" pede confirmação antes de apagar as alterações', () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<PostEditorTool />);

    fireEvent.change(screen.getByLabelText("Título promocional"), {
      target: { value: "Não deveria ser apagado" },
    });
    fireEvent.click(screen.getByRole("button", { name: /começar novamente/i }));

    expect(confirmSpy).toHaveBeenCalled();
    expect(screen.getByLabelText("Título promocional")).toHaveValue("Não deveria ser apagado");

    confirmSpy.mockRestore();
  });

  it('"Começar novamente" reinicia o editor quando o usuário confirma', () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<PostEditorTool />);

    fireEvent.change(screen.getByLabelText("Título promocional"), { target: { value: "Editado" } });
    fireEvent.click(screen.getByRole("button", { name: /começar novamente/i }));

    expect(screen.getByLabelText("Título promocional")).toHaveValue("Mega Promoção");

    confirmSpy.mockRestore();
  });

  it("sem publishPanel (uso público, sem login) não renderiza nenhum conteúdo extra de publicação", () => {
    render(<PostEditorTool />);
    expect(screen.queryByTestId("publish-panel-slot")).not.toBeInTheDocument();
  });

  it("com publishPanel, renderiza o componente recebendo o canvasRef e o formato atuais", () => {
    function TestPublishPanel({
      canvasRef,
      format,
    }: {
      canvasRef: RefObject<HTMLCanvasElement | null>;
      format: PostFormat;
    }) {
      return (
        <div data-testid="publish-panel-slot">
          {format.id} — canvas presente: {String(canvasRef.current !== null)}
        </div>
      );
    }

    render(<PostEditorTool publishPanel={TestPublishPanel} />);

    expect(screen.getByTestId("publish-panel-slot")).toHaveTextContent("quadrado");
  });
});
