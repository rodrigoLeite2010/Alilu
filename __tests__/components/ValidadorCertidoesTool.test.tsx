import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { ValidadorCertidoesTool } from "@/components/tools/validador-certidoes/ValidadorCertidoesTool";

describe("ValidadorCertidoesTool", () => {
  it("mostra formato válido para 32 dígitos", () => {
    render(<ValidadorCertidoesTool />);
    fireEvent.change(screen.getByLabelText("Número de matrícula"), {
      target: { value: "1".repeat(32) },
    });
    fireEvent.click(screen.getByRole("button", { name: /validar matrícula/i }));

    expect(within(screen.getByRole("status")).getByText(/formato de matrícula válido/i)).toBeInTheDocument();
  });

  it("mostra formato inválido para menos de 32 dígitos", () => {
    render(<ValidadorCertidoesTool />);
    fireEvent.change(screen.getByLabelText("Número de matrícula"), {
      target: { value: "12345" },
    });
    fireEvent.click(screen.getByRole("button", { name: /validar matrícula/i }));

    expect(within(screen.getByRole("status")).getByText(/formato de matrícula inválido/i)).toBeInTheDocument();
  });

  it("aceita separadores digitados e ignora letras", () => {
    render(<ValidadorCertidoesTool />);
    const input = screen.getByLabelText("Número de matrícula") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "abc" + "1".repeat(32) } });
    expect(input.value.replace(/-/g, "")).toBe("1".repeat(32));
  });

  it("permite escolher o tipo de certidão", () => {
    render(<ValidadorCertidoesTool />);
    fireEvent.change(screen.getByLabelText("Tipo de certidão"), { target: { value: "casamento" } });
    expect((screen.getByLabelText("Tipo de certidão") as HTMLSelectElement).value).toBe("casamento");
  });

  it("não mostra resultado quando o campo está vazio", () => {
    render(<ValidadorCertidoesTool />);
    fireEvent.click(screen.getByRole("button", { name: /validar matrícula/i }));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
