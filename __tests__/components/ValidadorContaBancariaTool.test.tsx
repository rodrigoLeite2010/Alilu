import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { ValidadorContaBancariaTool } from "@/components/tools/validador-conta-bancaria/ValidadorContaBancariaTool";

describe("ValidadorContaBancariaTool", () => {
  it("mostra formato válido quando todos os campos estão corretamente preenchidos", () => {
    render(<ValidadorContaBancariaTool />);
    fireEvent.change(screen.getByLabelText("Agência"), { target: { value: "1234" } });
    fireEvent.change(screen.getByLabelText("Conta"), { target: { value: "1234567" } });
    fireEvent.change(screen.getByLabelText("Dígito"), { target: { value: "8" } });
    fireEvent.click(screen.getByRole("button", { name: /validar conta/i }));

    expect(within(screen.getByRole("status")).getByText(/formato de conta válido/i)).toBeInTheDocument();
  });

  it("mostra formato inválido quando um campo obrigatório está vazio", () => {
    render(<ValidadorContaBancariaTool />);
    fireEvent.change(screen.getByLabelText("Agência"), { target: { value: "1234" } });
    fireEvent.click(screen.getByRole("button", { name: /validar conta/i }));

    expect(within(screen.getByRole("status")).getByText(/formato de conta inválido/i)).toBeInTheDocument();
    expect(screen.getByText(/informe uma conta/i)).toBeInTheDocument();
  });

  it("ignora letras digitadas na agência e na conta", () => {
    render(<ValidadorContaBancariaTool />);
    const agency = screen.getByLabelText("Agência") as HTMLInputElement;
    fireEvent.change(agency, { target: { value: "ab12cd" } });
    expect(agency.value).toBe("12");
  });

  it("o botão Limpar reseta os campos e o resultado", () => {
    render(<ValidadorContaBancariaTool />);
    fireEvent.change(screen.getByLabelText("Agência"), { target: { value: "1234" } });
    fireEvent.change(screen.getByLabelText("Conta"), { target: { value: "1234567" } });
    fireEvent.change(screen.getByLabelText("Dígito"), { target: { value: "8" } });
    fireEvent.click(screen.getByRole("button", { name: /validar conta/i }));
    fireEvent.click(screen.getByRole("button", { name: /limpar/i }));

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect((screen.getByLabelText("Agência") as HTMLInputElement).value).toBe("");
  });
});
