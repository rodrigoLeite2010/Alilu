import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { InverterTextoTool } from "@/components/tools/inverter-texto/InverterTextoTool";

function getResultTextarea() {
  return screen.getByPlaceholderText(/o texto invertido aparece aqui/i) as HTMLTextAreaElement;
}

describe("InverterTextoTool", () => {
  it("inverte os caracteres por padrão", () => {
    render(<InverterTextoTool />);
    fireEvent.change(screen.getByLabelText(/digite ou cole o texto/i), { target: { value: "Olá" } });
    expect(getResultTextarea().value).toBe("álO");
  });

  it("inverte a ordem das palavras ao selecionar essa opção", () => {
    render(<InverterTextoTool />);
    fireEvent.change(screen.getByLabelText(/digite ou cole o texto/i), {
      target: { value: "bom dia mundo" },
    });
    fireEvent.click(screen.getByLabelText(/ordem das palavras/i));
    expect(getResultTextarea().value).toBe("mundo dia bom");
  });
});
