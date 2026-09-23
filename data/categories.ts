/**
 * Catálogo central de categorias do ALILU UTILITÁRIOS.
 *
 * Este é o único lugar onde as categorias são definidas. Páginas, navegação
 * e SEO devem sempre ler daqui — nunca duplicar esses dados em componentes.
 */

export type CategoryId =
  | "trabalho"
  | "financeiro"
  | "empresa"
  | "outros"
  | "pdf"
  | "geradores"
  | "validadores"
  | "funcoes-string"
  | "rede-internet"
  | "conversor-base64";

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
  {
    id: "pdf",
    name: "PDF",
    description:
      "Ferramentas para organizar e trabalhar com documentos PDF diretamente no navegador.",
    icon: "file-pdf",
  },
  {
    // Antiga categoria "Devs" (id "devs"): renomeada para "Geradores" para
    // acolher um catálogo bem mais amplo de geradores de dados sintéticos,
    // textos, números e símbolos — não só ferramentas voltadas a devs/QA.
    // As 3 ferramentas que já existiam aqui (CPF, CNPJ, Cartão de Crédito)
    // foram preservadas, só passando a apontar para o novo id de categoria.
    id: "geradores",
    name: "Geradores",
    description:
      "Ferramentas gratuitas para gerar dados sintéticos, textos, números, símbolos e informações úteis para testes, produtividade e uso no dia a dia.",
    icon: "dices",
  },
  {
    // Categoria nova: valida o FORMATO e os dígitos verificadores de
    // documentos e números brasileiros (CPF, CNPJ, cartão de crédito etc.)
    // — nunca consulta Receita Federal, DETRAN, bancos ou qualquer base de
    // dados de pessoas, e não confirma que o documento pertence a alguém.
    id: "validadores",
    name: "Validadores",
    description:
      "Valide gratuitamente o formato e os dígitos verificadores de CPF, CNPJ, cartão de crédito e outros documentos brasileiros — 100% no seu navegador, sem consultar bases de dados.",
    icon: "shield-check",
  },
  {
    id: "funcoes-string",
    name: "Funções String",
    description:
      "Ferramentas gratuitas para manipular, formatar, analisar e transformar textos diretamente no navegador.",
    icon: "align-left",
  },
  {
    id: "rede-internet",
    name: "Rede e Internet",
    description:
      "Ferramentas rápidas para identificar informações básicas da sua conexão, navegador e dispositivo.",
    icon: "globe",
  },
  {
    // Conversões de e para Base64 feitas 100% no navegador: nenhum texto,
    // arquivo ou Base64 é enviado ao servidor.
    id: "conversor-base64",
    name: "Conversor Base64",
    description:
      "Converta textos, arquivos, imagens, PDFs, vídeos, áudios e outros conteúdos de e para Base64.",
    icon: "binary",
  },
];

export function getCategoryById(id: string): Category | undefined {
  return categories.find((category) => category.id === id);
}
