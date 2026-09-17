import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { OrdemAlfabeticaTool } from "@/components/tools/ordem-alfabetica/OrdemAlfabeticaTool";

function getResultTextarea() {
  return screen.getByPlaceholderText(/o resultado ordenado aparece aqui/i) as HTMLTextAreaElement;
}

describe("OrdemAlfabeticaTool", () => {
  it("ordena as linhas em ordem alfabética crescente por padrão", () => {
    render(<OrdemAlfabeticaTool />);
    fireEvent.change(screen.getByLabelText(/digite ou cole uma linha por item/i), {
      target: { value: "banana\nabacaxi\nmaçã" },
    });
    expect(getResultTextarea().value).toBe("abacaxi\nbanana\nmaçã");
  });

  it("inverte para Z-A ao selecionar essa opção", () => {
    render(<OrdemAlfabeticaTool />);
    fireEvent.change(screen.getByLabelText(/digite ou cole uma linha por item/i), {
      target: { value: "banana\nabacaxi" },
    });
    fireEvent.click(screen.getByLabelText("Z → A"));
    expect(getResultTextarea().value).toBe("banana\nabacaxi");
  });

  it("remove duplicados quando a opção é ativada", () => {
    render(<OrdemAlfabeticaTool />);
    fireEvent.change(screen.getByLabelText(/digite ou cole uma linha por item/i), {
      target: { value: "banana\nBanana\nabacaxi" },
    });
    fireEvent.click(screen.getByLabelText(/remover duplicados/i));
    expect(getResultTextarea().value).toBe("abacaxi\nbanana");
  });
});
