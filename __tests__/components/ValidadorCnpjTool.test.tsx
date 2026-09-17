import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { ValidadorCnpjTool } from "@/components/tools/validador-cnpj/ValidadorCnpjTool";

describe("ValidadorCnpjTool", () => {
  it("mostra 'CNPJ válido' para um CNPJ válido, mesmo sem máscara", () => {
    render(<ValidadorCnpjTool />);
    fireEvent.change(screen.getByLabelText("CNPJ"), { target: { value: "11222333000181" } });
    fireEvent.click(screen.getByRole("button", { name: /validar cnpj/i }));

    expect(within(screen.getByRole("status")).getByText(/CNPJ válido/i)).toBeInTheDocument();
  });

  it("aceita CNPJ já mascarado", () => {
    render(<ValidadorCnpjTool />);
    fireEvent.change(screen.getByLabelText("CNPJ"), { target: { value: "11.222.333/0001-81" } });
    fireEvent.click(screen.getByRole("button", { name: /validar cnpj/i }));

    expect(within(screen.getByRole("status")).getByText(/CNPJ válido/i)).toBeInTheDocument();
  });

  it("mostra 'CNPJ inválido' para dígito verificador incorreto", () => {
    render(<ValidadorCnpjTool />);
    fireEvent.change(screen.getByLabelText("CNPJ"), { target: { value: "11222333000182" } });
    fireEvent.click(screen.getByRole("button", { name: /validar cnpj/i }));

    expect(within(screen.getByRole("status")).getByText(/CNPJ inválido/i)).toBeInTheDocument();
  });

  it("rejeita sequência de dígitos repetidos", () => {
    render(<ValidadorCnpjTool />);
    fireEvent.change(screen.getByLabelText("CNPJ"), { target: { value: "11111111111111" } });
    fireEvent.click(screen.getByRole("button", { name: /validar cnpj/i }));

    expect(within(screen.getByRole("status")).getByText(/CNPJ inválido/i)).toBeInTheDocument();
  });

  it("não mostra resultado quando o campo está vazio", () => {
    render(<ValidadorCnpjTool />);
    fireEvent.click(screen.getByRole("button", { name: /validar cnpj/i }));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("o botão Limpar reseta o campo e o resultado", () => {
    render(<ValidadorCnpjTool />);
    fireEvent.change(screen.getByLabelText("CNPJ"), { target: { value: "11222333000181" } });
    fireEvent.click(screen.getByRole("button", { name: /validar cnpj/i }));
    fireEvent.click(screen.getByRole("button", { name: /limpar/i }));

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect((screen.getByLabelText("CNPJ") as HTMLInputElement).value).toBe("");
  });
});
