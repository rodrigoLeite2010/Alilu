import { describe, expect, it } from "vitest";
import { countCharacters } from "@/lib/formatters/character-counter";

describe("countCharacters", () => {
  it("conta caracteres com e sem espaços", () => {
    const result = countCharacters("Olá mundo");
    expect(result.charactersWithSpaces).toBe(9);
    expect(result.charactersWithoutSpaces).toBe(8);
  });

  it("conta palavras", () => {
    expect(countCharacters("Olá mundo bonito").words).toBe(3);
  });

  it("conta linhas", () => {
    expect(countCharacters("linha 1\nlinha 2\nlinha 3").lines).toBe(3);
  });

  it("conta parágrafos separados por linha em branco", () => {
    expect(countCharacters("parágrafo um\n\nparágrafo dois").paragraphs).toBe(2);
  });

  it("conta dígitos numéricos", () => {
    expect(countCharacters("tenho 2 gatos e 10 peixes").digits).toBe(3);
  });

  it("conta emojis como um único caractere", () => {
    expect(countCharacters("😀").charactersWithSpaces).toBe(1);
  });

  it("retorna tudo zerado para texto vazio", () => {
    expect(countCharacters("")).toEqual({
      charactersWithSpaces: 0,
      charactersWithoutSpaces: 0,
      words: 0,
      lines: 0,
      paragraphs: 0,
      digits: 0,
    });
  });
});
