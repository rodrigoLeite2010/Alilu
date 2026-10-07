import { describe, expect, it } from "vitest";
import { composeStoryRenderInput } from "@/lib/content-automation/smart-story/compose";
import { buildFallbackContent } from "@/lib/content-automation/smart-story/fallback";

const content = buildFallbackContent("CHECKLIST", "s", []);

describe("composeStoryRenderInput (prévia e produção usam a mesma decisão visual)", () => {
  it("só entrega conteúdo, fundo da biblioteca, marca e mascote — nunca imagem do usuário", () => {
    const input = composeStoryRenderInput({ content, plan: { useMascot: true }, config: { showBrandHandle: false }, seed: "x" });
    expect(Object.keys(input).sort()).toEqual(["background", "brand", "content", "showBrand", "useMascot"]);
    expect(input.showBrand).toBe(false);
    expect(input.useMascot).toBe(true);
    expect(input.background.id).toBeTruthy();
  });

  it("é determinístico pela semente e respeita os fundos recentes", () => {
    const base = { content, plan: { useMascot: false }, config: { showBrandHandle: true }, seed: "mesma" };
    const a = composeStoryRenderInput(base);
    expect(composeStoryRenderInput(base).background.id).toBe(a.background.id);
    const b = composeStoryRenderInput({ ...base, recentBackgroundIds: [a.background.id] });
    expect(b.background.id).not.toBe(a.background.id);
  });
});
