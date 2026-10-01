import type { AutomationContentCategory, AutomationContentType } from "./backend/automation-types";

/**
 * Prompt sugerido por categoria — preenchido na tela quando o usuário
 * escolhe uma categoria e o prompt do horário ainda está vazio (nunca
 * sobrescreve o que ele já escreveu). Usa as variáveis de
 * prompt-variables.ts. Versão para Story é mais curta (o texto precisa
 * ser lido em poucos segundos, sem legenda).
 */
const STORY_PROMPTS: Record<AutomationContentCategory, string> = {
  MOTIVACIONAL:
    "Hoje é {{diaSemana}}. Crie uma frase motivacional curta relacionada a este dia da semana. Máximo 20 palavras. Texto emocional, natural e compartilhável. Não usar hashtags. Não mencionar inteligência artificial.",
  FINANCEIRO:
    "Crie uma dica financeira simples e prática para pessoas comuns. Máximo 25 palavras. A dica deve ser entendida em poucos segundos. Não usar hashtags.",
  UTILIDADES:
    "Crie uma dica útil do dia a dia (organização, tecnologia ou produtividade) em no máximo 25 palavras, direta e fácil de aplicar hoje.",
  CURIOSIDADE:
    "Crie uma curiosidade útil e surpreendente em no máximo 25 palavras, no formato pergunta curta + resposta curta.",
  DIVULGACAO:
    "Divulgue de forma natural uma ferramenta gratuita disponível em {{urlSite}}. Não pareça propaganda agressiva. Gere curiosidade e incentive a pessoa a visitar {{urlSite}}. Máximo 25 palavras.",
  PERSONALIZADO: "",
};

const POST_PROMPTS: Record<AutomationContentCategory, string> = {
  MOTIVACIONAL:
    "Hoje é {{diaSemana}}. Crie uma publicação motivacional relacionada a este dia da semana, com tom leve, inspirador e humano.",
  FINANCEIRO: "Crie uma dica de educação financeira simples e prática para pessoas comuns, com um exemplo do dia a dia.",
  UTILIDADES: "Crie uma dica útil do dia a dia (organização, tecnologia ou produtividade), direta e fácil de aplicar.",
  CURIOSIDADE: "Crie uma curiosidade útil e surpreendente, explicada de forma simples.",
  DIVULGACAO:
    "Divulgue de forma natural uma ferramenta gratuita disponível em {{urlSite}}, mostrando um problema real que ela resolve. Sem propaganda agressiva.",
  PERSONALIZADO: "",
};

export function suggestedPromptFor(category: AutomationContentCategory, contentType: AutomationContentType): string {
  return contentType === "STORY" ? STORY_PROMPTS[category] : POST_PROMPTS[category];
}
