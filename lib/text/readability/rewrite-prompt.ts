import type { RewriteAudience, RewriteGoal } from "./rewrite-options";

/**
 * Prompt dinâmico da reescrita (montado SÓ no servidor). Função pura,
 * testável. A IA responde JSON: { "text": "..." } ou, para Reels,
 * { "hook": "...", "body": "...", "cta": "..." }.
 */

const AUDIENCE_TEXT: Record<RewriteAudience, string> = {
  general: "público geral, qualquer pessoa adulta",
  child10:
    "uma criança de aproximadamente 10 anos. Escreva de forma que ela consiga entender sem ajuda. Use palavras simples, frases curtas e explicações diretas. Não infantilize o conteúdo",
  teen: "adolescentes, com linguagem próxima e natural, sem gírias forçadas",
  adult: "adultos em geral",
  professional: "profissionais, com tom claro e respeitoso, sem jargão desnecessário",
  technical: "um público técnico: mantenha os termos técnicos necessários, mas com frases claras",
};

const GOAL_TEXT: Record<RewriteGoal, string> = {
  simplify: "deixar o texto fácil de entender",
  direct: "deixar o texto mais direto: vá ao ponto, corte rodeios e repetições",
  persuasive: "deixar o texto mais persuasivo: destaque o benefício e termine com um convite à ação, sem exageros nem promessas falsas",
  emotional: "deixar o texto mais emocional e humano, que gere conexão, sem perder a informação",
  instagram:
    "adaptar para um post de Instagram: início forte, frases curtas, bom ritmo, linguagem humana, parágrafos curtos para leitura no celular, sem linguagem corporativa",
  reels:
    "adaptar para roteiro de Reels, dividido em GANCHO (1 frase que prende nos 3 primeiros segundos), CORPO (o conteúdo, em frases curtas para falar) e CTA (chamada final curta)",
  caption: "adaptar para legenda de rede social: abertura forte, parágrafos curtos para leitura no celular e um convite à ação opcional no final",
  hook: "criar SOMENTE uma abertura curta (gancho de até 3 segundos, no máximo 15 palavras) que prenda a atenção imediatamente — não reescreva o texto todo",
};

const RULES = [
  "use frases curtas;",
  "prefira palavras comuns;",
  "evite jargões e termos rebuscados;",
  "mantenha as informações importantes;",
  "não invente fatos;",
  "não altere nomes próprios;",
  "não altere números, datas, URLs, e-mails nem valores monetários;",
  "preserve o sentido original;",
  "escreva em português do Brasil.",
];

export function buildRewritePrompt(text: string, goal: RewriteGoal, audience: RewriteAudience): string {
  const format =
    goal === "reels"
      ? 'Responda SOMENTE com JSON no formato {"hook": string, "body": string, "cta": string}.'
      : 'Responda SOMENTE com JSON no formato {"text": string}. Separe parágrafos com uma linha em branco (\\n\\n).';
  return [
    goal === "hook" ? "Crie um gancho para o texto abaixo." : "Reescreva o texto abaixo mantendo o significado original.",
    "",
    `Objetivo: ${GOAL_TEXT[goal]}.`,
    `Público: ${AUDIENCE_TEXT[audience]}.`,
    "",
    "Regras:",
    ...RULES.map((rule) => `- ${rule}`),
    "",
    format,
    "",
    "Texto:",
    "<<<",
    text,
    ">>>",
  ].join("\n");
}

export interface ParsedRewrite {
  text: string;
  parts: { hook: string; body: string; cta: string } | null;
}

const str = (value: unknown) => (typeof value === "string" ? value.trim() : "");

/** Interpreta o JSON da IA; null quando veio vazio/inválido. */
export function parseRewriteContent(goal: RewriteGoal, content: Record<string, unknown>): ParsedRewrite | null {
  if (goal === "reels") {
    const parts = { hook: str(content.hook), body: str(content.body), cta: str(content.cta) };
    if (!parts.hook && !parts.body) return null;
    return { text: [parts.hook, parts.body, parts.cta].filter(Boolean).join("\n\n"), parts };
  }
  const text = str(content.text);
  return text ? { text, parts: null } : null;
}

/** Números, URLs e e-mails do original que sumiram da reescrita (aviso — a IA não pode alterar dados). */
export function findMissingFacts(original: string, rewritten: string): string[] {
  const facts = new Set<string>();
  for (const match of original.matchAll(/https?:\/\/\S+|www\.\S+|[^\s@]+@[^\s@]+\.[^\s@]+|\d+(?:[.,]\d+)*%?/g)) {
    const value = match[0].replace(/[.,;:!?)]+$/, "");
    if (value.length > 0) facts.add(value);
  }
  return [...facts].filter((fact) => !rewritten.includes(fact)).slice(0, 10);
}
