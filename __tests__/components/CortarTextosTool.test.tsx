import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { CortarTextosTool } from "@/components/tools/cortar-textos/CortarTextosTool";

function getResultTextarea() {
  return screen.getByPlaceholderText(/o texto cortado aparece aqui/i) as HTMLTextAreaElement;
}

describe("CortarTextosTool", () => {
  it("não corta um texto menor que o limite padrão", () => {
    render(<CortarTextosTool />);
    fireEvent.change(screen.getByLabelText(/digite ou cole o texto original/i), {
      target: { value: "texto curto" },
    });
    expect(getResultTextarea().value).toBe("texto curto");
  });

  it("corta o texto no limite de caracteres definido", () => {
    render(<CortarTextosTool />);
    fireEvent.change(screen.getByLabelText(/digite ou cole o texto original/i), {
      target: { value: "abcdefghijklmnopqrstuvwxyz" },
    });
    fireEvent.change(screen.getByLabelText(/limite \(caracteres\)/i), { target: { value: "5" } });

    expect(getResultTextarea().value).toBe("abcde…");
  });

  it("corta por número de palavras quando essa unidade é selecionada", () => {
    render(<CortarTextosTool />);
    fireEvent.change(screen.getByLabelText(/digite ou cole o texto original/i), {
      target: { value: "uma frase razoavelmente longa de teste" },
    });
    fireEvent.change(screen.getByLabelText(/limitar por/i), { target: { value: "words" } });
    fireEvent.change(screen.getByLabelText(/limite \(palavras\)/i), { target: { value: "3" } });

    expect(getResultTextarea().value).toBe("uma frase razoavelmente…");
  });
});
