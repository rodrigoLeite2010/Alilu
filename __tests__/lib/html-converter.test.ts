import { describe, expect, it } from "vitest";
import { escapeHtml, textToHtml, DEFAULT_TEXT_TO_HTML_OPTIONS } from "@/lib/formatters/html-converter";

describe("escapeHtml", () => {
  it("escapa os cinco caracteres especiais do HTML", () => {
    expect(escapeHtml(`<script>alert("x") & 'y'</script>`)).toBe(
      "&lt;script&gt;alert(&quot;x&quot;) &amp; &#39;y&#39;&lt;/script&gt;"
    );
  });

  it("não altera texto sem caracteres especiais", () => {
    expect(escapeHtml("texto normal")).toBe("texto normal");
  });
});

describe("textToHtml", () => {
  it("converte quebras de linha em <br> no modo br", () => {
    expect(textToHtml("linha 1\nlinha 2", DEFAULT_TEXT_TO_HTML_OPTIONS)).toBe("linha 1<br>\nlinha 2");
  });

  it("converte parágrafos em <p> no modo p", () => {
    const result = textToHtml("parágrafo um\n\nparágrafo dois", { ...DEFAULT_TEXT_TO_HTML_OPTIONS, mode: "p" });
    expect(result).toBe("<p>parágrafo um</p>\n<p>parágrafo dois</p>");
  });

  it("nunca produz HTML executável a partir de texto malicioso (proteção XSS)", () => {
    const result = textToHtml('<img src=x onerror="alert(1)">', DEFAULT_TEXT_TO_HTML_OPTIONS);
    expect(result).not.toContain("<img");
    expect(result).toContain("&lt;img");
  });

  it("converte espaços duplos em &nbsp; quando preserveSpaces é true", () => {
    const result = textToHtml("a  b", { ...DEFAULT_TEXT_TO_HTML_OPTIONS, preserveSpaces: true });
    expect(result).toContain("&nbsp;");
  });

  it("não altera espaços duplos quando preserveSpaces é false", () => {
    const result = textToHtml("a  b", DEFAULT_TEXT_TO_HTML_OPTIONS);
    expect(result).toBe("a  b");
  });
});
