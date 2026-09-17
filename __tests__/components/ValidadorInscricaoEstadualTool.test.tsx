import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { ValidadorInscricaoEstadualTool } from "@/components/tools/validador-inscricao-estadual/ValidadorInscricaoEstadualTool";

describe("ValidadorInscricaoEstadualTool", () => {
  it("mostra formato válido para uma quantidade de dígitos compatível", () => {
    render(<ValidadorInscricaoEstadualTool />);
    fireEvent.change(screen.getByLabelText("Inscrição Estadual"), {
      target: { value: "123456789" },
    });
    fireEvent.click(screen.getByRole("button", { name: /validar inscrição estadual/i }));

    expect(
      within(screen.getByRole("status")).getByText(/formato de inscrição estadual válido/i)
    ).toBeInTheDocument();
  });

  it("mostra formato inválido para poucos dígitos", () => {
    render(<ValidadorInscricaoEstadualTool />);
    fireEvent.change(screen.getByLabelText("Inscrição Estadual"), { target: { value: "123" } });
    fireEvent.click(screen.getByRole("button", { name: /validar inscrição estadual/i }));

    expect(
      within(screen.getByRole("status")).getByText(/formato de inscrição estadual inválido/i)
    ).toBeInTheDocument();
  });

  it("permite escolher a UF", () => {
    render(<ValidadorInscricaoEstadualTool />);
    fireEvent.change(screen.getByLabelText("Estado (UF)"), { target: { value: "SP" } });
    expect((screen.getByLabelText("Estado (UF)") as HTMLSelectElement).value).toBe("SP");
  });

  it("mostra o aviso de que o dígito verificador não é conferido", () => {
    render(<ValidadorInscricaoEstadualTool />);
    expect(
      screen.getByText(/não existe um algoritmo de dígito verificador de inscrição estadual único/i)
    ).toBeInTheDocument();
  });

  it("não mostra resultado quando o campo está vazio", () => {
    render(<ValidadorInscricaoEstadualTool />);
    fireEvent.click(screen.getByRole("button", { name: /validar inscrição estadual/i }));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
