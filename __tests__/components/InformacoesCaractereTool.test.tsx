import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { InformacoesCaractereTool } from "@/components/tools/informacoes-caractere/InformacoesCaractereTool";

describe("InformacoesCaractereTool", () => {
  it("pede para digitar um caractere quando o campo está vazio", () => {
    render(<InformacoesCaractereTool />);
    expect(screen.getByText(/digite um caractere acima/i)).toBeInTheDocument();
  });

  it("mostra as informações corretas para a letra A", () => {
    render(<InformacoesCaractereTool />);
    fireEvent.change(screen.getByLabelText(/digite um caractere/i), { target: { value: "A" } });

    expect(screen.getByText("65")).toBeInTheDocument();
    expect(screen.getByText("0041")).toBeInTheDocument();
    expect(screen.getByText("&#65;")).toBeInTheDocument();
    expect(screen.getByText("&#x0041;")).toBeInTheDocument();
  });

  it("considera apenas o primeiro caractere de uma entrada com vários", () => {
    render(<InformacoesCaractereTool />);
    fireEvent.change(screen.getByLabelText(/digite um caractere/i), { target: { value: "ABC" } });
    expect(screen.getByText("65")).toBeInTheDocument();
  });
});
