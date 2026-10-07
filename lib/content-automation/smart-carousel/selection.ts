/**
 * Escolhas automáticas do Carrossel Inteligente no Piloto: tema (a partir da
 * categoria), template e detecção de repetição. Funções PURAS e determinísticas
 * (sem banco, sem IA) — o histórico entra como parâmetro.
 */
export type ThemeCategory = "MOTIVACIONAL" | "FINANCEIRO" | "UTILIDADES" | "CURIOSIDADE" | "DIVULGACAO" | "PERSONALIZADO";

export const THEME_POOLS: Record<ThemeCategory, readonly string[]> = {
  FINANCEIRO: [
    "Como montar um orçamento mensal que funciona",
    "Reserva de emergência: quanto guardar e onde",
    "Erros que mantêm você endividado",
    "Como sair do cartão de crédito rotativo",
    "Regra 50-30-20 na prática",
    "Como negociar uma dívida sem cair em armadilhas",
    "Juros compostos explicados com exemplos simples",
    "Gastos invisíveis que drenam seu salário",
    "Como começar a investir com pouco dinheiro",
    "Planejamento financeiro para o ano que vem",
    "Assinaturas esquecidas: como cortar sem sofrer",
    "Como ensinar finanças para crianças",
  ],
  MOTIVACIONAL: [
    "Pequenos hábitos que mudam a sua rotina",
    "Como recomeçar depois de um erro",
    "Disciplina vence motivação",
    "Como manter o foco em dias difíceis",
    "O poder de dar o primeiro passo",
    "Como parar de procrastinar",
    "Como transformar fracasso em aprendizado",
    "Gratidão e clareza para tomar decisões",
    "Como criar uma rotina matinal sustentável",
    "Metas pequenas, resultados grandes",
  ],
  UTILIDADES: [
    "Atalhos úteis que economizam seu tempo",
    "Como organizar seus documentos digitais",
    "Como proteger suas senhas e contas",
    "Ferramentas gratuitas que facilitam o dia a dia",
    "Como identificar golpes comuns no celular",
    "Como organizar suas tarefas da semana",
    "Como economizar na conta de luz e água",
    "Checklist para conferir antes de assinar um contrato",
    "Como fazer boas planilhas pessoais",
    "Como converter e compactar arquivos sem perder qualidade",
  ],
  CURIOSIDADE: [
    "Curiosidades sobre dinheiro que poucos conhecem",
    "De onde vieram as moedas e as notas",
    "Fatos surpreendentes sobre o cérebro e as decisões",
    "Mitos sobre dinheiro que ainda enganam muita gente",
    "Como funcionam os juros do cartão por dentro",
    "Curiosidades sobre o Pix e os pagamentos digitais",
    "Por que gastamos mais do que planejamos",
    "Hábitos de pessoas que constroem patrimônio",
  ],
  DIVULGACAO: [
    "Conheça as ferramentas gratuitas da Alilu",
    "Como a Alilu ajuda você a organizar suas finanças",
    "Calculadoras e geradores úteis que você pode usar hoje",
    "Três utilidades da Alilu que você ainda não usou",
    "Do PDF à planilha: o que dá para fazer na Alilu",
  ],
  PERSONALIZADO: [],
};

/** Preferência de template (ids de CAROUSEL_TEMPLATES) por categoria; o primeiro livre da lista ganha. */
export const TEMPLATE_PREFERENCE: Record<ThemeCategory, readonly string[]> = {
  FINANCEIRO: ["alilu-petroleo", "alilu-areia", "alilu-editorial", "alilu-noite"],
  MOTIVACIONAL: ["alilu-solar", "alilu-noite", "alilu-menta", "alilu-petroleo"],
  UTILIDADES: ["alilu-menta", "alilu-areia", "alilu-petroleo", "alilu-editorial"],
  CURIOSIDADE: ["alilu-editorial", "alilu-noite", "alilu-solar", "alilu-menta"],
  DIVULGACAO: ["alilu-petroleo", "alilu-solar", "alilu-menta", "alilu-areia"],
  PERSONALIZADO: ["alilu-petroleo", "alilu-areia", "alilu-menta", "alilu-solar", "alilu-editorial", "alilu-noite"],
};

export function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const STOPWORDS = new Set(["de", "da", "do", "das", "dos", "a", "o", "as", "os", "e", "em", "um", "uma", "para", "com", "que", "na", "no", "como", "por", "seu", "sua"]);

function tokens(value: string): Set<string> {
  return new Set(normalizeText(value).split(" ").filter((word) => word.length > 2 && !STOPWORDS.has(word)));
}

/** Similaridade de Jaccard (0..1) entre os termos significativos de dois textos. */
export function textSimilarity(a: string, b: string): number {
  const left = tokens(a);
  const right = tokens(b);
  if (left.size === 0 || right.size === 0) return normalizeText(a) === normalizeText(b) ? 1 : 0;
  let inter = 0;
  for (const word of left) if (right.has(word)) inter += 1;
  return inter / (left.size + right.size - inter);
}

export const REPEAT_THRESHOLD = 0.7;

export function findRepeat(text: string, previous: readonly string[], threshold = REPEAT_THRESHOLD): string | null {
  for (const candidate of previous) {
    if (candidate.trim() && textSimilarity(text, candidate) >= threshold) return candidate;
  }
  return null;
}

function hash(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Tema automático: primeiro tema do banco da categoria que NÃO repete os recentes
 * (começando de um ponto determinístico pela semente = execução). Esgotado o banco,
 * devolve o menos recente (nunca trava). PERSONALIZADO sem banco usa o nicho.
 */
export function pickTheme(input: { category: ThemeCategory | null; recentTopics: readonly string[]; seed: string; niche?: string | null }): { topic: string; exhausted: boolean } {
  const pool = THEME_POOLS[input.category ?? "PERSONALIZADO"];
  if (pool.length === 0) {
    const niche = input.niche?.trim();
    if (!niche) throw new Error("Defina o tema ou o nicho do carrossel.");
    return { topic: niche, exhausted: false };
  }
  const start = hash(input.seed) % pool.length;
  for (let i = 0; i < pool.length; i += 1) {
    const candidate = pool[(start + i) % pool.length];
    if (!findRepeat(candidate, input.recentTopics)) return { topic: candidate, exhausted: false };
  }
  // Banco inteiro dentro da janela: pega o que apareceu há mais tempo (recentTopics vem do mais novo ao mais antigo).
  let oldest = pool[start];
  let oldestIndex = -1;
  for (const candidate of pool) {
    const index = input.recentTopics.findIndex((topic) => textSimilarity(candidate, topic) >= REPEAT_THRESHOLD);
    if (index > oldestIndex) {
      oldestIndex = index;
      oldest = candidate;
    }
  }
  return { topic: oldest, exhausted: true };
}

/** Template automático: respeita a preferência da categoria e evita os usados recentemente. */
export function pickTemplate(input: { category: ThemeCategory | null; recentTemplateIds: readonly string[]; available: readonly string[] }): string {
  const order = TEMPLATE_PREFERENCE[input.category ?? "PERSONALIZADO"].filter((id) => input.available.includes(id));
  const ranked = order.length > 0 ? order : [...input.available];
  const avoid = input.recentTemplateIds.slice(0, Math.min(2, Math.max(0, ranked.length - 1)));
  return ranked.find((id) => !avoid.includes(id)) ?? ranked[0];
}

/** Assinatura da combinação de imagens (ordem não importa). */
export function imageCombination(photoIds: readonly string[]): string {
  return [...photoIds].sort().join("|");
}
