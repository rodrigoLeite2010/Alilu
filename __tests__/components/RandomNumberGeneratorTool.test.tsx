import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { RandomNumberGeneratorTool } from "@/components/tools/random-number-generator/RandomNumberGeneratorTool";

function mockClipboard() {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.assign(navigator, { clipboard: { writeText } });
  return writeText;
}

beforeEach(() => {
  mockClipboard();
});

describe("RandomNumberGeneratorTool", () => {
  it("gera a quantidade pedida de números dentro do intervalo", () => {
    render(<RandomNumberGeneratorTool />);
    fireEvent.change(screen.getByLabelText("Número mínimo"), { target: { value: "1" } });
    fireEvent.change(screen.getByLabelText("Número máximo"), { target: { value: "10" } });
    fireEvent.change(screen.getByLabelText("Quantidade"), { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: /gerar números/i }));

    expect(screen.getByText("Números gerados")).toBeInTheDocument();
  });

  it("mostra erro quando o máximo é menor que o mínimo", () => {
    render(<RandomNumberGeneratorTool />);
    fireEvent.change(screen.getByLabelText("Número mínimo"), { target: { value: "10" } });
    fireEvent.change(screen.getByLabelText("Número máximo"), { target: { value: "1" } });
    fireEvent.click(screen.getByRole("button", { name: /gerar números/i }));

    expect(screen.getByText(/máximo deve ser maior ou igual ao mínimo/i)).toBeInTheDocument();
  });

  it("copia o resultado e mostra feedback acessível", async () => {
    const writeText = mockClipboard();
    render(<RandomNumberGeneratorTool />);
    fireEvent.click(screen.getByRole("button", { name: /gerar números/i }));
    fireEvent.click(screen.getByRole("button", { name: /copiar números/i }));

    expect(writeText).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole("status")).toHaveTextContent("Números copiados!");
  });
});
