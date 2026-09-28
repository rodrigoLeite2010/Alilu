import { describe, expect, it } from "vitest";
import { buildFaqJsonLd } from "@/lib/seo/faq";

describe("buildFaqJsonLd", () => {
  it("gera um FAQPage schema.org válido a partir da lista de perguntas", () => {
    const json = buildFaqJsonLd([
      { question: "Pergunta 1?", answer: "Resposta 1." },
      { question: "Pergunta 2?", answer: "Resposta 2." },
    ]);

    expect(json).toEqual({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: [
        {
          "@type": "Question",
          name: "Pergunta 1?",
          acceptedAnswer: { "@type": "Answer", text: "Resposta 1." },
        },
        {
          "@type": "Question",
          name: "Pergunta 2?",
          acceptedAnswer: { "@type": "Answer", text: "Resposta 2." },
        },
      ],
    });
  });

  it("retorna null quando não há perguntas (nunca publica FAQPage vazio)", () => {
    expect(buildFaqJsonLd([])).toBeNull();
  });
});
