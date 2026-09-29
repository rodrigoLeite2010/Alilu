/**
 * Catálogo da categoria "Loterias".
 *
 * Mantido separado de data/categories.ts e data/tools.ts pelo mesmo motivo
 * de data/instagram.ts: esta categoria vive em uma URL própria (/loterias),
 * fora de /utilitarios/[categoria]/[ferramenta]. Nome, descrição e URLs
 * ficam centralizados aqui — nenhum componente deve duplicá-los.
 */

export const LOTTERIES_CATEGORY = {
  id: "loterias",
  name: "Loterias",
  shortName: "Loterias",
  path: "/loterias",
  title: "Gerador Estatístico de Jogos de Loteria",
  subtitle:
    "Monte jogos organizados por critérios matemáticos e estatísticos — grátis e sem cadastro. Nenhuma ferramenta aqui prevê resultado de sorteio.",
  description:
    "Ferramentas gratuitas para organizar jogos das principais loterias brasileiras usando estatística e combinatória, nunca previsão de sorteio.",
  metaTitle: "Loterias: Gerador de Jogos Grátis | ALILU",
  metaDescription:
    "Gere e organize jogos de loteria usando filtros estatísticos e matemáticos, grátis e sem cadastro. Comece pela Lotofácil.",
  icon: "ticket",
} as const;

export interface LotteryModality {
  id: string;
  name: string;
  shortName: string;
  path: string;
  description: string;
  icon: string;
  status: "ativo" | "em-breve";
}

/**
 * Modalidades da categoria. Só a Lotofácil está implementada por enquanto
 * (status "ativo") — as demais aparecem no catálogo/menu como "Em breve",
 * seguindo o mesmo padrão de ferramenta "em-breve" já usado no resto do
 * site (acessível, mas sem link para uma página que ainda não existe).
 */
export const lotteryModalities: LotteryModality[] = [
  {
    id: "lotofacil",
    name: "Gerador Estatístico da Lotofácil",
    shortName: "Lotofácil",
    path: "/loterias/lotofacil",
    description:
      "Monte jogos de 15 a 20 números com filtros de pares/ímpares, primos e distribuição no volante — grátis e sem cadastro.",
    icon: "ticket",
    status: "ativo",
  },
  {
    id: "mega-sena",
    name: "Gerador Estatístico da Mega-Sena",
    shortName: "Mega-Sena",
    path: "/loterias/mega-sena",
    description: "Em breve: gerador estatístico de jogos da Mega-Sena.",
    icon: "ticket",
    status: "em-breve",
  },
  {
    id: "quina",
    name: "Gerador Estatístico da Quina",
    shortName: "Quina",
    path: "/loterias/quina",
    description: "Em breve: gerador estatístico de jogos da Quina.",
    icon: "ticket",
    status: "em-breve",
  },
  {
    id: "lotomania",
    name: "Gerador Estatístico da Lotomania",
    shortName: "Lotomania",
    path: "/loterias/lotomania",
    description: "Em breve: gerador estatístico de jogos da Lotomania.",
    icon: "ticket",
    status: "em-breve",
  },
  {
    id: "dia-de-sorte",
    name: "Gerador Estatístico do Dia de Sorte",
    shortName: "Dia de Sorte",
    path: "/loterias/dia-de-sorte",
    description: "Em breve: gerador estatístico de jogos do Dia de Sorte.",
    icon: "ticket",
    status: "em-breve",
  },
];

export function getLotteryModalityByPath(path: string): LotteryModality | undefined {
  return lotteryModalities.find((modality) => modality.path === path);
}
