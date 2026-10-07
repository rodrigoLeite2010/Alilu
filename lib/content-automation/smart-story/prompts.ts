import { STORY_LIMITS, STORY_THEME_LABEL, STORY_TYPE_LABEL, VISUAL_MOODS, type StoryHistoryItem, type StoryPlan, type StoryType } from "./types";

/**
 * Prompt CENTRAL por tipo de Story: o que o tipo exige. O prompt base do
 * usuário (tom, marca, regras) é somado a isto — não substituído.
 */
export const TYPE_INSTRUCTIONS: Record<StoryType, string> = {
  REFLECTION:
    "Uma reflexão curta e marcante sobre o tema, em 1 ou 2 frases. Use headline para a frase principal; body é opcional (complemento curto).",
  EMOTIONAL_QUESTION:
    "Uma pergunta emocional que faça a pessoa parar e pensar (e querer responder). headline = a pergunta; body opcional. Termine convidando a responder por direct no cta.",
  VISUAL_POLL:
    "Uma enquete VISUAL entre duas opções (A ou B), desenhada na imagem. headline = a pergunta; optionA e optionB = as duas opções, curtas e opostas. NUNCA diga 'vote', 'toque' ou 'clique' — a enquete NÃO é interativa; no cta peça para responder por direct ou reagir.",
  CHOICE_AB:
    "Um dilema leve entre duas escolhas (A ou B). headline = o dilema; optionA e optionB = as duas escolhas. Sem prometer votação: peça a resposta por direct no cta.",
  COMPLETE_SENTENCE:
    "Uma frase começada para a pessoa completar (ex.: 'Hoje eu me sinto grato por…'). headline = o começo da frase; body opcional.",
  MINI_STORY:
    "Uma mini-história de 2 a 3 frases, com começo, virada e lição, sem inventar fatos reais. headline = título curto; body = a história.",
  CURIOSITY:
    "Uma curiosidade verdadeira e geral, sem números, datas ou estatísticas específicas. headline = o gancho; body = a explicação curta.",
  CHECKLIST:
    "Um checklist de 3 a 5 itens curtos e práticos. headline = o título do checklist; body = um item por linha (sem numeração e sem marcadores).",
  ADVICE:
    "Um conselho prático e gentil. headline = o conselho; body = por que ele funciona, em 1 ou 2 frases.",
  CTA:
    "Um convite direto para conhecer as ferramentas gratuitas do ALILU. headline = a chamada; cta = a ação (ex.: 'Acesse alilu.com.br'). Sem prometer nada que o Alilu não tenha.",
  ALILU_BRAND:
    "Uma mensagem de marca do ALILU (ferramentas gratuitas e úteis para o dia a dia), acolhedora, sem exagero e sem inventar dados. headline = a mensagem; cta = convite para seguir ou visitar.",
};

export interface BuildStoryPromptInput {
  plan: StoryPlan;
  /** Prompt base do usuário (já com variáveis {{…}} resolvidas). Pode ser vazio. */
  basePrompt: string;
  brandContext: string;
  dayOfWeekLabel?: string;
  /** Stories anteriores, mais recente primeiro (já cortado em contextWindow). */
  history: StoryHistoryItem[];
  /** Observações dos motivos da tentativa anterior (retry controlado). */
  previousProblems?: string[];
}

/** Monta o prompt estruturado (JSON) de UM Story. */
export function buildStoryPrompt(input: BuildStoryPromptInput): string {
  const { plan, history } = input;
  const recent = history
    .map((item) => `- [${STORY_TYPE_LABEL[item.storyType]}] "${item.headline.replace(/\s+/g, " ").slice(0, 120)}"`)
    .join("\n");

  const lines = [
    `Contexto da marca: ${input.brandContext.trim() || "(sem contexto adicional)"}`,
    input.dayOfWeekLabel ? `Dia da semana desta publicação: ${input.dayOfWeekLabel}. Não cite outro dia.` : "",
    input.basePrompt.trim() ? `Pedido base do usuário (tom e regras gerais): ${input.basePrompt.trim()}` : "",
    "",
    `Gere UM Story do Instagram do tipo "${STORY_TYPE_LABEL[plan.type]}" (${plan.type}) sobre o tema "${STORY_THEME_LABEL[plan.theme]}".`,
    `Regras do tipo: ${TYPE_INSTRUCTIONS[plan.type]}`,
    "",
    "Regras gerais: português do Brasil; sem emojis, sem hashtags, sem markdown e sem aspas em volta do texto; texto curto e legível numa imagem vertical; nunca invente dados factuais específicos; nunca prometa enquete, pergunta ou link clicáveis (o Story é só uma imagem).",
    `Limites: headline até ${STORY_LIMITS.headline} caracteres; body até ${STORY_LIMITS.body}; optionA/optionB até ${STORY_LIMITS.option}; cta até ${STORY_LIMITS.cta}.`,
    recent ? `\nStories recentes (NÃO repita o título, o assunto nem o jeito de começar):\n${recent}` : "",
    input.previousProblems && input.previousProblems.length > 0
      ? `\nA tentativa anterior foi rejeitada por: ${input.previousProblems.join("; ")}. Corrija.`
      : "",
    "",
    "Responda SOMENTE com este JSON (campos não usados pelo tipo ficam como string vazia):",
    `{"type": "${plan.type}", "headline": string, "body": string, "optionA": string, "optionB": string, "cta": string, "visualMood": "${VISUAL_MOODS.join('" | "')}", "topic": string (assunto em até 4 palavras)}`,
  ];
  return lines.join("\n").replace(/\n{3,}/g, "\n\n");
}
