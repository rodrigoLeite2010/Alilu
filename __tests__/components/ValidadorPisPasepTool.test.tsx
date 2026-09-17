import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { ValidadorPisPasepTool } from "@/components/tools/validador-pis-pasep/ValidadorPisPasepTool";
import { generatePisPasep } from "@/lib/calculators/pis-pasep-generator";

describe("ValidadorPisPasepTool", () => {
  it("mostra 'PIS/PASEP válido' para um número válido, com máscara aplicada automaticamente", () => {
    render(<ValidadorPisPasepTool />);
    const pis = generatePisPasep(false);
    const input = screen.getByLabelText("PIS/PASEP") as HTMLInputElement;
    fireEvent.change(input, { target: { value: pis } });
    expect(input.value).toMatch(/^\d{3}\.\d{5}\.\d{2}-\d$/);

    fireEvent.click(screen.getByRole("button", { name: /validar pis\/pasep/i }));
    expect(within(screen.getByRole("status")).getByText(/PIS\/PASEP válido/i)).toBeInTheDocument();
  });

  it("mostra 'PIS/PASEP inválido' para dígito verificador incorreto", () => {
    render(<ValidadorPisPasepTool />);
    const pis = generatePisPasep(false);
    const corrupted = pis.slice(0, 10) + String((Number(pis[10]) + 1) % 10);
    fireEvent.change(screen.getByLabelText("PIS/PASEP"), { target: { value: corrupted } });
    fireEvent.click(screen.getByRole("button", { name: /validar pis\/pasep/i }));

    expect(within(screen.getByRole("status")).getByText(/PIS\/PASEP inválido/i)).toBeInTheDocument();
  });

  it("não exibe pontuação prematuramente enquanto o usuário ainda está digitando", () => {
    render(<ValidadorPisPasepTool />);
    const input = screen.getByLabelText("PIS/PASEP") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "1" } });
    expect(input.value).toBe("1");
  });

  it("não mostra resultado quando o campo está vazio", () => {
    render(<ValidadorPisPasepTool />);
    fireEvent.click(screen.getByRole("button", { name: /validar pis\/pasep/i }));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
