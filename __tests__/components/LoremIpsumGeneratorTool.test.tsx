import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { LoremIpsumGeneratorTool } from "@/components/tools/lorem-ipsum-generator/LoremIpsumGeneratorTool";

function mockClipboard() {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.assign(navigator, { clipboard: { writeText } });
  return writeText;
}

beforeEach(() => {
  mockClipboard();
});

describe("LoremIpsumGeneratorTool", () => {
  it("gera texto ao clicar em 'Gerar texto'", () => {
    render(<LoremIpsumGeneratorTool />);
    fireEvent.click(screen.getByRole("button", { name: /gerar texto/i }));

    expect(screen.getByRole("button", { name: /copiar texto/i })).toBeInTheDocument();
  });

  it("mostra erro quando a quantidade é maior que o limite", () => {
    render(<LoremIpsumGeneratorTool />);
    fireEvent.change(screen.getByLabelText("Quantidade"), { target: { value: "999" } });
    fireEvent.click(screen.getByRole("button", { name: /gerar texto/i }));

    expect(screen.getByText(/quantidade não pode ser maior que/i)).toBeInTheDocument();
  });

  it("permite copiar o texto gerado", async () => {
    const writeText = mockClipboard();
    render(<LoremIpsumGeneratorTool />);
    fireEvent.click(screen.getByRole("button", { name: /gerar texto/i }));
    fireEvent.click(screen.getByRole("button", { name: /copiar texto/i }));

    expect(writeText).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole("status")).toHaveTextContent("Texto copiado!");
  });

  it("gera por palavras quando a unidade escolhida é 'Palavras'", () => {
    render(<LoremIpsumGeneratorTool />);
    fireEvent.change(screen.getByLabelText("Unidade"), { target: { value: "palavras" } });
    fireEvent.change(screen.getByLabelText("Quantidade"), { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: /gerar texto/i }));

    expect(screen.getByRole("button", { name: /copiar texto/i })).toBeInTheDocument();
  });
});
