import { brandDisplayName, NONE_BRAND, type StoryBrand } from "./brand";
import { pickCta } from "./cta";
import { createRng } from "./random";
import { sameText } from "./text";
import { DEFAULT_MOOD } from "./schema";
import type { StoryContent, StoryHistoryItem, StoryType } from "./types";

type FallbackItem = Pick<StoryContent, "headline"> & Partial<Pick<StoryContent, "body" | "optionA" | "optionB" | "cta" | "topic">>;

/**
 * Conteúdo curado local — usado SOMENTE quando a IA falha ou devolve algo
 * inválido depois das tentativas. Texto atemporal, sem fatos específicos,
 * sem prometer interação nativa. Garante que a automação nunca aborte
 * por causa da IA: o Story sai (menos variado, mas correto).
 */
export const FALLBACK_CONTENT: Record<StoryType, FallbackItem[]> = {
  REFLECTION: [
    { headline: "Descansar também é avançar.", topic: "descanso" },
    { headline: "Você não precisa ter pressa para chegar onde merece.", topic: "paciência" },
    { headline: "Pequenos passos todos os dias constroem grandes mudanças.", topic: "constância" },
  ],
  EMOTIONAL_QUESTION: [
    { headline: "Qual foi a última vez que você fez algo só por você?", topic: "autocuidado" },
    { headline: "O que você diria hoje para a pessoa que era um ano atrás?", topic: "tempo" },
    { headline: "Quem faria diferença se recebesse uma mensagem sua agora?", topic: "afeto" },
  ],
  VISUAL_POLL: [
    { headline: "Manhã ou noite?", optionA: "Manhã", optionB: "Noite", topic: "rotina" },
    { headline: "Café ou chá?", optionA: "Café", optionB: "Chá", topic: "hábitos" },
    { headline: "Praia ou montanha?", optionA: "Praia", optionB: "Montanha", topic: "descanso" },
  ],
  CHOICE_AB: [
    { headline: "Qual você escolhe hoje?", optionA: "Calma", optionB: "Coragem", topic: "escolhas" },
    { headline: "Ouvir ou falar?", optionA: "Ouvir", optionB: "Falar", topic: "comunicação" },
    { headline: "Planejar ou improvisar?", optionA: "Planejar", optionB: "Improvisar", topic: "rotina" },
  ],
  COMPLETE_SENTENCE: [
    { headline: "Hoje eu sou grato por…", topic: "gratidão" },
    { headline: "O que mais me ajuda a recomeçar é…", topic: "recomeço" },
    { headline: "Uma coisa que eu aprendi este ano foi…", topic: "aprendizado" },
  ],
  MINI_STORY: [
    {
      headline: "A semente",
      body: "Uma semente achou que o escuro era o fim. Só depois percebeu que era o começo de tudo o que ela ia se tornar.",
      topic: "recomeço",
    },
    {
      headline: "O caminho de pedras",
      body: "Ele reclamava das pedras no caminho, até notar que cada uma era um degrau. Foi subindo sem perceber.",
      topic: "superação",
    },
  ],
  CURIOSITY: [
    {
      headline: "Pausas curtas ajudam a pensar melhor",
      body: "Levantar, respirar e olhar para longe por alguns minutos ajuda a mente a descansar e a voltar mais clara para o que estava fazendo.",
      topic: "pausas",
    },
    {
      headline: "Anotar ajuda a lembrar",
      body: "Escrever à mão o que você precisa fazer costuma deixar a tarefa mais clara e fácil de lembrar do que só guardar na cabeça.",
      topic: "organização",
    },
  ],
  CHECKLIST: [
    {
      headline: "Antes de dormir",
      body: "Beba um copo de água\nSepare a roupa de amanhã\nAnote 3 prioridades\nDesligue as telas",
      topic: "noite",
    },
    {
      headline: "Para um dia mais leve",
      body: "Respire fundo 3 vezes\nFaça uma pausa de 5 minutos\nAgradeça por algo\nPeça ajuda se precisar",
      topic: "leveza",
    },
  ],
  ADVICE: [
    {
      headline: "Comece pelo mais simples.",
      body: "Quando tudo parece grande demais, faça a menor tarefa primeiro. Ela cria o ritmo para o resto.",
      topic: "começo",
    },
    {
      headline: "Diga não sem culpa.",
      body: "Proteger seu tempo é uma forma de cuidar de quem você ama e de si mesmo.",
      topic: "limites",
    },
  ],
  CTA: [
    { headline: "Ferramentas gratuitas para o seu dia a dia", topic: "alilu" },
    { headline: "Calculadoras, PDFs e geradores num só lugar", topic: "ferramentas" },
  ],
  ALILU_BRAND: [
    { headline: "O ALILU facilita o seu dia a dia, de graça.", topic: "alilu" },
    { headline: "Utilidades simples, sem complicação.", topic: "utilidades" },
  ],
};

/**
 * Fallbacks de marca (CTA e Marca / Convite) falam da marca DO USUÁRIO — o
 * texto curado do Alilu só vale para a conta do Alilu. Sem nome, @ nem site
 * (tipo que nem deveria ser sorteado), cai numa reflexão genérica.
 */
function fallbackPool(type: StoryType, brand: StoryBrand): FallbackItem[] {
  if ((type !== "CTA" && type !== "ALILU_BRAND") || brand.kind === "ALILU") return FALLBACK_CONTENT[type];
  const name = brandDisplayName(brand);
  if (!name) return FALLBACK_CONTENT.REFLECTION;
  return type === "CTA"
    ? [
        { headline: `Conheça ${name}`, topic: "convite" },
        { headline: `Venha conhecer ${name}`, topic: "convite" },
      ]
    : [
        { headline: `${name}: feito com cuidado para você.`, topic: "marca" },
        { headline: `Obrigado por acompanhar ${name}.`, topic: "marca" },
      ];
}

/**
 * Escolhe um fallback do tipo (determinístico pela semente), pulando os
 * títulos recentes. Todos usados? Repete o primeiro sorteado — preferir
 * repetir a abortar.
 */
export function buildFallbackContent(type: StoryType, seed: string, history: StoryHistoryItem[], brand: StoryBrand = NONE_BRAND): StoryContent {
  const pool = fallbackPool(type, brand);
  const fresh = pool.filter((item) => !history.some((past) => sameText(past.headline, item.headline)));
  const list = fresh.length > 0 ? fresh : pool;
  const item = list[Math.floor(createRng(`${seed}|fallback`)() * list.length)];
  return {
    type,
    headline: item.headline,
    body: item.body ?? "",
    optionA: item.optionA ?? "",
    optionB: item.optionB ?? "",
    cta: item.cta ?? pickCta(type, seed, history.slice(0, 5).map((past) => past.cta), brand),
    visualMood: DEFAULT_MOOD[type],
    topic: item.topic ?? item.headline.slice(0, 40),
  };
}
