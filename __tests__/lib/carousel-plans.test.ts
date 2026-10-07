import { describe, expect, it } from "vitest";
import {
  CAROUSEL_LIMITS,
  CAROUSEL_PLAN_DEFINITIONS,
  EXISTING_CUSTOMER_DISCOUNT_PERCENT,
  carouselPriceFor,
  discountedPriceCents,
  listCarouselPlans,
  trialEmailKey,
} from "@/lib/carousel/carousel-plans";
import {
  canTransition,
  clampSlideCount,
  isoWeekKey,
  maxGeneratedSlides,
  normalizeSlideText,
  slideRolesFor,
  truncateAtWord,
} from "@/lib/carousel/domain";

describe("catálogo de planos do carrossel", () => {
  it("preços, cotas e perfis (2 por plano) conforme combinado", () => {
    const plans = listCarouselPlans();
    expect(plans.map((p) => [p.code, p.priceCents, p.carouselsPerCycle, p.maxProfiles])).toEqual([
      ["STARTER", 2990, 60, 2],
      ["PRO", 4990, 90, 2],
      ["TURBO", 9990, 150, 2],
      ["AGENCY", 19990, 300, 2],
    ]);
    expect(plans.filter((p) => p.highlighted).map((p) => p.code)).toEqual(["PRO"]);
    // "Equipes" não existe hoje: só pode aparecer como "em breve".
    expect(CAROUSEL_PLAN_DEFINITIONS.AGENCY.features.join(" ")).not.toMatch(/equipe/i);
  });

  it("desconto de cliente Alilu vem de UMA regra central (10%)", () => {
    expect(EXISTING_CUSTOMER_DISCOUNT_PERCENT).toBe(10);
    expect(carouselPriceFor("STARTER", true)).toEqual({ listPriceCents: 2990, priceCents: 2691, discountPercent: 10 });
    expect(carouselPriceFor("PRO", true).priceCents).toBe(4491);
    expect(carouselPriceFor("TURBO", true).priceCents).toBe(8991);
    expect(carouselPriceFor("AGENCY", true).priceCents).toBe(17991);
    expect(carouselPriceFor("PRO", false)).toEqual({ listPriceCents: 4990, priceCents: 4990, discountPercent: 0 });
    expect(discountedPriceCents(1000, 150)).toBe(0);
    expect(discountedPriceCents(1000, -5)).toBe(1000);
  });

  it("e-mail do teste grátis é normalizado (Gmail: pontos, +tag, googlemail)", () => {
    expect(trialEmailKey(" Jo.Ao+promo@Gmail.com ")).toBe("joao@gmail.com");
    expect(trialEmailKey("joao@googlemail.com")).toBe("joao@gmail.com");
    expect(trialEmailKey("a.b+x@empresa.com")).toBe("a.b@empresa.com");
  });
});

describe("domínio puro", () => {
  it("estrutura narrativa por quantidade (5–10): abre no gancho, fecha no CTA, tamanho exato", () => {
    for (let count = 5; count <= 10; count += 1) {
      const roles = slideRolesFor(count);
      expect(roles).toHaveLength(count);
      expect(roles[0]).toBe("HOOK");
      expect(roles[count - 1]).toBe("CTA");
      expect(new Set(roles).size).toBe(count);
    }
    expect(slideRolesFor(10)).toEqual(["HOOK", "CONTEXT", "DEEPENING", "INSIGHT", "DEVELOPMENT", "EXAMPLE", "TURN", "APPLICATION", "CONCLUSION", "CTA"]);
    expect(clampSlideCount(2)).toBe(5);
    expect(clampSlideCount(50)).toBe(10);
    expect(clampSlideCount("x")).toBe(10);
  });

  it("imagem final padrão ocupa 1 vaga do limite de 10", () => {
    expect(maxGeneratedSlides(true)).toBe(9);
    expect(maxGeneratedSlides(false)).toBe(10);
  });

  it("limites de texto: headline 70, body 220, CTA curto; corta em palavra", () => {
    const out = normalizeSlideText({ headline: "palavra ".repeat(30), body: "x ".repeat(300), cta: "c".repeat(100) });
    expect(out.headline.length).toBeLessThanOrEqual(CAROUSEL_LIMITS.headline);
    expect(out.body.length).toBeLessThanOrEqual(CAROUSEL_LIMITS.body);
    expect(out.cta.length).toBeLessThanOrEqual(CAROUSEL_LIMITS.cta);
    expect(out.truncated).toEqual(["headline", "body", "cta"]);
    expect(out.headline.endsWith("…")).toBe(true);
    expect(normalizeSlideText({ headline: "  Curto  ", body: 5 }).headline).toBe("Curto");
    expect(truncateAtWord("abc def", 50)).toBe("abc def");
  });

  it("transições de status e semana ISO", () => {
    expect(canTransition("DRAFT", "GENERATING")).toBe(true);
    expect(canTransition("PUBLISHED", "DRAFT")).toBe(false);
    expect(canTransition("FAILED", "GENERATING")).toBe(true);
    expect(isoWeekKey(new Date("2026-10-06T12:00:00Z"))).toBe("2026-W41");
    expect(isoWeekKey(new Date("2026-01-01T12:00:00Z"))).toBe("2026-W01");
    expect(isoWeekKey(new Date("2026-12-31T12:00:00Z"))).toBe("2026-W53");
  });
});
