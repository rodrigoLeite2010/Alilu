/**
 * Legendas da fila (lógica pura).
 *
 * Template com variáveis: {titulo}, {tema}, {categoria}, {numero}, {total}.
 * Um item com legenda própria (editada ou gerada com IA e revisada) usa a
 * legenda dele; os outros usam o template da fila — "mesma legenda para
 * todos" é só um template sem variáveis.
 */
import { INSTAGRAM_CAPTION_MAX_LENGTH } from "./types";

export interface CaptionVariables {
  titulo: string | null;
  tema: string;
  categoria: string;
  numero: number;
  total: number;
}

export function renderCaptionTemplate(template: string, vars: CaptionVariables): string {
  const values: Record<string, string> = {
    titulo: (vars.titulo ?? "").trim(),
    tema: vars.tema,
    categoria: vars.categoria,
    numero: String(vars.numero),
    total: String(vars.total),
  };
  return template
    .replace(/\{(titulo|tema|categoria|numero|total)\}/g, (_, key: string) => values[key] ?? "")
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/g, ""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function resolveItemCaption(item: { caption: string | null; title: string | null }, template: string, vars: Omit<CaptionVariables, "titulo">): string {
  const own = item.caption?.trim();
  if (own) return own;
  return renderCaptionTemplate(template, { ...vars, titulo: item.title });
}

/** Mensagem de erro (ou null) para uma legenda do Instagram. */
export function validateCaption(caption: string, maxLength = INSTAGRAM_CAPTION_MAX_LENGTH): string | null {
  if (caption.length > maxLength) return `A legenda pode ter no máximo ${maxLength} caracteres.`;
  const hashtags = caption.match(/#[\p{L}\p{N}_]+/gu) ?? [];
  if (hashtags.length > 30) return "O Instagram aceita no máximo 30 hashtags por publicação.";
  return null;
}

/**
 * Prompt para a geração de legenda com IA (rota já existente
 * /api/instagram/ai-caption). Pede texto fiel ao vídeo e proíbe afirmar
 * que é trailer oficial, vazamento ou notícia.
 */
export function buildAiCaptionPrompt(input: { theme: string; category: string; title: string | null; notes?: string | null }): string {
  const lines = [
    `Escreva uma legenda curta para um Reel sobre ${input.theme} (categoria ${input.category}).`,
    input.title ? `Descrição do vídeo, escrita por quem vai publicar: "${input.title.trim()}".` : "Não há descrição do vídeo: use um texto genérico sobre o tema, sem inventar fatos.",
    input.notes ? `Observações: ${input.notes.trim()}` : "",
    "Regras: descreva só o que está na descrição; NÃO afirme que é trailer oficial, vazamento, notícia ou anúncio da desenvolvedora; não invente datas, preços ou novidades.",
    "Inclua uma chamada para comentários e de 3 a 6 hashtags relevantes.",
  ];
  return lines.filter(Boolean).join("\n");
}
