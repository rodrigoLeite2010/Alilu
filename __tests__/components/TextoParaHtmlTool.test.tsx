import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { TextoParaHtmlTool } from "@/components/tools/texto-para-html/TextoParaHtmlTool";

function mockClipboard() {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.assign(navigator, { clipboard: { writeText } });
  return writeText;
}

beforeEach(() => {
  mockClipboard();
});

describe("TextoParaHtmlTool", () => {
  it("converte quebras de linha em <br> por padrão", () => {
    render(<TextoParaHtmlTool />);
    fireEvent.change(screen.getByLabelText(/digite ou cole o texto original/i), {
      target: { value: "linha 1\nlinha 2" },
    });

    const output = screen.getByPlaceholderText(/o html gerado aparece aqui/i) as HTMLTextAreaElement;
    expect(output.value).toBe("linha 1<br>\nlinha 2");
  });

  it("escapa caracteres HTML especiais (proteção contra XSS)", () => {
    render(<TextoParaHtmlTool />);
    fireEvent.change(screen.getByLabelText(/digite ou cole o texto original/i), {
      target: { value: "<script>alert(1)</script>" },
    });

    const output = screen.getByPlaceholderText(/o html gerado aparece aqui/i) as HTMLTextAreaElement;
    expect(output.value).not.toContain("<script>");
    expect(output.value).toContain("&lt;script&gt;");
  });

  it("permite copiar o HTML gerado", async () => {
    const writeText = mockClipboard();
    render(<TextoParaHtmlTool />);
    fireEvent.change(screen.getByLabelText(/digite ou cole o texto original/i), {
      target: { value: "olá" },
    });
    fireEvent.click(screen.getByRole("button", { name: /copiar html/i }));
    expect(writeText).toHaveBeenCalledWith("olá");
  });
});
