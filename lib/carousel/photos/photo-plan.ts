/**
 * Plano de fotos do carrossel (puro): quantas fotos reais e em quais slides.
 * Não força foto em todo slide — entre `min` e `max` por carrossel, com mais
 * fotos nos temas emocionais e mais tipografia nos conceituais.
 */
export type PhotoDensity = "HIGH" | "MID" | "LOW";

export function targetPhotoCount(input: { density: PhotoDensity; min: number; max: number; textSlides: number }): number {
  const max = Math.min(input.max, Math.max(0, input.textSlides - 2));
  const min = Math.min(input.min, max);
  const wanted = input.density === "HIGH" ? max : input.density === "LOW" ? min : Math.round((min + max) / 2);
  return Math.max(min, Math.min(max, wanted));
}

export interface PhotoPlanSlide {
  position: number;
  visualKind: string;
}

/**
 * Posições que recebem foto: primeiro as marcadas como PHOTO pela IA (até `max`), depois completa
 * até `target` com posições espaçadas (1, 3, 5…). O último slide (convite) nunca recebe foto.
 */
export function choosePhotoPositions(slides: readonly PhotoPlanSlide[], input: { target: number; max: number }): number[] {
  const last = Math.max(...slides.map((slide) => slide.position));
  const eligible = slides.filter((slide) => slide.position !== last).map((slide) => slide.position);
  const chosen: number[] = slides.filter((slide) => slide.visualKind === "PHOTO" && eligible.includes(slide.position)).map((slide) => slide.position).slice(0, input.max);
  if (chosen.length < input.target) {
    const pending = eligible.filter((position) => !chosen.includes(position));
    // espalhados: começa pelos ímpares, depois os pares
    const ordered = [...pending.filter((position) => position % 2 === 1), ...pending.filter((position) => position % 2 === 0)];
    for (const position of ordered) {
      if (chosen.length >= input.target) break;
      chosen.push(position);
    }
  }
  return chosen.sort((a, b) => a - b);
}
