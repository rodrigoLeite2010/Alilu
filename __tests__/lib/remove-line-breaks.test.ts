import { describe, expect, it } from "vitest";
import { removeLineBreaks, DEFAULT_REMOVE_LINE_BREAKS_OPTIONS } from "@/lib/formatters/remove-line-breaks";

describe("removeLineBreaks", () => {
  it("remove quebras de linha sem substituto", () => {
    const result = removeLineBreaks("linha 1\nlinha 2", {
      replacement: "remove",
      customReplacement: "",
      collapseSpaces: false,
    });
    expect(result).toBe("linha 1linha 2");
  });

  it("substitui quebras de linha por espaço", () => {
    const result = removeLineBreaks("linha 1\nlinha 2", {
      ...DEFAULT_REMOVE_LINE_BREAKS_OPTIONS,
      replacement: "space",
    });
    expect(result).toBe("linha 1 linha 2");
  });

  it("substitui quebras de linha por vírgula", () => {
    const result = removeLineBreaks("a\nb\nc", { ...DEFAULT_REMOVE_LINE_BREAKS_OPTIONS, replacement: "comma" });
    expect(result).toBe("a, b, c");
  });

  it("substitui por texto personalizado", () => {
    const result = removeLineBreaks("a\nb", {
      replacement: "custom",
      customReplacement: " | ",
      collapseSpaces: false,
    });
    expect(result).toBe("a | b");
  });

  it("reconhece \\r\\n e \\r solitário, além de \\n", () => {
    const result = removeLineBreaks("a\r\nb\rc\nd", { ...DEFAULT_REMOVE_LINE_BREAKS_OPTIONS, replacement: "comma" });
    expect(result).toBe("a, b, c, d");
  });

  it("reduz espaços duplos quando collapseSpaces é true", () => {
    const result = removeLineBreaks("a\n\nb", { ...DEFAULT_REMOVE_LINE_BREAKS_OPTIONS, replacement: "space" });
    expect(result).toBe("a b");
  });
});
