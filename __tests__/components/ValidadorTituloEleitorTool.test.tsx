import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { ValidadorTituloEleitorTool } from "@/components/tools/validador-titulo-eleitor/ValidadorTituloEleitorTool";
import { generateVoterId } from "@/lib/calculators/voter-id-generator";

describe("ValidadorTituloEleitorTool", () => {
  it("mostra 'Título de Eleitor válido' e identifica a UF pelo número", () => {
    render(<ValidadorTituloEleitorTool />);
    const voterId = generateVoterId("01", false); // 01 = São Paulo
    fireEvent.change(screen.getByLabelText("Número do Título de Eleitor"), {
      target: { value: voterId },
    });
    fireEvent.click(screen.getByRole("button", { name: /validar título de eleitor/i }));

    const status = screen.getByRole("status");
    expect(within(status).getByText(/Título de Eleitor válido/i)).toBeInTheDocument();
    expect(within(status).getByText(/São Paulo/)).toBeInTheDocument();
  });

  it("mostra 'Título de Eleitor inválido' para dígitos verificadores incorretos", () => {
    render(<ValidadorTituloEleitorTool />);
    const voterId = generateVoterId("01", false);
    const corrupted = voterId.slice(0, 11) + String((Number(voterId[11]) + 1) % 10);
    fireEvent.change(screen.getByLabelText("Número do Título de Eleitor"), {
      target: { value: corrupted },
    });
    fireEvent.click(screen.getByRole("button", { name: /validar título de eleitor/i }));

    expect(within(screen.getByRole("status")).getByText(/Título de Eleitor inválido/i)).toBeInTheDocument();
  });

  it("aplica máscara agrupando os dígitos em blocos de 4", () => {
    render(<ValidadorTituloEleitorTool />);
    const input = screen.getByLabelText("Número do Título de Eleitor") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "123456789012" } });
    expect(input.value).toBe("1234 5678 9012");
  });

  it("não mostra resultado quando o campo está vazio", () => {
    render(<ValidadorTituloEleitorTool />);
    fireEvent.click(screen.getByRole("button", { name: /validar título de eleitor/i }));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
