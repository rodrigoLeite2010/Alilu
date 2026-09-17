import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { NumeroPorExtensoTool } from "@/components/tools/numero-por-extenso/NumeroPorExtensoTool";

describe("NumeroPorExtensoTool", () => {
  it("converte um número simples por extenso", () => {
    render(<NumeroPorExtensoTool />);
    fireEvent.change(screen.getByLabelText(/^número$/i), { target: { value: "123" } });
    expect(screen.getByText("cento e vinte e três")).toBeInTheDocument();
  });

  it("converte um valor em reais no modo monetário", () => {
    render(<NumeroPorExtensoTool />);
    fireEvent.click(screen.getByLabelText(/valor em reais/i));
    fireEvent.change(screen.getByLabelText(/valor em reais$/i), { target: { value: "123,45" } });

    expect(
      screen.getByText("cento e vinte e três reais e quarenta e cinco centavos")
    ).toBeInTheDocument();
  });

  it("mostra erro para números negativos", () => {
    render(<NumeroPorExtensoTool />);
    fireEvent.change(screen.getByLabelText(/^número$/i), { target: { value: "-5" } });
    expect(screen.getByText(/número válido e não negativo/i)).toBeInTheDocument();
  });

  it("mostra erro ao ultrapassar o limite seguro", () => {
    render(<NumeroPorExtensoTool />);
    fireEvent.change(screen.getByLabelText(/^número$/i), { target: { value: "9999999999999999" } });
    expect(screen.getByText(/aceita valores até/i)).toBeInTheDocument();
  });
});
