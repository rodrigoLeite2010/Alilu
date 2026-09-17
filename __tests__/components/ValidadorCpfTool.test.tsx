import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { ValidadorCpfTool } from "@/components/tools/validador-cpf/ValidadorCpfTool";

describe("ValidadorCpfTool", () => {
  it("mostra 'CPF válido' para um CPF válido, mesmo sem máscara", () => {
    render(<ValidadorCpfTool />);
    fireEvent.change(screen.getByLabelText("CPF"), { target: { value: "11144477735" } });
    fireEvent.click(screen.getByRole("button", { name: /validar cpf/i }));

    expect(within(screen.getByRole("status")).getByText(/CPF válido/i)).toBeInTheDocument();
  });

  it("aceita CPF já mascarado e continua reconhecendo como válido", () => {
    render(<ValidadorCpfTool />);
    fireEvent.change(screen.getByLabelText("CPF"), { target: { value: "111.444.777-35" } });
    fireEvent.click(screen.getByRole("button", { name: /validar cpf/i }));

    expect(within(screen.getByRole("status")).getByText(/CPF válido/i)).toBeInTheDocument();
  });

  it("mostra 'CPF inválido' para dígito verificador incorreto", () => {
    render(<ValidadorCpfTool />);
    fireEvent.change(screen.getByLabelText("CPF"), { target: { value: "11144477734" } });
    fireEvent.click(screen.getByRole("button", { name: /validar cpf/i }));

    expect(within(screen.getByRole("status")).getByText(/CPF inválido/i)).toBeInTheDocument();
  });

  it("rejeita sequência de dígitos repetidos", () => {
    render(<ValidadorCpfTool />);
    fireEvent.change(screen.getByLabelText("CPF"), { target: { value: "11111111111" } });
    fireEvent.click(screen.getByRole("button", { name: /validar cpf/i }));

    expect(within(screen.getByRole("status")).getByText(/CPF inválido/i)).toBeInTheDocument();
  });

  it("ignora caracteres inválidos digitados no campo", () => {
    render(<ValidadorCpfTool />);
    const input = screen.getByLabelText("CPF") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "abc111.444.777-35xyz" } });
    expect(input.value).toBe("111.444.777-35");
  });

  it("não mostra resultado quando o campo está vazio", () => {
    render(<ValidadorCpfTool />);
    fireEvent.click(screen.getByRole("button", { name: /validar cpf/i }));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("envia o formulário ao pressionar Enter", () => {
    render(<ValidadorCpfTool />);
    const input = screen.getByLabelText("CPF");
    fireEvent.change(input, { target: { value: "11144477735" } });
    fireEvent.submit(input.closest("form")!);

    expect(within(screen.getByRole("status")).getByText(/CPF válido/i)).toBeInTheDocument();
  });

  it("o botão Limpar reseta o campo e o resultado", () => {
    render(<ValidadorCpfTool />);
    fireEvent.change(screen.getByLabelText("CPF"), { target: { value: "11144477735" } });
    fireEvent.click(screen.getByRole("button", { name: /validar cpf/i }));
    fireEvent.click(screen.getByRole("button", { name: /limpar/i }));

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect((screen.getByLabelText("CPF") as HTMLInputElement).value).toBe("");
  });
});
