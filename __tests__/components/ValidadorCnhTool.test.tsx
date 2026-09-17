import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { ValidadorCnhTool } from "@/components/tools/validador-cnh/ValidadorCnhTool";
import { generateCnh } from "@/lib/calculators/cnh-generator";

describe("ValidadorCnhTool", () => {
  it("mostra 'CNH válida' para uma CNH válida", () => {
    render(<ValidadorCnhTool />);
    const cnh = generateCnh(false);
    fireEvent.change(screen.getByLabelText("Número da CNH"), { target: { value: cnh } });
    fireEvent.click(screen.getByRole("button", { name: /validar cnh/i }));

    expect(within(screen.getByRole("status")).getByText(/CNH válida/i)).toBeInTheDocument();
  });

  it("mostra 'CNH inválida' para dígitos verificadores incorretos", () => {
    render(<ValidadorCnhTool />);
    const cnh = generateCnh(false);
    const corrupted = cnh.slice(0, 10) + String((Number(cnh[10]) + 1) % 10);
    fireEvent.change(screen.getByLabelText("Número da CNH"), { target: { value: corrupted } });
    fireEvent.click(screen.getByRole("button", { name: /validar cnh/i }));

    expect(within(screen.getByRole("status")).getByText(/CNH inválida/i)).toBeInTheDocument();
  });

  it("mostra o aviso de que não consulta o DETRAN", () => {
    render(<ValidadorCnhTool />);
    expect(screen.getByText(/não consulta a situação da CNH junto ao DETRAN/i)).toBeInTheDocument();
  });

  it("não mostra resultado quando o campo está vazio", () => {
    render(<ValidadorCnhTool />);
    fireEvent.click(screen.getByRole("button", { name: /validar cnh/i }));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("o botão Limpar reseta o campo e o resultado", () => {
    render(<ValidadorCnhTool />);
    fireEvent.change(screen.getByLabelText("Número da CNH"), { target: { value: generateCnh(false) } });
    fireEvent.click(screen.getByRole("button", { name: /validar cnh/i }));
    fireEvent.click(screen.getByRole("button", { name: /limpar/i }));

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect((screen.getByLabelText("Número da CNH") as HTMLInputElement).value).toBe("");
  });
});
