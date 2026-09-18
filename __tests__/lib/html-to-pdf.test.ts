import { describe, expect, it } from "vitest";
import { sanitizeHtmlForPdf } from "@/lib/pdf/html-to-pdf";

describe("sanitização para HTML em PDF", () => {
  it("remove scripts, URLs externas e atributos perigosos", async () => {
    const result = await sanitizeHtmlForPdf(
      `<h1>Relatório</h1><script>alert(1)</script><a href="https://externo.test">link</a><img src="https://externo.test/imagem.jpg" onerror="alert(1)">`
    );

    expect(result).toContain("<h1>Relatório</h1>");
    expect(result).toContain("link");
    expect(result).not.toMatch(/script|https:|onerror/i);
  });

  it("recusa HTML vazio", async () => {
    await expect(sanitizeHtmlForPdf("   ")).rejects.toMatchObject({ type: "generation-failed" });
  });
});
