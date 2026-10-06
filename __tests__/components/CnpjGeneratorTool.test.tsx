import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { CnpjGeneratorTool } from "@/components/tools/cnpj-generator/CnpjGeneratorTool";
import { isValidCNPJ } from "@/lib/validators/document";

/**
 * Gerador de CNPJ: GERAR + COPIAR em um clique. O ponto crítico é copiar o
 * valor recém-gerado (e não o anterior que ainda estaria no state), exatamente
 * no formato mostrado na tela.
 */

const FORMATTED = /^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/;
const clean = (value: string) => value.replace(/\D/g, "");

function mockClipboard(impl: () => Promise<void> = () => Promise.resolve()) {
  const writeText = vi.fn<(text: string) => Promise<void>>(impl);
  Object.assign(navigator, { clipboard: { writeText } });
  return writeText;
}

const generateButton = () => screen.getByRole("button", { name: /gerar e copiar cnpj/i });
const shown = () => screen.getByText(FORMATTED).textContent ?? "";
const status = () => screen.getByRole("status");

beforeEach(() => {
  mockClipboard();
});
afterEach(() => {
  Reflect.deleteProperty(navigator, "clipboard");
});

describe("CnpjGeneratorTool — gerar + copiar", () => {
  it("um clique gera um CNPJ válido e copia exatamente o valor mostrado", async () => {
    const writeText = mockClipboard();
    render(<CnpjGeneratorTool />);
    fireEvent.click(generateButton());

    const value = shown();
    expect(isValidCNPJ(clean(value))).toBe(true);
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText).toHaveBeenCalledWith(value);
    await waitFor(() => expect(status()).toHaveTextContent("Gerado e copiado!"));
    expect(screen.getByRole("button", { name: "Copiado" })).toHaveAttribute("type", "submit");
  });

  it("clicar de novo copia o valor NOVO (nunca o anterior)", async () => {
    const writeText = mockClipboard();
    render(<CnpjGeneratorTool />);

    for (let round = 1; round <= 5; round += 1) {
      fireEvent.click(round === 1 ? generateButton() : screen.getByRole("button", { name: /gerar e copiar novamente/i }));
      await waitFor(() => expect(writeText).toHaveBeenCalledTimes(round));
      expect(writeText).toHaveBeenLastCalledWith(shown());
    }
    const copied = writeText.mock.calls.map((call) => call[0]);
    expect(new Set(copied).size).toBeGreaterThan(1);
  });

  it("modo com pontuação copia com pontuação; somente números copia sem pontuação", async () => {
    const writeText = mockClipboard();
    render(<CnpjGeneratorTool />);

    fireEvent.click(generateButton());
    expect(writeText).toHaveBeenLastCalledWith(expect.stringMatching(FORMATTED));

    fireEvent.change(screen.getByLabelText("Formato"), { target: { value: "digits" } });
    fireEvent.click(generateButton());
    const digits = screen.getByText(/^\d{14}$/).textContent ?? "";
    expect(isValidCNPJ(digits)).toBe(true);
    expect(writeText).toHaveBeenLastCalledWith(digits);
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(2));
  });

  it("o botão 'Copiar CNPJ' copia de novo o mesmo valor, sem gerar outro", async () => {
    const writeText = mockClipboard();
    render(<CnpjGeneratorTool />);
    fireEvent.click(generateButton());
    const value = shown();

    fireEvent.click(screen.getByRole("button", { name: "Copiar CNPJ" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(2));
    expect(writeText).toHaveBeenLastCalledWith(value);
    expect(shown()).toBe(value);
    await waitFor(() => expect(status()).toHaveTextContent("CNPJ copiado!"));
  });

  it("lote: gera N, mostra N linhas e copia todos, um por linha", async () => {
    const writeText = mockClipboard();
    render(<CnpjGeneratorTool />);
    fireEvent.change(screen.getByLabelText("Quantidade"), { target: { value: "5" } });
    fireEvent.click(generateButton());

    const rows = screen.getAllByText(FORMATTED).map((el) => el.textContent);
    expect(rows).toHaveLength(5);
    expect(writeText).toHaveBeenCalledWith(rows.join("\n"));
    await waitFor(() => expect(status()).toHaveTextContent("5 CNPJs gerados e copiados!"));

    fireEvent.click(screen.getByRole("button", { name: /copiar todos/i }));
    await waitFor(() => expect(status()).toHaveTextContent("Todos os CNPJs copiados!"));
  });

  it("se a cópia falhar, o resultado é mantido e o usuário é avisado", async () => {
    const writeText = mockClipboard(() => Promise.reject(new Error("negado")));
    render(<CnpjGeneratorTool />);
    fireEvent.click(generateButton());

    const value = shown();
    expect(isValidCNPJ(clean(value))).toBe(true);
    await waitFor(() => expect(status()).toHaveTextContent("Gerado, mas não foi possível copiar automaticamente."));
    expect(screen.getByRole("button", { name: "Copiar CNPJ" })).toBeInTheDocument();
    expect(shown()).toBe(value);
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(generateButton()).toHaveTextContent("Gerar e copiar CNPJ");
  });

  it("entrada inválida não gera nem copia", () => {
    const writeText = mockClipboard();
    render(<CnpjGeneratorTool />);
    fireEvent.change(screen.getByLabelText("Quantidade"), { target: { value: "999" } });
    fireEvent.click(generateButton());

    expect(screen.getByText(/quantidade não pode ser maior que/i)).toBeInTheDocument();
    expect(writeText).not.toHaveBeenCalled();
    expect(screen.queryByText(FORMATTED)).not.toBeInTheDocument();
  });

  it("o feedback é uma região aria-live educada, presente desde o início", () => {
    render(<CnpjGeneratorTool />);
    expect(status()).toHaveAttribute("aria-live", "polite");
  });

  it("o botão principal ocupa a largura toda no celular", () => {
    render(<CnpjGeneratorTool />);
    expect(generateButton().className).toMatch(/\bw-full\b/);
    expect(generateButton().className).toMatch(/\bsm:w-auto\b/);
  });

  it("mantém o aviso de uso para testes", () => {
    render(<CnpjGeneratorTool />);
    expect(screen.getByText(/CNPJ gerado apenas para testes/i)).toBeInTheDocument();
  });

  it("CNPJ alfanumérico: copia exatamente o valor alfanumérico mostrado", async () => {
    const writeText = mockClipboard();
    render(<CnpjGeneratorTool />);
    fireEvent.change(screen.getByLabelText("Tipo de CNPJ"), { target: { value: "alphanumeric" } });
    fireEvent.click(generateButton());

    const shownValue = screen.getByText(/^[0-9A-Z]{2}\.[0-9A-Z]{3}\.[0-9A-Z]{3}\/[0-9A-Z]{4}-\d{2}$/).textContent ?? "";
    expect(writeText).toHaveBeenCalledWith(shownValue);
    await waitFor(() => expect(status()).toHaveTextContent("Gerado e copiado!"));
  });
});
