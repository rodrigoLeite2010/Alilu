import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { ValidadorRenavamTool } from "@/components/tools/validador-renavam/ValidadorRenavamTool";
import { generateRenavam } from "@/lib/calculators/renavam-generator";

describe("ValidadorRenavamTool", () => {
  it("mostra 'RENAVAM válido' para um número válido", () => {
    render(<ValidadorRenavamTool />);
    const renavam = generateRenavam(false);
    fireEvent.change(screen.getByLabelText("RENAVAM"), { target: { value: renavam } });
    fireEvent.click(screen.getByRole("button", { name: /validar renavam/i }));

    expect(within(screen.getByRole("status")).getByText(/RENAVAM válido/i)).toBeInTheDocument();
  });

  it("mostra 'RENAVAM inválido' para dígito verificador incorreto", () => {
    render(<ValidadorRenavamTool />);
    const renavam = generateRenavam(false);
    const corrupted = renavam.slice(0, 10) + String((Number(renavam[10]) + 1) % 10);
    fireEvent.change(screen.getByLabelText("RENAVAM"), { target: { value: corrupted } });
    fireEvent.click(screen.getByRole("button", { name: /validar renavam/i }));

    expect(within(screen.getByRole("status")).getByText(/RENAVAM inválido/i)).toBeInTheDocument();
  });

  it("mostra mensagem de comprimento incorreto para poucos dígitos", () => {
    render(<ValidadorRenavamTool />);
    fireEvent.change(screen.getByLabelText("RENAVAM"), { target: { value: "123" } });
    fireEvent.click(screen.getByRole("button", { name: /validar renavam/i }));

    expect(within(screen.getByRole("status")).getByText(/RENAVAM inválido/i)).toBeInTheDocument();
    expect(screen.getByText(/confira se o número tem 11 dígitos/i)).toBeInTheDocument();
  });

  it("não mostra resultado quando o campo está vazio", () => {
    render(<ValidadorRenavamTool />);
    fireEvent.click(screen.getByRole("button", { name: /validar renavam/i }));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
