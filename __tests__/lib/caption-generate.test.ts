import { describe, expect, it } from "vitest";
import { generateCaptions, CAPTION_VARIANT_COUNT } from "@/lib/instagram/captions/generate";
import {
  CAPTION_CONTENT_TYPES,
  CAPTION_SIZES,
  CAPTION_STYLES,
  createDefaultCaptionFormInput,
  type CaptionFormInput,
} from "@/lib/instagram/captions/types";
import { buildHashtags } from "@/lib/instagram/captions/decorations";

function baseInput(overrides: Partial<CaptionFormInput> = {}): CaptionFormInput {
  return { ...createDefaultCaptionFormInput(), subject: "brownies veganos", ...overrides };
}

describe("generateCaptions — geração básica (ETAPA 8/10)", () => {
  it("sempre gera exatamente 3 variações", () => {
    const captions = generateCaptions(baseInput());
    expect(captions).toHaveLength(CAPTION_VARIANT_COUNT);
  });

  it("as 3 variações têm redações realmente diferentes entre si (não é a mesma frase com troca de emoji)", () => {
    const captions = generateCaptions(baseInput({ includeEmojis: false, includeHashtags: false }));
    const texts = captions.map((caption) => caption.text);
    expect(new Set(texts).size).toBe(3);

    // Nenhuma das 3 é só a outra com o texto reorganizado - elas usam
    // aberturas (primeira frase) totalmente diferentes.
    const firstLines = texts.map((text) => text.split("\n\n")[0]);
    expect(new Set(firstLines).size).toBe(3);
  });

  it("cada tipo de conteúdo suportado gera legendas contendo o assunto informado", () => {
    for (const type of CAPTION_CONTENT_TYPES) {
      const captions = generateCaptions(baseInput({ contentType: type.id }));
      for (const caption of captions) {
        expect(caption.text).toContain("brownies veganos");
      }
    }
  });

  it("cada estilo suportado gera uma legenda válida e não vazia", () => {
    for (const style of CAPTION_STYLES) {
      const captions = generateCaptions(baseInput({ style: style.id }));
      for (const caption of captions) {
        expect(caption.text.length).toBeGreaterThan(0);
      }
    }
  });

  it("os 3 tamanhos disponíveis produzem legendas progressivamente mais longas", () => {
    const lengths = CAPTION_SIZES.map(
      (size) => generateCaptions(baseInput({ size: size.id, includeHashtags: false }))[0].text.length
    );
    // curto < médio < longo (mesmos dados de entrada, só o tamanho muda)
    expect(lengths[0]).toBeLessThan(lengths[1]);
    expect(lengths[1]).toBeLessThan(lengths[2]);
  });
});

describe("generateCaptions — emojis e hashtags (ETAPA 10)", () => {
  it("com emojis desligados, o texto não contém nenhum emoji do dicionário de tipos", () => {
    const captions = generateCaptions(baseInput({ includeEmojis: false, contentType: "promocao" }));
    for (const caption of captions) {
      expect(caption.text).not.toContain("🎉");
    }
  });

  it("com emojis ligados, a legenda inclui o emoji do tipo de conteúdo escolhido", () => {
    const captions = generateCaptions(baseInput({ includeEmojis: true, contentType: "promocao" }));
    for (const caption of captions) {
      expect(caption.text).toContain("🎉");
    }
  });

  it("com hashtags desligadas, nenhuma legenda contém #", () => {
    const captions = generateCaptions(baseInput({ includeHashtags: false }));
    for (const caption of captions) {
      expect(caption.text).not.toContain("#");
      expect(caption.hashtags).toHaveLength(0);
    }
  });

  it("com hashtags ligadas, inclui a hashtag do tipo de conteúdo e do assunto informado", () => {
    const captions = generateCaptions(baseInput({ includeHashtags: true, contentType: "dicas" }));
    for (const caption of captions) {
      expect(caption.hashtags).toContain("#dicas");
      expect(caption.hashtags.some((tag) => tag.includes("brownies"))).toBe(true);
    }
  });
});

describe("generateCaptions — campos opcionais e casos extremos (ETAPA 15)", () => {
  it("assunto em branco não gera um texto quebrado (usa um substituto neutro, nunca inventa dado)", () => {
    const captions = generateCaptions(baseInput({ subject: "   " }));
    for (const caption of captions) {
      expect(caption.text.length).toBeGreaterThan(0);
      expect(caption.text).not.toContain("undefined");
      expect(caption.text).not.toMatch(/\s\./);
    }
  });

  it("sem público-alvo, não aparece nenhuma frase de público na legenda", () => {
    const captions = generateCaptions(baseInput({ audience: "" }));
    for (const caption of captions) {
      expect(caption.text).not.toContain("Pensado especialmente para");
    }
  });

  it("com público-alvo preenchido, a frase de público aparece com o texto exato informado", () => {
    const captions = generateCaptions(baseInput({ audience: "quem ama doces" }));
    for (const caption of captions) {
      expect(caption.text).toContain("Pensado especialmente para quem ama doces.");
    }
  });

  it("sem chamada para ação, nenhum texto extra é inventado no lugar", () => {
    const withoutCta = generateCaptions(baseInput({ callToAction: "", includeHashtags: false }))[0].text;
    const withCta = generateCaptions(baseInput({ callToAction: "Chame no direct", includeHashtags: false }))[0].text;
    expect(withoutCta).not.toContain("Chame no direct");
    expect(withCta).toContain("Chame no direct");
  });

  it("caracteres especiais e acentos no assunto e no público-alvo são preservados sem quebrar a geração", () => {
    const captions = generateCaptions(
      baseInput({ subject: "Promoção de São João — 50% dos itens!", audience: "avós & netos" })
    );
    for (const caption of captions) {
      expect(caption.text).toContain("Promoção de São João — 50% dos itens!");
      expect(caption.text).toContain("avós & netos");
    }
  });

  it("não inventa preço, desconto ou depoimento além do que o usuário escreveu no assunto", () => {
    const captions = generateCaptions(baseInput({ subject: "novo produto" }));
    for (const caption of captions) {
      expect(caption.text).not.toMatch(/\d+%\s*de desconto/i);
      expect(caption.text).not.toMatch(/r\$\s?\d/i);
    }
  });

  it("gerar com um seed diferente muda a combinação de frases sem alterar o assunto nem inventar conteúdo", () => {
    const first = generateCaptions(baseInput(), 0);
    const second = generateCaptions(baseInput(), 1);
    const firstTexts = first.map((c) => c.text);
    const secondTexts = second.map((c) => c.text);

    expect(firstTexts).not.toEqual(secondTexts);
    for (const text of secondTexts) {
      expect(text).toContain("brownies veganos");
    }
  });
});

describe("buildHashtags — geração de hashtags (ETAPA 10)", () => {
  it("sempre inclui a hashtag do tipo de conteúdo", () => {
    const hashtags = buildHashtags({ subject: "", contentType: "motivacional" });
    expect(hashtags).toContain("#motivacional");
  });

  it("com assunto sem palavras aproveitáveis, não força uma hashtag genérica no lugar", () => {
    const hashtags = buildHashtags({ subject: "a e", contentType: "dicas" });
    expect(hashtags).toEqual(["#dicas"]);
  });

  it("remove acentos e caracteres inválidos ao transformar o assunto em hashtag", () => {
    const hashtags = buildHashtags({ subject: "promoção", contentType: "promocao" });
    expect(hashtags).toContain("#promocao");
  });

  it("nunca gera hashtags de engajamento genéricas não relacionadas ao conteúdo", () => {
    const hashtags = buildHashtags({ subject: "receita de bolo", contentType: "dicas" });
    for (const tag of hashtags) {
      expect(tag).not.toMatch(/viral|fy|explorar|paravoce/i);
    }
  });
});
