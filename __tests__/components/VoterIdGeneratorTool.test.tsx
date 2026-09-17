import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { VoterIdGeneratorTool } from "@/components/tools/voter-id-generator/VoterIdGeneratorTool";
import { isValidVoterId } from "@/lib/calculators/voter-id-generator";

function mockClipboard() {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.assign(navigator, { clipboard: { writeText } });
  return writeText;
}

beforeEach(() => {
  mockClipboard();
});

describe("VoterIdGeneratorTool", () => {
  it("gera um único título válido ao clicar em 'Gerar Título de Eleitor'", () => {
    render(<VoterIdGeneratorTool />);
    fireEvent.click(screen.getByRole("button", { name: /gerar título de eleitor/i }));

    const highlight = screen.getByText(/^\d{4} \d{4} \d{4}$/);
    expect(highlight).toBeInTheDocument();
    expect(isValidVoterId(highlight.textContent ?? "")).toBe(true);
  });

  it("permite escolher um estado específico", () => {
    render(<VoterIdGeneratorTool />);
    fireEvent.change(screen.getByLabelText("Estado (UF)"), { target: { value: "03" } });
    fireEvent.click(screen.getByRole("button", { name: /gerar título de eleitor/i }));

    const highlight = screen.getByText(/^\d{4} \d{4} \d{4}$/);
    expect(highlight.textContent?.replace(/\s/g, "").slice(8, 10)).toBe("03");
  });

  it("mostra erro quando a quantidade é maior que o limite", () => {
    render(<VoterIdGeneratorTool />);
    fireEvent.change(screen.getByLabelText("Quantidade"), { target: { value: "999" } });
    fireEvent.click(screen.getByRole("button", { name: /gerar título de eleitor/i }));

    expect(screen.getByText(/quantidade não pode ser maior que/i)).toBeInTheDocument();
  });

  it("gera um lote e permite copiar todos", async () => {
    const writeText = mockClipboard();
    render(<VoterIdGeneratorTool />);
    fireEvent.change(screen.getByLabelText("Quantidade"), { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: /gerar título de eleitor/i }));

    const rows = screen.getAllByText(/^\d{4} \d{4} \d{4}$/);
    expect(rows).toHaveLength(5);

    fireEvent.click(screen.getByRole("button", { name: /copiar todos/i }));
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole("status")).toHaveTextContent("Todos os títulos copiados!");
  });
});
