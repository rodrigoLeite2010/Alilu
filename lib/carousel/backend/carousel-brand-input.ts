import { isCarouselTemplateId, isHexColor } from "../design/templates";
import { normalizeHandle } from "@/lib/content-automation/smart-story/brand";
import type { CarouselBrandProfile } from "./carousel-repository";

function clean(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const text = value.replace(/\s+/g, " ").trim().slice(0, max);
  return text || null;
}

/** Normaliza o corpo recebido do formulário de marca (nunca confia no cliente). */
export function normalizeCarouselBrandInput(body: Record<string, unknown>): Omit<CarouselBrandProfile, "userId"> {
  const color = (value: unknown): string | null => (typeof value === "string" && isHexColor(value.trim()) ? value.trim().toLowerCase() : null);
  return {
    brandName: clean(body.brandName, 60),
    handle: normalizeHandle(body.handle),
    niche: clean(body.niche, 80),
    audience: clean(body.audience, 200),
    objective: clean(body.objective, 200),
    tone: clean(body.tone, 120),
    accentColor: color(body.accentColor),
    secondaryColor: color(body.secondaryColor),
    fontId: clean(body.fontId, 40),
    defaultTemplateId: isCarouselTemplateId(body.defaultTemplateId) ? (body.defaultTemplateId as string) : null,
    logoUrl: null,
  };
}
