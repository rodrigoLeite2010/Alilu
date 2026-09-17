import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { RemoverQuebrasLinhaTool } from "@/components/tools/remover-quebras-linha/RemoverQuebrasLinhaTool";

function getResultTextarea() {
  return screen.getByPlaceholderText(/o texto sem quebras de linha aparece aqui/i) as HTMLTextAreaElement;
}

describe("RemoverQuebrasLinhaTool", () => {
  it("substitui quebras de linha por espaço por padrão", () => {
    render(<RemoverQuebrasLinhaTool />);
    fireEvent.change(screen.getByLabelText(/digite ou cole o texto/i), {
      target: { value: "linha 1\nlinha 2" },
    });
    expect(getResultTextarea().value).toBe("linha 1 linha 2");
  });

  it("remove quebras de linha sem substituto quando selecionado", () => {
    render(<RemoverQuebrasLinhaTool />);
    fireEvent.change(screen.getByLabelText(/digite ou cole o texto/i), {
      target: { value: "linha 1\nlinha 2" },
    });
    fireEvent.change(screen.getByLabelText(/substituir quebra de linha por/i), {
      target: { value: "remove" },
    });
    expect(getResultTextarea().value).toBe("linha 1linha 2");
  });

  it("mostra campo de texto personalizado quando selecionado", () => {
    render(<RemoverQuebrasLinhaTool />);
    fireEvent.change(screen.getByLabelText(/substituir quebra de linha por/i), {
      target: { value: "custom" },
    });
    expect(screen.getByLabelText(/texto personalizado/i)).toBeInTheDocument();
  });
});
