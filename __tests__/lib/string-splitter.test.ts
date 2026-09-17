import { describe, expect, it } from "vitest";
import { splitString, DEFAULT_SPLIT_OPTIONS } from "@/lib/formatters/string-splitter";

describe("splitString", () => {
  it("divide por vírgula por padrão", () => {
    expect(splitString("maçã, banana, uva", DEFAULT_SPLIT_OPTIONS)).toEqual(["maçã", "banana", "uva"]);
  });

  it("divide por ponto e vírgula", () => {
    expect(splitString("a;b;c", { ...DEFAULT_SPLIT_OPTIONS, preset: "semicolon" })).toEqual(["a", "b", "c"]);
  });

  it("divide por espaço", () => {
    expect(splitString("a b c", { ...DEFAULT_SPLIT_OPTIONS, preset: "space" })).toEqual(["a", "b", "c"]);
  });

  it("divide por quebra de linha", () => {
    expect(splitString("a\nb\nc", { ...DEFAULT_SPLIT_OPTIONS, preset: "newline" })).toEqual(["a", "b", "c"]);
  });

  it("divide por delimitador personalizado", () => {
    expect(
      splitString("a::b::c", { ...DEFAULT_SPLIT_OPTIONS, preset: "custom", customDelimiter: "::" })
    ).toEqual(["a", "b", "c"]);
  });

  it("remove itens vazios quando removeEmpty é true", () => {
    expect(splitString("a,,b", DEFAULT_SPLIT_OPTIONS)).toEqual(["a", "b"]);
  });

  it("mantém itens vazios quando removeEmpty é false", () => {
    expect(splitString("a,,b", { ...DEFAULT_SPLIT_OPTIONS, removeEmpty: false })).toEqual(["a", "", "b"]);
  });

  it("não remove espaços quando trimItems é false", () => {
    expect(splitString("a, b", { ...DEFAULT_SPLIT_OPTIONS, trimItems: false })).toEqual(["a", " b"]);
  });
});
