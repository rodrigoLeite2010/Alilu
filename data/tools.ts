import type { CategoryId } from "./categories";

/**
 * Catálogo central de ferramentas do ALILU UTILITÁRIOS.
 *
 * Metadados de cada ferramenta ficam centralizados aqui (ver PROMPT MESTRE,
 * seção 5). Nenhum componente deve duplicar nome, slug, descrição ou
 * palavras-chave de uma ferramenta — tudo deve ser lido a partir deste
 * arquivo.
 *
 * A maior parte das ferramentas ainda está com status "em-breve": a
 * arquitetura e o catálogo já existem, mas a lógica de cálculo será
 * implementada em etapas futuras. Cada ferramenta muda para "ativo" (e só
 * então ganha uma interface real) na etapa em que é implementada — ver
 * components/tools/tool-registry.tsx para o componente real de cada uma.
 *
 * O status também controla a indexação da ferramenta pelos buscadores — ver
 * lib/seo/publish.ts para a regra central. Resumo:
 *   "em-breve" -> acessível, mas noindex e fora do sitemap.
 *   "ativo"    -> indexável e presente no sitemap.
 */

export type ToolStatus = "em-breve" | "ativo";

export interface Tool {
  /** Identificador estável e único do catálogo */
  id: string;
  /** Nome completo exibido em H1 e títulos */
  name: string;
  /** Nome curto para cards e navegação */
  shortName: string;
  /** Slug de URL, único dentro da categoria: /utilitarios/[category]/[slug] */
  slug: string;
  /** Categoria à qual a ferramenta pertence */
  category: CategoryId;
  /** Descrição curta usada em cards, meta description e listagens */
  description: string;
  /** Palavras-chave para busca interna e SEO */
  keywords: string[];
  /** Nome de ícone (chave usada por components/ui/Icon.tsx) */
  icon: string;
  /** IDs de outras ferramentas relacionadas, para a seção "Ferramentas relacionadas" */
  relatedTools: string[];
  /** Estado de desenvolvimento da ferramenta */
  status: ToolStatus;
}

export const tools: Tool[] = [
  // TRABALHO
  {
    id: "calculadora-rescisao",
    name: "Calculadora de Rescisão",
    shortName: "Rescisão",
    slug: "calculadora-rescisao",
    category: "trabalho",
    description:
      "Estime as verbas rescisórias de um contrato de trabalho, incluindo aviso prévio, férias e 13º proporcionais.",
    keywords: ["rescisão", "verbas rescisórias", "demissão", "aviso prévio", "trabalhista"],
    icon: "file-text",
    relatedTools: ["salario-liquido", "calculadora-ferias", "decimo-terceiro"],
    status: "em-breve",
  },
  {
    id: "salario-liquido",
    name: "Calculadora de Salário Líquido",
    shortName: "Salário Líquido",
    slug: "salario-liquido",
    category: "trabalho",
    description:
      "Calcule o salário líquido a partir do salário bruto, com descontos de INSS e IRRF.",
    keywords: ["salário líquido", "salário bruto", "inss", "irrf", "holerite"],
    icon: "wallet",
    relatedTools: ["calculadora-rescisao", "hora-extra", "decimo-terceiro"],
    status: "em-breve",
  },
  {
    id: "calculadora-ferias",
    name: "Calculadora de Férias",
    shortName: "Férias",
    slug: "calculadora-ferias",
    category: "trabalho",
    description:
      "Simule o valor das férias, incluindo o terço constitucional e o abono pecuniário.",
    keywords: ["férias", "terço constitucional", "abono pecuniário", "trabalhista"],
    icon: "sun",
    relatedTools: ["calculadora-rescisao", "salario-liquido", "decimo-terceiro"],
    status: "em-breve",
  },
  {
    id: "decimo-terceiro",
    name: "Calculadora de 13º Salário",
    shortName: "13º Salário",
    slug: "decimo-terceiro",
    category: "trabalho",
    description:
      "Calcule o valor da primeira e da segunda parcela do 13º salário, com os principais descontos.",
    keywords: ["décimo terceiro", "13º salário", "gratificação natalina"],
    icon: "gift",
    relatedTools: ["salario-liquido", "calculadora-ferias", "calculadora-rescisao"],
    status: "em-breve",
  },
  {
    id: "hora-extra",
    name: "Calculadora de Hora Extra",
    shortName: "Hora Extra",
    slug: "hora-extra",
    category: "trabalho",
    description:
      "Calcule o valor da hora extra com adicional de 50% ou 100% sobre o salário.",
    keywords: ["hora extra", "adicional noturno", "banco de horas", "trabalhista"],
    icon: "clock",
    relatedTools: ["salario-liquido", "dias-uteis"],
    status: "em-breve",
  },

  // FINANCEIRO
  {
    id: "juros-compostos",
    name: "Calculadora de Juros Compostos",
    shortName: "Juros Compostos",
    slug: "juros-compostos",
    category: "financeiro",
    description:
      "Simule a evolução de um investimento ou dívida com juros compostos ao longo do tempo.",
    keywords: ["juros compostos", "investimento", "simulador financeiro"],
    icon: "trending-up",
    relatedTools: ["quanto-guardar-por-mes", "parcelamento", "financiamento-veiculo"],
    status: "em-breve",
  },
  {
    id: "financiamento-veiculo",
    name: "Calculadora de Financiamento de Veículo",
    shortName: "Financiamento de Veículo",
    slug: "financiamento-veiculo",
    category: "financeiro",
    description:
      "Simule as parcelas de um financiamento de veículo e o custo total do financiamento.",
    keywords: ["financiamento", "financiamento de veículo", "parcelas", "simulador"],
    icon: "car",
    relatedTools: ["sac-x-price", "juros-compostos", "parcelamento"],
    status: "em-breve",
  },
  {
    id: "sac-x-price",
    name: "Comparador SAC x Price",
    shortName: "SAC x Price",
    slug: "sac-x-price",
    category: "financeiro",
    description:
      "Compare os sistemas de amortização SAC e Price para escolher o mais vantajoso para você.",
    keywords: ["sac", "price", "amortização", "financiamento", "comparador"],
    icon: "scale",
    relatedTools: ["financiamento-veiculo", "juros-compostos"],
    status: "em-breve",
  },
  {
    id: "parcelamento",
    name: "Calculadora de Parcelamento",
    shortName: "Parcelamento",
    slug: "parcelamento",
    category: "financeiro",
    description:
      "Calcule o valor das parcelas com ou sem juros e o custo total de uma compra parcelada.",
    keywords: ["parcelamento", "parcelas", "juros", "compras"],
    icon: "credit-card",
    relatedTools: ["juros-compostos", "financiamento-veiculo"],
    status: "em-breve",
  },
  {
    id: "quanto-guardar-por-mes",
    name: "Quanto Guardar por Mês",
    shortName: "Quanto Guardar",
    slug: "quanto-guardar-por-mes",
    category: "financeiro",
    description:
      "Descubra quanto guardar por mês para atingir uma meta financeira em um prazo definido.",
    keywords: ["meta financeira", "poupança", "planejamento financeiro"],
    icon: "piggy-bank",
    relatedTools: ["juros-compostos", "divisao-de-despesas"],
    status: "em-breve",
  },

  // EMPRESA
  {
    id: "gerador-recibo",
    name: "Gerador de Recibo Online Grátis",
    shortName: "Gerador de Recibo",
    slug: "gerador-recibo",
    category: "empresa",
    description:
      "Crie recibos online gratuitamente. Preencha os dados do pagamento, gere seu recibo e imprima ou salve em PDF diretamente no navegador.",
    keywords: ["recibo", "gerador de recibo", "comprovante de pagamento"],
    icon: "receipt",
    relatedTools: ["gerador-orcamento", "custo-funcionario"],
    status: "ativo",
  },
  {
    id: "gerador-orcamento",
    name: "Gerador de Orçamento",
    shortName: "Gerador de Orçamento",
    slug: "gerador-orcamento",
    category: "empresa",
    description:
      "Monte orçamentos profissionais com itens, quantidades e valores, prontos para enviar ao cliente.",
    keywords: ["orçamento", "gerador de orçamento", "proposta comercial"],
    icon: "clipboard-list",
    relatedTools: ["gerador-recibo", "markup", "margem-de-lucro"],
    status: "em-breve",
  },
  {
    id: "markup",
    name: "Calculadora de Markup",
    shortName: "Markup",
    slug: "markup",
    category: "empresa",
    description:
      "Calcule o markup ideal para formar o preço de venda de um produto ou serviço.",
    keywords: ["markup", "precificação", "formação de preço"],
    icon: "tag",
    relatedTools: ["margem-de-lucro", "gerador-orcamento"],
    status: "em-breve",
  },
  {
    id: "margem-de-lucro",
    name: "Calculadora de Margem de Lucro",
    shortName: "Margem de Lucro",
    slug: "margem-de-lucro",
    category: "empresa",
    description:
      "Calcule a margem de lucro de um produto ou serviço a partir do custo e do preço de venda.",
    keywords: ["margem de lucro", "lucratividade", "precificação"],
    icon: "percent",
    relatedTools: ["markup", "custo-funcionario"],
    status: "em-breve",
  },
  {
    id: "custo-funcionario",
    name: "Calculadora de Custo de Funcionário",
    shortName: "Custo de Funcionário",
    slug: "custo-funcionario",
    category: "empresa",
    description:
      "Estime o custo total de um funcionário para a empresa, além do salário bruto.",
    keywords: ["custo de funcionário", "encargos trabalhistas", "folha de pagamento"],
    icon: "users",
    relatedTools: ["gerador-recibo", "margem-de-lucro"],
    status: "em-breve",
  },

  // UTILIDADES (slug de categoria: "outros")
  {
    id: "dias-uteis",
    name: "Calculadora de Dias Úteis",
    shortName: "Dias Úteis",
    slug: "dias-uteis",
    category: "outros",
    description:
      "Calcule quantos dias úteis existem entre duas datas, descontando fins de semana.",
    keywords: ["dias úteis", "contagem de dias", "calendário"],
    icon: "calendar",
    relatedTools: ["hora-extra", "porcentagem"],
    status: "em-breve",
  },
  {
    id: "porcentagem",
    name: "Calculadora de Porcentagem",
    shortName: "Porcentagem",
    slug: "porcentagem",
    category: "outros",
    description:
      "Calcule porcentagens, aumentos, descontos e a variação percentual entre dois valores.",
    keywords: ["porcentagem", "percentual", "desconto", "aumento"],
    icon: "percent",
    relatedTools: ["margem-de-lucro", "divisao-de-despesas"],
    status: "em-breve",
  },
  {
    id: "qr-code",
    name: "Gerador de QR Code",
    shortName: "QR Code",
    slug: "qr-code",
    category: "outros",
    description:
      "Gere um QR Code gratuito a partir de um link, texto ou informação de contato.",
    keywords: ["qr code", "gerador de qr code", "código qr"],
    icon: "qr-code",
    relatedTools: ["gerador-recibo"],
    status: "em-breve",
  },
  {
    id: "leitor-xml-nfe",
    name: "Leitor de XML de NF-e",
    shortName: "Leitor XML NF-e",
    slug: "leitor-xml-nfe",
    category: "outros",
    description:
      "Leia o XML de uma Nota Fiscal Eletrônica e visualize seus dados de forma organizada.",
    keywords: ["nf-e", "nota fiscal eletrônica", "xml", "leitor de xml"],
    icon: "file-code",
    relatedTools: ["gerador-recibo", "gerador-orcamento"],
    status: "em-breve",
  },
  {
    id: "divisao-de-despesas",
    name: "Divisão de Despesas",
    shortName: "Divisão de Despesas",
    slug: "divisao-de-despesas",
    category: "outros",
    description:
      "Divida contas e despesas entre um grupo de pessoas de forma justa e simples.",
    keywords: ["divisão de despesas", "rachar conta", "despesas em grupo"],
    icon: "users-round",
    relatedTools: ["quanto-guardar-por-mes", "porcentagem"],
    status: "em-breve",
  },
];

export function getToolBySlug(
  category: string,
  slug: string
): Tool | undefined {
  return tools.find((tool) => tool.category === category && tool.slug === slug);
}

export function getToolsByCategory(category: string): Tool[] {
  return tools.filter((tool) => tool.category === category);
}

export function getRelatedTools(tool: Tool, limit = 3): Tool[] {
  return tool.relatedTools
    .map((id) => tools.find((candidate) => candidate.id === id))
    .filter((candidate): candidate is Tool => Boolean(candidate))
    .slice(0, limit);
}
