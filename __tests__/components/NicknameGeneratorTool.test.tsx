import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { NicknameGeneratorTool } from "@/components/tools/nickname-generator/NicknameGeneratorTool";

function mockClipboard() {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.assign(navigator, { clipboard: { writeText } });
  return writeText;
}

beforeEach(() => {
  mockClipboard();
});

describe("NicknameGeneratorTool", () => {
  it("gera um único nick ao clicar em 'Gerar nick'", () => {
    render(<NicknameGeneratorTool />);
    fireEvent.click(screen.getByRole("button", { name: /gerar nick/i }));

    expect(screen.getByText("Nick gerado")).toBeInTheDocument();
  });

  it("mostra erro quando a quantidade é maior que o limite", () => {
    render(<NicknameGeneratorTool />);
    fireEvent.change(screen.getByLabelText("Quantidade"), { target: { value: "999" } });
    fireEvent.click(screen.getByRole("button", { name: /gerar nick/i }));

    expect(screen.getByText(/quantidade não pode ser maior que/i)).toBeInTheDocument();
  });

  it("gera um lote e permite copiar todos", async () => {
    const writeText = mockClipboard();
    render(<NicknameGeneratorTool />);
    fireEvent.change(screen.getByLabelText("Quantidade"), { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: /gerar nick/i }));

    expect(screen.getAllByRole("listitem")).toHaveLength(5);

    fireEvent.click(screen.getByRole("button", { name: /copiar todos/i }));
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole("status")).toHaveTextContent("Todos os nicks copiados!");
  });
});
