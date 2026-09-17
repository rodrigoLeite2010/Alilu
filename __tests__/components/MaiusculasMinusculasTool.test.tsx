import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MaiusculasMinusculasTool } from "@/components/tools/maiusculas-minusculas/MaiusculasMinusculasTool";

function mockClipboard() {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.assign(navigator, { clipboard: { writeText } });
  return writeText;
}

beforeEach(() => {
  mockClipboard();
});

describe("MaiusculasMinusculasTool", () => {
  it("mostra uma mensagem quando nenhum texto foi digitado", () => {
    render(<MaiusculasMinusculasTool />);
    expect(screen.getByText(/digite um texto acima para ver as variações/i)).toBeInTheDocument();
  });

  it("mostra todas as variações ao digitar um texto", () => {
    render(<MaiusculasMinusculasTool />);
    fireEvent.change(screen.getByLabelText(/digite o texto/i), {
      target: { value: "são josé. maria costa" },
    });

    // "são josé. maria costa" (minúsculo) é o próprio texto digitado, então
    // também aparece dentro da <textarea> de entrada — por isso a variante
    // "tudo minúsculo" é conferida restringindo a busca a um parágrafo (<p>).
    expect(screen.getByText("SÃO JOSÉ. MARIA COSTA")).toBeInTheDocument();
    expect(
      screen.getByText((content, element) => element?.tagName === "P" && content === "são josé. maria costa")
    ).toBeInTheDocument();
    expect(screen.getByText("São josé. maria costa")).toBeInTheDocument();
    expect(screen.getByText("São josé. Maria costa")).toBeInTheDocument();
    expect(screen.getByText("São José. Maria Costa")).toBeInTheDocument();
  });

  it("permite copiar uma das variações", async () => {
    const writeText = mockClipboard();
    render(<MaiusculasMinusculasTool />);
    fireEvent.change(screen.getByLabelText(/digite o texto/i), { target: { value: "teste" } });

    fireEvent.click(screen.getAllByRole("button", { name: /copiar/i })[0]);
    expect(writeText).toHaveBeenCalledTimes(1);
  });
});
