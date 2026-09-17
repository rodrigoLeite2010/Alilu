import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { NumberDrawTool } from "@/components/tools/number-draw/NumberDrawTool";

function mockClipboard() {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.assign(navigator, { clipboard: { writeText } });
  return writeText;
}

beforeEach(() => {
  mockClipboard();
});

describe("NumberDrawTool", () => {
  it("sorteia a quantidade pedida de números sem repetição", () => {
    render(<NumberDrawTool />);
    fireEvent.change(screen.getByLabelText("Número mínimo"), { target: { value: "1" } });
    fireEvent.change(screen.getByLabelText("Número máximo"), { target: { value: "60" } });
    fireEvent.change(screen.getByLabelText("Quantidade a sortear"), { target: { value: "6" } });
    fireEvent.click(screen.getByRole("button", { name: /sortear números/i }));

    expect(screen.getByText("Resultado do sorteio")).toBeInTheDocument();
  });

  it("mostra erro quando a quantidade é maior que o intervalo sem repetição", () => {
    render(<NumberDrawTool />);
    fireEvent.change(screen.getByLabelText("Número mínimo"), { target: { value: "1" } });
    fireEvent.change(screen.getByLabelText("Número máximo"), { target: { value: "3" } });
    fireEvent.change(screen.getByLabelText("Quantidade a sortear"), { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: /sortear números/i }));

    expect(
      screen.getByText(/sem repetição, a quantidade não pode ser maior/i)
    ).toBeInTheDocument();
  });

  it("copia o resultado do sorteio e mostra feedback acessível", async () => {
    const writeText = mockClipboard();
    render(<NumberDrawTool />);
    fireEvent.click(screen.getByRole("button", { name: /sortear números/i }));
    fireEvent.click(screen.getByRole("button", { name: /copiar resultado/i }));

    expect(writeText).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole("status")).toHaveTextContent("Resultado copiado!");
  });
});
