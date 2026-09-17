import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { ValidadorRgTool } from "@/components/tools/validador-rg/ValidadorRgTool";
import { generateRg } from "@/lib/calculators/rg-generator";

describe("ValidadorRgTool", () => {
  it("mostra 'RG válido' para São Paulo (UF padrão) com número válido", () => {
    render(<ValidadorRgTool />);
    const rg = generateRg(false);
    fireEvent.change(screen.getByLabelText("Número do RG"), { target: { value: rg } });
    fireEvent.click(screen.getByRole("button", { name: /validar rg/i }));

    expect(within(screen.getByRole("status")).getByText(/RG válido/i)).toBeInTheDocument();
  });

  it("mostra 'RG inválido' para São Paulo com dígito verificador incorreto", () => {
    render(<ValidadorRgTool />);
    const rg = generateRg(false);
    const lastChar = rg.slice(8);
    const corruptedLastDigit = lastChar === "X" ? "0" : String((Number(lastChar) + 1) % 10);
    const corrupted = rg.slice(0, 8) + corruptedLastDigit;
    fireEvent.change(screen.getByLabelText("Número do RG"), { target: { value: corrupted } });
    fireEvent.click(screen.getByRole("button", { name: /validar rg/i }));

    expect(within(screen.getByRole("status")).getByText(/RG inválido/i)).toBeInTheDocument();
  });

  it("para outra UF, valida apenas o formato geral", () => {
    render(<ValidadorRgTool />);
    fireEvent.change(screen.getByLabelText("Estado (UF) de emissão"), { target: { value: "RJ" } });
    fireEvent.change(screen.getByLabelText("Número do RG"), { target: { value: "12.345.678-9" } });
    fireEvent.click(screen.getByRole("button", { name: /validar rg/i }));

    expect(within(screen.getByRole("status")).getByText(/RG válido/i)).toBeInTheDocument();
    expect(screen.getByText(/só é possível conferir o formato geral/i)).toBeInTheDocument();
  });

  it("mostra o aviso de que não existe algoritmo nacional único de RG", () => {
    render(<ValidadorRgTool />);
    expect(screen.getByText(/não existe um algoritmo nacional único de rg/i)).toBeInTheDocument();
  });

  it("não mostra resultado quando o campo está vazio", () => {
    render(<ValidadorRgTool />);
    fireEvent.click(screen.getByRole("button", { name: /validar rg/i }));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
