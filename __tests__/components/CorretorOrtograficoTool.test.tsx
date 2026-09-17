import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { CorretorOrtograficoTool } from "@/components/tools/corretor-ortografico/CorretorOrtograficoTool";

describe("CorretorOrtograficoTool", () => {
  it("renderiza a área de texto com spellCheck habilitado", () => {
    render(<CorretorOrtograficoTool />);
    const textarea = screen.getByLabelText(/digite ou cole o texto/i);
    expect(textarea).toHaveAttribute("spellcheck", "true");
    expect(textarea).toHaveAttribute("lang", "pt-BR");
  });

  it("aceita texto digitado", () => {
    render(<CorretorOrtograficoTool />);
    const textarea = screen.getByLabelText(/digite ou cole o texto/i) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "um texto de teste" } });
    expect(textarea.value).toBe("um texto de teste");
  });

  it("explica que a correção é feita pelo navegador, sem envio a servidores", () => {
    render(<CorretorOrtograficoTool />);
    expect(screen.getByText(/nada é enviado a nenhum servidor/i)).toBeInTheDocument();
  });
});
