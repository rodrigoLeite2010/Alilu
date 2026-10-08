/**
 * Detector de viés temático: pega texto que fala de criação de conteúdo,
 * redes sociais ou produtividade de criador quando o tema NÃO é esse. Puro.
 */
const BIAS_PATTERNS: ReadonlyArray<{ label: string; re: RegExp }> = [
  { label: "criador de conteúdo", re: /\bcriador(?:es|a|as)? de conteudo\b|\bcontent creators?\b|\bcreators?\b/ },
  { label: "criar/produzir conteúdo", re: /\b(?:criar|criacao de|producao de|produzir|postar|publicar)\s+(?:novo\s+)?conteudos?\b|\bideias? de conteudo\b|\bconteudo digital\b/ },
  { label: "redes sociais", re: /\bredes? sociais?\b|\bsocial media\b|\binstagram\b|\btiktok\b|\breels\b|\bstories\b|\bfeed\b/ },
  { label: "algoritmo/engajamento", re: /\balgoritmos?\b|\bengajamento\b|\bviraliz\w*\b|\bviral\b|\bseguidores\b/ },
  { label: "roteiro/carrossel/legenda", re: /\broteiros?\b|\bcarrossel\b|\bcarrosseis\b|\bcalendario editorial\b|\bhashtags?\b/ },
  { label: "postar todo dia", re: /\bpostar todo dia\b|\bpostar todos os dias\b|\bpostar diariamente\b/ },
];

function plain(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/** Rótulos dos grupos de termos encontrados (vazio = sem viés). */
export function findCreatorBias(text: string): string[] {
  const normalized = plain(text);
  return BIAS_PATTERNS.filter((pattern) => pattern.re.test(normalized)).map((pattern) => pattern.label);
}
