import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { DividirStringTool } from "@/components/tools/dividir-string/DividirStringTool";

function mockClipboard() {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.assign(navigator, { clipboard: { writeText } });
  return writeText;
}

beforeEach(() => {
  mockClipboard();
});

describe("DividirStringTool", () => {
  it("divide por vírgula por padrão", () => {
    render(<DividirStringTool />);
    fireEvent.change(screen.getByLabelText(/digite ou cole o texto/i), {
      target: { value: "maçã, banana, uva" },
    });

    expect(screen.getByText(/3 itens encontrados/i)).toBeInTheDocument();
    expect(screen.getByText("maçã")).toBeInTheDocument();
    expect(screen.getByText("banana")).toBeInTheDocument();
    expect(screen.getByText("uva")).toBeInTheDocument();
  });

  it("mostra o campo de delimitador personalizado ao selecionar essa opção", () => {
    render(<DividirStringTool />);
    fireEvent.change(screen.getByLabelText(/dividir por/i), { target: { value: "custom" } });
    expect(screen.getByLabelText(/delimitador personalizado/i)).toBeInTheDocument();
  });

  it("mostra mensagem quando não há texto digitado", () => {
    render(<DividirStringTool />);
    expect(screen.getByText(/digite um texto acima para ver os itens divididos/i)).toBeInTheDocument();
  });

  it("permite copiar a lista de itens", async () => {
    const writeText = mockClipboard();
    render(<DividirStringTool />);
    fireEvent.change(screen.getByLabelText(/digite ou cole o texto/i), {
      target: { value: "a,b,c" },
    });
    fireEvent.click(screen.getByRole("button", { name: /copiar lista/i }));
    expect(writeText).toHaveBeenCalledWith("a\nb\nc");
  });
});
