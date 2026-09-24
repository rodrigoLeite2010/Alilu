import "server-only";

/**
 * A legenda gravada em instagram_posts.caption é UM texto só (como em todo
 * o resto do projeto — ver captions/generate.ts): corpo + CTA (se ainda
 * não estiver embutido) + hashtags ao final, mesmo formato que o Gerador
 * de Legendas já produz.
 *
 * Extraído de content-generation-service.ts para ser reaproveitado
 * também pela geração avulsa de legenda do compositor manual (rota
 * /api/instagram/ai-caption) — nunca uma segunda implementação de como
 * montar o texto final a partir do que a IA devolve.
 */
export function composeCaption(bodyCaption: string, cta: string, hashtags: string[]): string {
  const parts = [bodyCaption.trim()];
  if (cta && !bodyCaption.toLowerCase().includes(cta.toLowerCase())) {
    parts.push(cta.trim());
  }
  if (hashtags.length > 0) {
    parts.push(hashtags.join(" "));
  }
  return parts.filter(Boolean).join("\n\n");
}
