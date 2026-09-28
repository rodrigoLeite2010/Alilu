import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { ToolPageTemplate } from "@/components/tools/ToolPageTemplate";
import { getCategoryById } from "@/data/categories";
import { getToolBySlug } from "@/data/tools";
import { buildFaqJsonLd } from "@/lib/seo/faq";

/**
 * Cobre a marcação FAQPage (schema.org) adicionada ao template — a mesma
 * lista de perguntas exibida visualmente deve ser serializada em JSON-LD,
 * tanto quando a ferramenta tem FAQ própria quanto no fallback genérico
 * (ferramentas "em-breve").
 */
describe("ToolPageTemplate — FAQPage JSON-LD", () => {
  it("publica o FAQPage com as perguntas específicas da ferramenta, quando informadas", () => {
    const tool = getToolBySlug("empresa", "gerador-recibo");
    const category = getCategoryById("empresa");
    if (!tool || !category) throw new Error("fixture do catálogo não encontrada");

    const faq = [
      { question: "Pergunta específica?", answer: "Resposta específica." },
    ];

    const { container } = render(
      <ToolPageTemplate tool={tool} category={category} faq={faq} />
    );

    const script = container.querySelector('script[type="application/ld+json"]');
    expect(script).not.toBeNull();
    expect(JSON.parse(script!.innerHTML)).toEqual(buildFaqJsonLd(faq));
  });

  it("publica o FAQPage com o fallback genérico quando a ferramenta não tem FAQ própria", () => {
    const tool = getToolBySlug("empresa", "gerador-recibo");
    const category = getCategoryById("empresa");
    if (!tool || !category) throw new Error("fixture do catálogo não encontrada");

    const { container } = render(<ToolPageTemplate tool={tool} category={category} />);

    const script = container.querySelector('script[type="application/ld+json"]');
    expect(script).not.toBeNull();
    const json = JSON.parse(script!.innerHTML);
    expect(json["@type"]).toBe("FAQPage");
    expect(json.mainEntity.length).toBeGreaterThan(0);
  });
});
