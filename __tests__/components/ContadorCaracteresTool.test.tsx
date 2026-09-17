import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ContadorCaracteresTool } from "@/components/tools/contador-caracteres/ContadorCaracteresTool";

describe("ContadorCaracteresTool", () => {
  it("mostra todos os contadores zerados sem texto digitado", () => {
    render(<ContadorCaracteresTool />);
    const zeros = screen.getAllByText("0");
    expect(zeros.length).toBeGreaterThanOrEqual(6);
  });

  it("atualiza a contagem em tempo real ao digitar", () => {
    render(<ContadorCaracteresTool />);
    fireEvent.change(screen.getByLabelText(/digite ou cole o texto/i), {
      target: { value: "Olá mundo" },
    });

    expect(screen.getByText("9")).toBeInTheDocument(); // caracteres com espaços
    expect(screen.getByText("8")).toBeInTheDocument(); // caracteres sem espaços
    expect(screen.getByText("2")).toBeInTheDocument(); // palavras
  });
});
