/**
 * Catálogo central de categorias do ALILU UTILITÁRIOS.
 *
 * Este é o único lugar onde as categorias são definidas. Páginas, navegação
 * e SEO devem sempre ler daqui — nunca duplicar esses dados em componentes.
 */

export type CategoryId = "trabalho" | "financeiro" | "empresa" | "outros";

export interface Category {
  /** Identificador estável, também usado como slug de URL (/utilitarios/[slug]) */
  id: CategoryId;
  /** Nome de exibição */
  name: string;
  /** Curta descrição usada em listagens e meta description */
  description: string;
  /** Nome de ícone (chave usada por components/ui/Icon.tsx) */
  icon: string;
}

export const categories: Category[] = [
  {
    id: "trabalho",
    name: "Trabalho",
    description:
      "Calculadoras trabalhistas: rescisão, salário líquido, férias, 13º e hora extra.",
    icon: "briefcase",
  },
  {
    id: "financeiro",
    name: "Financeiro",
    description:
      "Ferramentas financeiras: juros compostos, financiamento de veículo, SAC x Price e parcelamento.",
    icon: "coins",
  },
  {
    id: "empresa",
    name: "Empresa",
    description:
      "Ferramentas para o dia a dia de quem empreende: recibos, orçamentos, markup e margem de lucro.",
    icon: "building",
  },
  {
    id: "outros",
    name: "Utilidades",
    description:
      "Utilidades do dia a dia: dias úteis, porcentagem, QR Code, leitura de XML de NF-e e divisão de despesas.",
    icon: "sparkles",
  },
];

export function getCategoryById(id: string): Category | undefined {
  return categories.find((category) => category.id === id);
}
