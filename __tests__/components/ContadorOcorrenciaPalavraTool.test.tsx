import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ContadorOcorrenciaPalavraTool } from "@/components/tools/contador-ocorrencia-palavra/ContadorOcorrenciaPalavraTool";

describe("ContadorOcorrenciaPalavraTool", () => {
  it("pede para digitar uma palavra quando o termo está vazio", () => {
    render(<ContadorOcorrenciaPalavraTool />);
    expect(screen.getByText(/digite uma palavra ou expressão para buscar/i)).toBeInTheDocument();
  });

  it("conta as ocorrências de uma palavra no texto", () => {
    render(<ContadorOcorrenciaPalavraTool />);
    fireEvent.change(screen.getByLabelText(/digite ou cole o texto/i), {
      target: { value: "o sol e o sol brilham" },
    });
    fireEvent.change(screen.getByLabelText(/palavra ou expressão a buscar/i), {
      target: { value: "sol" },
    });

    expect(screen.getByText(/2 ocorrências encontradas/i)).toBeInTheDocument();
  });

  it("mostra mensagem quando não há ocorrências", () => {
    render(<ContadorOcorrenciaPalavraTool />);
    fireEvent.change(screen.getByLabelText(/digite ou cole o texto/i), {
      target: { value: "texto qualquer" },
    });
    fireEvent.change(screen.getByLabelText(/palavra ou expressão a buscar/i), {
      target: { value: "inexistente" },
    });

    expect(screen.getByText(/nenhuma ocorrência encontrada/i)).toBeInTheDocument();
  });
});
