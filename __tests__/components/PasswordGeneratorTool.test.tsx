import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { PasswordGeneratorTool } from "@/components/tools/password-generator/PasswordGeneratorTool";

function mockClipboard() {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.assign(navigator, { clipboard: { writeText } });
  return writeText;
}

beforeEach(() => {
  mockClipboard();
});

describe("PasswordGeneratorTool", () => {
  it("gera uma senha com o tamanho pedido", () => {
    render(<PasswordGeneratorTool />);
    fireEvent.change(screen.getByLabelText("Tamanho da senha"), { target: { value: "20" } });
    fireEvent.click(screen.getByRole("button", { name: /gerar senha/i }));

    const highlight = screen.getByText((_, el) => el?.tagName === "SPAN" && el.className.includes("font-mono"));
    expect(highlight.textContent).toHaveLength(20);
  });

  it("mostra erro quando nenhum tipo de caractere é selecionado", () => {
    render(<PasswordGeneratorTool />);
    fireEvent.click(screen.getByLabelText(/letras maiúsculas/i));
    fireEvent.click(screen.getByLabelText(/letras minúsculas/i));
    fireEvent.click(screen.getByLabelText(/números \(0-9\)/i));
    fireEvent.click(screen.getByLabelText(/símbolos/i));
    fireEvent.click(screen.getByRole("button", { name: /gerar senha/i }));

    expect(screen.getByText(/selecione ao menos um tipo de caractere/i)).toBeInTheDocument();
  });

  it("mostra a força estimada da senha", () => {
    render(<PasswordGeneratorTool />);
    fireEvent.click(screen.getByRole("button", { name: /gerar senha/i }));

    expect(screen.getByText("Força estimada")).toBeInTheDocument();
  });

  it("copia a senha gerada e mostra feedback acessível", async () => {
    const writeText = mockClipboard();
    render(<PasswordGeneratorTool />);
    fireEvent.click(screen.getByRole("button", { name: /gerar senha/i }));
    fireEvent.click(screen.getByRole("button", { name: /copiar senha/i }));

    expect(writeText).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole("status")).toHaveTextContent("Senha copiada!");
  });
});
