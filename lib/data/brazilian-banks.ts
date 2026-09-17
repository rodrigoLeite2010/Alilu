/**
 * Catálogo de códigos de instituições financeiras brasileiras (código
 * COMPE de 3 dígitos usado em TED, DOC e cadastro de conta bancária), para
 * a ferramenta de consulta (categoria Utilidades).
 *
 * ESCOPO: esta lista cobre os bancos, fintechs e cooperativas mais
 * conhecidos e consultados no dia a dia — não é a tabela completa do Banco
 * Central (que tem centenas de instituições, muitas delas de uso interno
 * entre bancos, sem código de compensação de uso público). Os códigos
 * abaixo são códigos de compensação (COMPE) amplamente documentados e
 * estáveis. Esta ferramenta não consulta o Banco Central em tempo real —
 * para a lista oficial completa e sempre atualizada, a fonte primária é o
 * Banco Central do Brasil, em https://www.bcb.gov.br.
 *
 * Estrutura pensada para atualização futura: cada entrada é independente,
 * então adicionar, corrigir ou remover um banco é uma alteração isolada,
 * sem tocar em nenhuma outra parte do projeto.
 */

export interface BrazilianBank {
  code: string;
  name: string;
  /** Nome popular/curto, quando diferente da razão social — ajuda a busca. */
  shortName?: string;
}

export const BRAZILIAN_BANKS: BrazilianBank[] = [
  { code: "001", name: "Banco do Brasil S.A." },
  { code: "003", name: "Banco da Amazônia S.A." },
  { code: "004", name: "Banco do Nordeste do Brasil S.A." },
  { code: "021", name: "Banco Banestes S.A." },
  { code: "025", name: "Banco Alfa S.A." },
  { code: "033", name: "Banco Santander (Brasil) S.A.", shortName: "Santander" },
  { code: "037", name: "Banco do Estado do Pará S.A.", shortName: "Banpará" },
  { code: "041", name: "Banco do Estado do Rio Grande do Sul S.A.", shortName: "Banrisul" },
  { code: "062", name: "Hipercard Banco Múltiplo S.A." },
  { code: "070", name: "BRB — Banco de Brasília S.A." },
  { code: "077", name: "Banco Inter S.A." },
  { code: "102", name: "XP Investimentos CCTVM S.A." },
  { code: "104", name: "Caixa Econômica Federal" },
  { code: "121", name: "Banco Agibank S.A." },
  { code: "197", name: "Stone Pagamentos S.A." },
  { code: "208", name: "Banco BTG Pactual S.A." },
  { code: "212", name: "Banco Original S.A." },
  { code: "218", name: "Banco BS2 S.A." },
  { code: "237", name: "Banco Bradesco S.A." },
  { code: "246", name: "Banco ABC Brasil S.A." },
  { code: "260", name: "Nu Pagamentos S.A.", shortName: "Nubank" },
  { code: "290", name: "PagSeguro Internet S.A.", shortName: "PagBank" },
  { code: "318", name: "Banco BMG S.A." },
  { code: "323", name: "Mercado Pago — Conta do Mercado Livre" },
  { code: "336", name: "Banco C6 S.A.", shortName: "C6 Bank" },
  { code: "341", name: "Itaú Unibanco S.A." },
  { code: "380", name: "PicPay Servicos S.A." },
  { code: "403", name: "Cora Sociedade de Crédito Direto S.A." },
  { code: "422", name: "Banco Safra S.A." },
  { code: "461", name: "Asaas Gestão Financeira S.A." },
  { code: "623", name: "Banco Pan S.A." },
  { code: "655", name: "Banco Votorantim S.A." },
  { code: "707", name: "Banco Daycoval S.A." },
  { code: "745", name: "Banco Citibank S.A." },
  { code: "746", name: "Banco Modal S.A." },
  { code: "748", name: "Banco Cooperativo Sicredi S.A.", shortName: "Sicredi" },
  { code: "756", name: "Banco Cooperativo do Brasil S.A.", shortName: "Sicoob" },
];

export function searchBrazilianBanks(query: string): BrazilianBank[] {
  const normalized = query
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

  if (!normalized) {
    return BRAZILIAN_BANKS;
  }

  return BRAZILIAN_BANKS.filter((bank) => {
    const haystack = `${bank.code} ${bank.name} ${bank.shortName ?? ""}`
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase();
    return haystack.includes(normalized);
  });
}
