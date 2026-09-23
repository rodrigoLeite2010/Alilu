import type { CategoryId } from "./categories";

/**
 * Catálogo central de ferramentas do ALILU UTILITÁRIOS.
 *
 * Metadados de cada ferramenta ficam centralizados aqui (ver PROMPT MESTRE,
 * seção 5). Nenhum componente deve duplicar nome, slug, descrição ou
 * palavras-chave de uma ferramenta — tudo deve ser lido a partir deste
 * arquivo.
 *
 * Toda ferramenta nasce com status "em-breve": a arquitetura e o catálogo
 * (nome, slug, descrição, categoria) já existem desde o início, mas a
 * lógica de cálculo e a interface real são implementadas depois. Cada
 * ferramenta só muda para "ativo" quando sua implementação foi corrigida,
 * testada e validada — ver components/tools/tool-registry.tsx para o
 * componente real de cada uma. NÃO documente aqui quantas ferramentas estão
 * em cada status — essa contagem muda a cada etapa e fica desatualizada
 * rápido; para saber o número atual, filtre este arquivo por `status`.
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
  /** Descrição curta usada em cards, listagens e como fallback da metadata */
  description: string;
  /** Texto de apoio exibido abaixo do H1 quando difere da descrição do card */
  pageDescription?: string;
  /** Descrição específica para metadata quando precisa diferir do texto do card */
  metaDescription?: string;
  /** Título específico para metadata (<title>) quando precisa diferir do H1 */
  metaTitle?: string;
  /** Palavras-chave para busca interna e SEO */
  keywords: string[];
  /** Nome de ícone (chave usada por components/ui/Icon.tsx) */
  icon: string;
  /**
   * Prioridade editorial para áreas de destaque. Valores menores aparecem
   * antes; a propriedade não representa métricas de audiência.
   */
  featureRank?: number;
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
    status: "ativo",
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
    status: "ativo",
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
    status: "ativo",
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
    status: "ativo",
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
    status: "ativo",
  },

  // FINANCEIRO
  {
    id: "juros-compostos",
    name: "Calculadora de Juros Compostos",
    shortName: "Juros Compostos",
    slug: "juros-compostos",
    category: "financeiro",
    description:
      "Calcule juros compostos, aportes mensais e veja quanto seu dinheiro pode acumular ao longo do tempo.",
    keywords: ["juros compostos", "investimento", "simulador financeiro"],
    icon: "trending-up",
    relatedTools: ["quanto-guardar-por-mes", "parcelamento", "financiamento-veiculo"],
    status: "ativo",
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
    status: "ativo",
  },
  {
    // Nota (ETAPA 4): este era o item "Comparador SAC x Price" do catálogo
    // (slug "sac-x-price", ainda "em-breve"). A ETAPA 4 pediu exatamente a
    // rota /utilitarios/financeiro/financiamento-sac-price — como as duas
    // entradas descreveriam a mesma ferramenta (o mesmo simulador SAC x
    // Price), o slug/nome/descrição deste item existente foram atualizados
    // para a rota pedida, em vez de criar um segundo item duplicado no
    // catálogo. O `id` foi mantido para não quebrar relatedTools de outras
    // ferramentas que já referenciavam "sac-x-price". Como o item ainda
    // estava "em-breve" (não indexado, fora do sitemap), a troca de slug
    // não quebra nenhum link já publicado.
    id: "sac-x-price",
    name: "Simulador de Financiamento SAC x Price",
    shortName: "SAC x Price",
    slug: "financiamento-sac-price",
    category: "financeiro",
    description:
      "Simule financiamentos pelos sistemas SAC e Price, compare parcelas, juros, valor total e evolução do saldo devedor.",
    keywords: ["sac", "price", "amortização", "financiamento", "simulador"],
    icon: "scale",
    relatedTools: ["financiamento-veiculo", "juros-compostos"],
    status: "ativo",
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
    status: "ativo",
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
    status: "ativo",
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
    status: "ativo",
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
    status: "ativo",
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
    status: "ativo",
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
    status: "ativo",
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
    status: "ativo",
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
    status: "ativo",
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
    status: "ativo",
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
    status: "ativo",
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
    status: "ativo",
  },
  {
    id: "numero-do-banco",
    name: "Consulta Número do Banco",
    shortName: "Número do Banco",
    slug: "numero-do-banco",
    category: "outros",
    description:
      "Consulte o código de instituição (COMPE) dos principais bancos, fintechs e cooperativas do Brasil pelo nome ou pelo número.",
    keywords: ["número do banco", "código do banco", "bancos do brasil", "código compe"],
    icon: "landmark",
    relatedTools: ["gerador-conta-bancaria", "validador-conta-bancaria", "divisao-de-despesas"],
    status: "ativo",
  },

  // PDF
  {
    id: "unir-pdf",
    name: "Unir PDF Online Grátis",
    shortName: "Unir PDFs",
    slug: "unir-pdf",
    category: "pdf",
    description:
      "Junte vários arquivos PDF em um único documento, gratuitamente e sem instalar programas.",
    pageDescription:
      "Combine dois ou mais arquivos PDF em um único documento. Organize a ordem das páginas e baixe seu arquivo gratuitamente.",
    metaDescription:
      "Una dois ou mais arquivos PDF online e grátis. Organize seus documentos na ordem desejada e baixe um único PDF, sem instalar programas.",
    keywords: [
      "unir pdf",
      "juntar pdf",
      "combinar pdf",
      "mesclar pdf",
      "unir arquivos pdf online",
    ],
    icon: "file-pdf",
    relatedTools: [],
    status: "ativo",
  },
  {
    id: "dividir-pdf",
    name: "Dividir PDF Online Grátis",
    shortName: "Dividir PDF",
    slug: "dividir-pdf",
    category: "pdf",
    description:
      "Extraia páginas ou intervalos de um PDF e baixe os documentos separados diretamente no navegador.",
    pageDescription:
      "Selecione páginas isoladas ou intervalos, escolha entre reuni-las em um PDF ou baixar arquivos separados e processe tudo localmente.",
    metaDescription:
      "Divida um PDF online e grátis. Extraia páginas ou intervalos, reúna em um documento ou baixe arquivos separados, sem instalar programas.",
    keywords: ["dividir pdf", "separar pdf", "extrair páginas pdf", "recortar pdf"],
    icon: "scissors",
    relatedTools: ["unir-pdf", "girar-pdf", "marca-dagua"],
    status: "ativo",
  },
  {
    id: "comprimir-pdf",
    name: "Comprimir PDF",
    shortName: "Comprimir PDF",
    slug: "comprimir-pdf",
    category: "pdf",
    description:
      "Reduza o tamanho de documentos PDF com opções de qualidade e comparação real do resultado.",
    pageDescription:
      "Recrie um PDF com compactação visual local, compare o tamanho original e baixe o novo arquivo sem enviar documentos a servidores.",
    metaDescription:
      "Comprima PDF online e grátis no navegador. Compare o tamanho antes e depois e baixe o resultado sem enviar seu arquivo.",
    keywords: ["comprimir pdf", "reduzir tamanho pdf", "otimizar pdf"],
    icon: "file-text",
    relatedTools: ["unir-pdf", "pdf-para-jpg"],
    status: "ativo",
  },
  {
    id: "pdf-para-word",
    name: "PDF para Word",
    shortName: "PDF para Word",
    slug: "pdf-para-word",
    category: "pdf",
    description:
      "Converta conteúdo de PDF em documento Word editável quando a estrutura do arquivo permitir.",
    pageDescription:
      "Extraia texto selecionável de um PDF para um arquivo DOCX editável diretamente no navegador, com limites claros para documentos digitalizados.",
    metaDescription:
      "Converta PDF para Word online e grátis. Extraia texto selecionável para DOCX no navegador, sem enviar seu documento.",
    keywords: ["pdf para word", "converter pdf word", "pdf para docx"],
    icon: "file-text",
    relatedTools: ["word-para-pdf", "pdf-para-excel"],
    status: "ativo",
  },
  {
    id: "pdf-para-powerpoint",
    name: "PDF para PowerPoint",
    shortName: "PDF para PowerPoint",
    slug: "pdf-para-powerpoint",
    category: "pdf",
    description:
      "Converta páginas de PDF em uma apresentação PowerPoint com as limitações explicadas.",
    pageDescription:
      "Transforme cada página de PDF em um slide visual de uma apresentação PPTX gerada no seu navegador.",
    metaDescription:
      "Converta PDF para PowerPoint online e grátis. Gere um PPTX com um slide visual por página, sem enviar arquivos.",
    keywords: ["pdf para powerpoint", "converter pdf pptx", "pdf para ppt"],
    icon: "monitor",
    relatedTools: ["powerpoint-para-pdf", "pdf-para-jpg"],
    status: "ativo",
  },
  {
    id: "pdf-para-excel",
    name: "PDF para Excel",
    shortName: "PDF para Excel",
    slug: "pdf-para-excel",
    category: "pdf",
    description:
      "Extraia tabelas de um PDF para planilhas Excel quando a estrutura do documento permitir.",
    pageDescription:
      "Extraia texto e colunas inferidas de um PDF para abas de uma planilha XLSX criada localmente no navegador.",
    metaDescription:
      "Converta PDF para Excel online e grátis. Extraia texto em abas XLSX no navegador, sem enviar seu arquivo.",
    keywords: ["pdf para excel", "converter pdf xlsx", "extrair tabela pdf"],
    icon: "columns",
    relatedTools: ["excel-para-pdf", "pdf-para-word"],
    status: "ativo",
  },
  {
    id: "word-para-pdf",
    name: "Word para PDF",
    shortName: "Word para PDF",
    slug: "word-para-pdf",
    category: "pdf",
    description:
      "Converta documentos DOCX em PDF com texto e tabelas renderizados localmente no navegador.",
    pageDescription:
      "Transforme um arquivo Word DOCX em PDF no navegador, escolhendo orientação e margens antes de baixar o resultado.",
    metaDescription:
      "Converta Word DOCX para PDF online e grátis. Escolha orientação e margens, sem enviar o documento a servidores.",
    keywords: ["word para pdf", "docx para pdf", "converter word pdf"],
    icon: "file-text",
    relatedTools: ["pdf-para-word", "html-para-pdf"],
    status: "ativo",
  },
  {
    id: "powerpoint-para-pdf",
    name: "PowerPoint para PDF",
    shortName: "PowerPoint para PDF",
    slug: "powerpoint-para-pdf",
    category: "pdf",
    description:
      "Transforme apresentações PPTX em PDF com texto e imagens compatíveis extraídos de cada slide.",
    pageDescription:
      "Converta apresentações PowerPoint PPTX em páginas de PDF localmente, com uma leitura visual por slide.",
    metaDescription:
      "Converta PowerPoint PPTX para PDF online e grátis no navegador, sem enviar sua apresentação a servidores.",
    keywords: ["powerpoint para pdf", "pptx para pdf", "converter powerpoint pdf"],
    icon: "monitor",
    relatedTools: ["pdf-para-powerpoint", "pdf-para-jpg"],
    status: "ativo",
  },
  {
    id: "excel-para-pdf",
    name: "Excel para PDF",
    shortName: "Excel para PDF",
    slug: "excel-para-pdf",
    category: "pdf",
    description:
      "Converta planilhas XLSX em PDF com as células preenchidas organizadas em tabelas de leitura.",
    pageDescription:
      "Transforme abas e células preenchidas de uma planilha XLSX em tabelas de PDF geradas localmente no navegador.",
    metaDescription:
      "Converta Excel XLSX para PDF online e grátis. Gere tabelas de leitura no navegador, sem enviar sua planilha.",
    keywords: ["excel para pdf", "xlsx para pdf", "converter planilha pdf"],
    icon: "columns",
    relatedTools: ["pdf-para-excel", "html-para-pdf"],
    status: "ativo",
  },
  {
    id: "editar-pdf",
    name: "Editar PDF",
    shortName: "Editar PDF",
    slug: "editar-pdf",
    category: "pdf",
    description:
      "Adicione textos e coberturas visuais a um PDF com prévia local antes de baixar o arquivo.",
    pageDescription:
      "Inclua textos ou retângulos visuais em páginas de um PDF e confira o resultado antes do download.",
    metaDescription:
      "Edite PDF online e grátis. Adicione texto ou cobertura visual e confira a prévia no navegador, sem enviar arquivos.",
    keywords: ["editar pdf", "anotar pdf", "adicionar texto pdf"],
    icon: "file-text",
    relatedTools: ["assinar-pdf", "marca-dagua"],
    status: "ativo",
  },
  {
    id: "pdf-para-jpg",
    name: "PDF para JPG",
    shortName: "PDF para JPG",
    slug: "pdf-para-jpg",
    category: "pdf",
    description:
      "Renderize páginas selecionadas de um PDF em imagens JPG e baixe uma ou várias imagens.",
    pageDescription:
      "Escolha as páginas e a qualidade das imagens para transformar a renderização de um PDF em arquivos JPG no seu navegador.",
    metaDescription:
      "Converta páginas de PDF para JPG online e grátis. Escolha as páginas e a qualidade das imagens, sem instalar programas.",
    keywords: ["pdf para jpg", "converter pdf jpg", "pdf para imagem"],
    icon: "image",
    relatedTools: ["jpg-para-pdf", "dividir-pdf", "unir-pdf"],
    status: "ativo",
  },
  {
    id: "jpg-para-pdf",
    name: "JPG para PDF",
    shortName: "JPG para PDF",
    slug: "jpg-para-pdf",
    category: "pdf",
    description:
      "Transforme uma ou mais imagens JPG em PDF, com ordem, tamanho de página, orientação e margens.",
    pageDescription:
      "Organize suas imagens JPG, preserve a proporção e gere um PDF com páginas A4 ou no tamanho original, diretamente no navegador.",
    metaDescription:
      "Converta JPG para PDF online e grátis. Reordene imagens, escolha tamanho de página, orientação e margens antes de baixar.",
    keywords: ["jpg para pdf", "jpeg para pdf", "converter imagem pdf"],
    icon: "image",
    relatedTools: ["pdf-para-jpg", "unir-pdf"],
    status: "ativo",
  },
  {
    id: "assinar-pdf",
    name: "Assinar PDF",
    shortName: "Assinar PDF",
    slug: "assinar-pdf",
    category: "pdf",
    description:
      "Adicione uma assinatura visual desenhada, digitada ou em imagem a um documento PDF.",
    pageDescription:
      "Inclua uma assinatura visual digitada, desenhada ou em imagem em um PDF e confira a prévia local do resultado.",
    metaDescription:
      "Assine PDF online e grátis com assinatura visual digitada, desenhada ou em imagem, sem enviar seu documento.",
    keywords: ["assinar pdf", "assinatura visual pdf", "rubrica pdf"],
    icon: "stamp",
    relatedTools: ["editar-pdf", "marca-dagua"],
    status: "ativo",
  },
  {
    id: "marca-dagua",
    name: "Adicionar Marca d'água ao PDF",
    shortName: "Marca d'água",
    slug: "marca-dagua",
    category: "pdf",
    description:
      "Adicione uma marca d'água de texto ou imagem em páginas selecionadas de um PDF.",
    pageDescription:
      "Escolha texto ou imagem, configure posição, tamanho, rotação, transparência e páginas para aplicar a marca d'água localmente.",
    metaDescription:
      "Adicione marca d'água a um PDF online e grátis. Configure texto ou imagem, posição, tamanho, rotação e transparência.",
    keywords: ["marca d'água pdf", "adicionar marca d'água pdf", "watermark pdf"],
    icon: "stamp",
    relatedTools: ["assinar-pdf", "editar-pdf", "girar-pdf"],
    status: "ativo",
  },
  {
    id: "girar-pdf",
    name: "Girar PDF",
    shortName: "Girar PDF",
    slug: "girar-pdf",
    category: "pdf",
    description:
      "Gire todas as páginas ou apenas páginas selecionadas de um PDF em 90, 180 ou 270 graus.",
    pageDescription:
      "Escolha a rotação, indique se ela vale para todo o documento ou somente páginas selecionadas e baixe o PDF atualizado.",
    metaDescription:
      "Gire páginas de PDF online e grátis em 90, 180 ou 270 graus. Aplique ao documento inteiro ou a páginas escolhidas.",
    keywords: ["girar pdf", "rotacionar pdf", "virar página pdf"],
    icon: "arrow-left-right",
    relatedTools: ["dividir-pdf", "unir-pdf", "marca-dagua"],
    status: "ativo",
  },
  {
    id: "html-para-pdf",
    name: "HTML para PDF",
    shortName: "HTML para PDF",
    slug: "html-para-pdf",
    category: "pdf",
    description:
      "Converta HTML em PDF com controle de página, orientação e margens.",
    pageDescription:
      "Cole HTML local e gere um PDF com orientação e margens escolhidas, sem acesso a URLs externas ou envio de conteúdo.",
    metaDescription:
      "Converta HTML para PDF online e grátis. Cole seu código, escolha a página e gere o arquivo localmente no navegador.",
    keywords: ["html para pdf", "converter html pdf", "gerar pdf html"],
    icon: "code",
    relatedTools: ["word-para-pdf", "excel-para-pdf"],
    status: "ativo",
  },
  {
    id: "desbloquear-pdf",
    name: "Desbloquear PDF",
    shortName: "Desbloquear PDF",
    slug: "desbloquear-pdf",
    category: "pdf",
    description:
      "Remova a proteção de um PDF autorizado usando a senha fornecida pelo proprietário.",
    pageDescription:
      "Remova localmente uma senha de PDF para a qual você possui autorização, usando somente a senha fornecida pelo proprietário.",
    metaDescription:
      "Desbloqueie PDF com uma senha autorizada no navegador. O arquivo e a senha não são enviados a servidores.",
    keywords: ["desbloquear pdf", "remover senha pdf", "pdf protegido"],
    icon: "lock",
    relatedTools: ["proteger-pdf", "unir-pdf"],
    status: "ativo",
  },
  {
    id: "proteger-pdf",
    name: "Proteger PDF com Senha",
    shortName: "Proteger PDF",
    slug: "proteger-pdf",
    category: "pdf",
    description:
      "Proteja um PDF com senha usando criptografia compatível com leitores de PDF.",
    pageDescription:
      "Crie uma proteção AES-256 para abrir um PDF com senha e, opcionalmente, configure permissões de cópia e impressão.",
    metaDescription:
      "Proteja PDF com senha AES-256 no navegador. Crie um PDF protegido sem enviar seu documento a servidores.",
    keywords: ["proteger pdf", "senha pdf", "criptografar pdf"],
    icon: "lock",
    relatedTools: ["desbloquear-pdf", "assinar-pdf"],
    status: "ativo",
  },

  // GERADORES
  {
    id: "gerador-cpf",
    name: "Gerador de CPF para Testes",
    shortName: "Gerador de CPF",
    slug: "gerador-cpf",
    category: "geradores",
    description:
      "Gere números de CPF sintéticos, com dígitos verificadores matematicamente válidos, para testar formulários, máscaras e validações.",
    keywords: [
      "gerador de cpf",
      "cpf para teste",
      "cpf válido",
      "cpf sintético",
      "teste de formulário",
      "qa",
    ],
    icon: "id-card",
    featureRank: 1,
    relatedTools: ["gerador-cnpj", "gerador-cartao-credito"],
    status: "ativo",
  },
  {
    id: "gerador-cnpj",
    name: "Gerador de CNPJ para Testes",
    shortName: "Gerador de CNPJ",
    slug: "gerador-cnpj",
    category: "geradores",
    description:
      "Gere números de CNPJ sintéticos, numérico ou alfanumérico, com dígitos verificadores corretos, para testar formulários e integrações.",
    keywords: [
      "gerador de cnpj",
      "cnpj para teste",
      "cnpj alfanumérico",
      "cnpj válido",
      "cnpj sintético",
      "teste de formulário",
      "qa",
    ],
    icon: "building",
    featureRank: 2,
    relatedTools: ["gerador-cpf", "gerador-cartao-credito"],
    status: "ativo",
  },
  {
    id: "gerador-cartao-credito",
    name: "Gerador de Cartão de Crédito de Teste",
    shortName: "Cartão de Teste",
    slug: "gerador-cartao-credito",
    category: "geradores",
    description:
      "Gere números de cartão sintéticos, válidos pelo algoritmo de Luhn, para testar máscaras e validações de formulário. Não são cartões reais.",
    keywords: [
      "gerador de cartão de crédito",
      "cartão de teste",
      "algoritmo de luhn",
      "número de cartão para teste",
      "teste de formulário",
      "qa",
    ],
    icon: "credit-card",
    relatedTools: ["gerador-cpf", "gerador-cnpj"],
    status: "ativo",
  },

  // GERADORES — FASE B: geradores com algoritmo de dígito verificador real
  {
    id: "gerador-pis-pasep",
    name: "Gerador de PIS/PASEP para Testes",
    shortName: "Gerador de PIS/PASEP",
    slug: "gerador-pis-pasep",
    category: "geradores",
    description:
      "Gere números de PIS/PASEP sintéticos, com dígito verificador matematicamente válido, para testar formulários, máscaras e validações.",
    keywords: [
      "gerador de pis",
      "gerador de pasep",
      "pis pasep para teste",
      "nit sintético",
      "teste de formulário",
      "qa",
    ],
    icon: "fingerprint",
    relatedTools: ["gerador-cnh", "gerador-titulo-eleitor", "gerador-cpf"],
    status: "ativo",
  },
  {
    id: "gerador-renavam",
    name: "Gerador de RENAVAM para Testes",
    shortName: "Gerador de RENAVAM",
    slug: "gerador-renavam",
    category: "geradores",
    description:
      "Gere números de RENAVAM sintéticos, com dígito verificador calculado, para testar formulários e sistemas de cadastro de veículos.",
    keywords: [
      "gerador de renavam",
      "renavam para teste",
      "renavam sintético",
      "teste de formulário",
      "qa",
    ],
    icon: "file-text",
    relatedTools: ["gerador-placa-veiculo", "gerador-cnh"],
    status: "ativo",
  },
  {
    id: "gerador-cnh",
    name: "Gerador de CNH para Testes",
    shortName: "Gerador de CNH",
    slug: "gerador-cnh",
    category: "geradores",
    description:
      "Gere números de CNH sintéticos, com os dois dígitos verificadores calculados pelo algoritmo oficial, para testar formulários e validações.",
    keywords: [
      "gerador de cnh",
      "cnh para teste",
      "cnh sintética",
      "número de cnh",
      "teste de formulário",
      "qa",
    ],
    icon: "id-card",
    relatedTools: ["gerador-pis-pasep", "gerador-renavam", "gerador-titulo-eleitor"],
    status: "ativo",
  },
  {
    id: "gerador-titulo-eleitor",
    name: "Gerador de Título de Eleitor para Testes",
    shortName: "Gerador de Título de Eleitor",
    slug: "gerador-titulo-eleitor",
    category: "geradores",
    description:
      "Gere números de Título de Eleitor sintéticos, por estado, com os dois dígitos verificadores calculados, para testar formulários e validações.",
    keywords: [
      "gerador de título de eleitor",
      "título de eleitor para teste",
      "título de eleitor sintético",
      "teste de formulário",
      "qa",
    ],
    icon: "vote",
    relatedTools: ["gerador-cpf", "gerador-pis-pasep"],
    status: "ativo",
  },
  {
    id: "gerador-placa-veiculo",
    name: "Gerador de Placa de Veículo para Testes",
    shortName: "Gerador de Placa de Veículo",
    slug: "gerador-placa-veiculo",
    category: "geradores",
    description:
      "Gere placas de veículo fictícias nos padrões Mercosul e antigo, para testar formulários, máscaras e validações de cadastro de veículos.",
    keywords: [
      "gerador de placa",
      "placa mercosul",
      "placa de veículo para teste",
      "placa fictícia",
      "teste de formulário",
      "qa",
    ],
    icon: "car",
    relatedTools: ["gerador-renavam"],
    status: "ativo",
  },
  {
    id: "gerador-senha",
    name: "Gerador de Senha Segura",
    shortName: "Gerador de Senha",
    slug: "gerador-senha",
    category: "geradores",
    description:
      "Gere senhas aleatórias fortes, com letras maiúsculas e minúsculas, números e símbolos, com indicador visual de força.",
    keywords: [
      "gerador de senha",
      "senha aleatória",
      "senha segura",
      "criar senha forte",
    ],
    icon: "lock",
    relatedTools: ["gerador-numeros-aleatorios"],
    status: "ativo",
  },
  {
    id: "gerador-numeros-aleatorios",
    name: "Gerador de Números Aleatórios",
    shortName: "Números Aleatórios",
    slug: "gerador-numeros-aleatorios",
    category: "geradores",
    description:
      "Gere números aleatórios dentro de um intervalo, com ou sem repetição, para sorteios, testes e amostragens.",
    keywords: [
      "gerador de números aleatórios",
      "número aleatório",
      "sortear número",
      "randomizador",
    ],
    icon: "dices",
    relatedTools: ["sorteador-numeros", "gerador-senha"],
    status: "ativo",
  },
  {
    id: "sorteador-numeros",
    name: "Sorteador de Números",
    shortName: "Sorteador de Números",
    slug: "sorteador-numeros",
    category: "geradores",
    description:
      "Sorteie números dentro de um intervalo sem repetição, ideal para rifas, bingos e sorteios entre grupos de pessoas.",
    keywords: [
      "sorteador de números",
      "sorteio de números",
      "sortear números para rifa",
      "bingo",
    ],
    icon: "shuffle",
    relatedTools: ["gerador-numeros-aleatorios"],
    status: "ativo",
  },

  // GERADORES — FASE C: geradores de dados fictícios base
  {
    id: "gerador-nomes",
    name: "Gerador de Nomes",
    shortName: "Gerador de Nomes",
    slug: "gerador-nomes",
    category: "geradores",
    description:
      "Gere nomes fictícios completos ou apenas o primeiro nome, com filtro de gênero, para testar formulários e massa de dados.",
    keywords: [
      "gerador de nomes",
      "nome fictício",
      "nome aleatório",
      "teste de formulário",
      "massa de dados",
    ],
    icon: "user",
    relatedTools: ["gerador-cpf", "gerador-cep"],
    status: "ativo",
  },
  {
    id: "gerador-cep",
    name: "Gerador de CEP",
    shortName: "Gerador de CEP",
    slug: "gerador-cep",
    category: "geradores",
    description:
      "Gere CEPs sintéticos, no formato oficial de 8 dígitos, para testar máscaras e validações de formulário de endereço.",
    keywords: [
      "gerador de cep",
      "cep para teste",
      "cep sintético",
      "teste de formulário",
    ],
    icon: "map-pin",
    relatedTools: ["gerador-nomes", "gerador-rg"],
    status: "ativo",
  },
  {
    id: "gerador-rg",
    name: "Gerador de RG para Testes",
    shortName: "Gerador de RG",
    slug: "gerador-rg",
    category: "geradores",
    description:
      "Gere números de RG sintéticos, em um formato ilustrativo com dígito verificador, para testar formulários e validações.",
    keywords: [
      "gerador de rg",
      "rg para teste",
      "rg sintético",
      "teste de formulário",
      "qa",
    ],
    icon: "id-card",
    relatedTools: ["gerador-cpf", "gerador-cep"],
    status: "ativo",
  },
  {
    id: "gerador-conta-bancaria",
    name: "Gerador de Conta Bancária para Testes",
    shortName: "Gerador de Conta Bancária",
    slug: "gerador-conta-bancaria",
    category: "geradores",
    description:
      "Gere agência, conta e dígito sintéticos, com banco à sua escolha, para testar formulários e cadastros bancários.",
    keywords: [
      "gerador de conta bancária",
      "agência e conta para teste",
      "conta bancária sintética",
      "teste de formulário",
    ],
    icon: "landmark",
    relatedTools: ["gerador-cartao-credito", "gerador-cpf"],
    status: "ativo",
  },
  {
    id: "gerador-veiculo",
    name: "Gerador de Veículos",
    shortName: "Gerador de Veículos",
    slug: "gerador-veiculo",
    category: "geradores",
    description:
      "Gere dados fictícios de veículo — marca, modelo, ano, cor, categoria e combustível — para testar formulários e massa de dados.",
    keywords: [
      "gerador de veículo",
      "veículo fictício",
      "marca e modelo aleatório",
      "teste de formulário",
    ],
    icon: "car",
    relatedTools: ["gerador-placa-veiculo", "gerador-renavam"],
    status: "ativo",
  },
  {
    id: "gerador-inscricao-estadual",
    name: "Gerador de Inscrição Estadual para Testes",
    shortName: "Gerador de Inscrição Estadual",
    slug: "gerador-inscricao-estadual",
    category: "geradores",
    description:
      "Gere números de Inscrição Estadual sintéticos por estado (UF), em formato genérico de 9 dígitos, para testar formulários.",
    keywords: [
      "gerador de inscrição estadual",
      "inscrição estadual para teste",
      "ie sintética",
      "teste de formulário",
    ],
    icon: "stamp",
    relatedTools: ["gerador-cnpj", "gerador-rg"],
    status: "ativo",
  },

  // GERADORES — FASE D: geradores compostos e utilidades de texto
  {
    id: "gerador-pessoas",
    name: "Gerador de Pessoas",
    shortName: "Gerador de Pessoas",
    slug: "gerador-pessoas",
    category: "geradores",
    description:
      "Gere um perfil de pessoa fictícia completo — nome, CPF, RG, data de nascimento, CEP, telefone e e-mail — para testar formulários de cadastro.",
    keywords: [
      "gerador de pessoas",
      "pessoa fictícia",
      "perfil de teste",
      "massa de dados",
      "teste de formulário",
    ],
    icon: "user",
    relatedTools: ["gerador-empresas", "gerador-cpf", "gerador-nomes"],
    status: "ativo",
  },
  {
    id: "gerador-empresas",
    name: "Gerador de Empresas",
    shortName: "Gerador de Empresas",
    slug: "gerador-empresas",
    category: "geradores",
    description:
      "Gere um perfil de empresa fictícia completo — nome fantasia, razão social, CNPJ, Inscrição Estadual, CEP, telefone e e-mail — para testar cadastros.",
    keywords: [
      "gerador de empresas",
      "empresa fictícia",
      "perfil de teste",
      "massa de dados",
      "teste de formulário",
    ],
    icon: "building",
    relatedTools: ["gerador-pessoas", "gerador-cnpj", "gerador-inscricao-estadual"],
    status: "ativo",
  },
  {
    id: "gerador-nicks",
    name: "Gerador de Nicks",
    shortName: "Gerador de Nicks",
    slug: "gerador-nicks",
    category: "geradores",
    description:
      "Gere nicknames aleatórios para jogos, redes sociais e testes de cadastro, com ou sem número no final.",
    keywords: [
      "gerador de nicks",
      "nickname aleatório",
      "nome para jogo",
      "apelido para rede social",
    ],
    icon: "at-sign",
    relatedTools: ["gerador-nomes", "gerador-senha"],
    status: "ativo",
  },
  {
    id: "gerador-letras-diferentes",
    name: "Gerador de Letras Diferentes",
    shortName: "Letras Diferentes",
    slug: "gerador-letras-diferentes",
    category: "geradores",
    description:
      "Converta um texto para variações estilizadas em Unicode — negrito, itálico, bolha, invertido e mais — para usar em bio e redes sociais.",
    keywords: [
      "letras diferentes",
      "fonte estilizada",
      "texto para instagram",
      "letra bonita para copiar",
      "texto invertido",
    ],
    icon: "type",
    relatedTools: ["simbolos-para-copiar", "gerador-nicks"],
    status: "ativo",
  },
  {
    id: "simbolos-para-copiar",
    name: "Símbolos para Copiar",
    shortName: "Símbolos para Copiar",
    slug: "simbolos-para-copiar",
    category: "geradores",
    description:
      "Catálogo de símbolos e caracteres especiais para copiar e colar — setas, moedas, matemática, formas e mais.",
    keywords: [
      "símbolos para copiar",
      "caracteres especiais",
      "símbolo de seta",
      "símbolo de coração",
    ],
    icon: "hash",
    relatedTools: ["gerador-letras-diferentes"],
    status: "ativo",
  },
  {
    id: "gerador-lorem-ipsum",
    name: "Gerador de Lorem Ipsum",
    shortName: "Lorem Ipsum",
    slug: "gerador-lorem-ipsum",
    category: "geradores",
    description:
      "Gere texto Lorem Ipsum em palavras, frases ou parágrafos para preencher protótipos, layouts e documentos de teste.",
    keywords: [
      "lorem ipsum",
      "gerador de lorem ipsum",
      "texto de preenchimento",
      "placeholder de texto",
    ],
    icon: "align-left",
    relatedTools: ["gerador-curriculo"],
    status: "ativo",
  },
  {
    id: "gerador-curriculo",
    name: "Gerador de Currículo",
    shortName: "Gerador de Currículo",
    slug: "gerador-curriculo",
    category: "geradores",
    description:
      "Monte um currículo simples com seus dados, experiências e formação, pronto para imprimir ou salvar em PDF.",
    keywords: [
      "gerador de currículo",
      "criar currículo online",
      "modelo de currículo",
      "currículo grátis",
    ],
    icon: "briefcase",
    relatedTools: ["gerador-lorem-ipsum"],
    status: "ativo",
  },
  {
    id: "gerador-certidao",
    name: "Gerador de Certidões para Testes",
    shortName: "Gerador de Certidões",
    slug: "gerador-certidao",
    category: "geradores",
    description:
      "Gere números de matrícula sintéticos (32 dígitos) de certidão de nascimento, casamento ou óbito, para testar formulários — nunca um documento.",
    keywords: [
      "gerador de certidão",
      "matrícula de certidão",
      "certidão para teste",
      "teste de formulário",
    ],
    icon: "stamp",
    relatedTools: ["gerador-rg", "gerador-pessoas"],
    status: "ativo",
  },
  {
    id: "gerador-imagem",
    name: "Gerador de Imagem Placeholder",
    shortName: "Gerador de Imagem",
    slug: "gerador-imagem",
    category: "geradores",
    description:
      "Gere uma imagem de placeholder com o tamanho, a cor de fundo e o texto que você escolher, para preencher protótipos e layouts.",
    keywords: [
      "gerador de imagem",
      "imagem placeholder",
      "imagem de teste",
      "placeholder para protótipo",
    ],
    icon: "image",
    relatedTools: ["gerador-lorem-ipsum"],
    status: "ativo",
  },

  // VALIDADORES
  // Categoria nova: valida o FORMATO e os dígitos verificadores de
  // documentos e números brasileiros — nunca consulta Receita Federal,
  // DETRAN, bancos ou qualquer base de dados de pessoas, e não confirma
  // que o documento pertence a alguém. Ver components/tools/tool-registry.tsx
  // para o componente de cada uma e lib/validators/ para a lógica pura.
  {
    id: "validador-cpf",
    name: "Validador de CPF",
    shortName: "Validador de CPF",
    slug: "validador-cpf",
    category: "validadores",
    description:
      "Valide gratuitamente se um CPF possui formato e dígitos verificadores corretos. Ferramenta rápida, online e sem armazenar os dados informados.",
    keywords: [
      "validador de cpf",
      "cpf válido",
      "verificar cpf",
      "dígito verificador cpf",
    ],
    icon: "id-card",
    relatedTools: ["validador-cnpj", "gerador-cpf"],
    status: "ativo",
  },
  {
    id: "validador-cnpj",
    name: "Validador de CNPJ",
    shortName: "Validador de CNPJ",
    slug: "validador-cnpj",
    category: "validadores",
    description:
      "Valide gratuitamente se um CNPJ possui formato e dígitos verificadores corretos. Ferramenta rápida, online e sem armazenar os dados informados.",
    keywords: [
      "validador de cnpj",
      "cnpj válido",
      "verificar cnpj",
      "dígito verificador cnpj",
    ],
    icon: "building",
    relatedTools: ["validador-cpf", "gerador-cnpj"],
    status: "ativo",
  },
  {
    id: "validador-cartao-credito",
    name: "Validador de Cartão de Crédito",
    shortName: "Validador de Cartão",
    slug: "validador-cartao-credito",
    category: "validadores",
    description:
      "Valide gratuitamente se um número de cartão passa no algoritmo de Luhn, 100% no seu navegador — nunca pedimos validade, CVV ou nome do titular.",
    keywords: [
      "validador de cartão de crédito",
      "algoritmo de luhn",
      "verificar número de cartão",
      "cartão válido",
    ],
    icon: "credit-card",
    relatedTools: ["validador-conta-bancaria", "gerador-cartao-credito"],
    status: "ativo",
  },
  {
    id: "validador-conta-bancaria",
    name: "Validador de Conta Bancária",
    shortName: "Validador de Conta Bancária",
    slug: "validador-conta-bancaria",
    category: "validadores",
    description:
      "Valide gratuitamente o formato de banco, agência, conta e dígito. O dígito verificador varia por instituição financeira e não é conferido.",
    keywords: [
      "validador de conta bancária",
      "verificar agência e conta",
      "conta bancária válida",
    ],
    icon: "landmark",
    relatedTools: ["validador-cartao-credito", "gerador-conta-bancaria"],
    status: "ativo",
  },
  {
    id: "validador-certidoes",
    name: "Validador de Certidões",
    shortName: "Validador de Certidões",
    slug: "validador-certidoes",
    category: "validadores",
    description:
      "Valide gratuitamente se um número de matrícula de certidão (nascimento, casamento ou óbito) tem o formato de 32 dígitos do registro civil brasileiro.",
    keywords: [
      "validador de certidão",
      "matrícula de certidão",
      "verificar certidão",
    ],
    icon: "stamp",
    relatedTools: ["validador-rg", "gerador-certidao"],
    status: "ativo",
  },
  {
    id: "validador-cnh",
    name: "Validador de CNH",
    shortName: "Validador de CNH",
    slug: "validador-cnh",
    category: "validadores",
    description:
      "Valide gratuitamente se uma CNH possui formato e dígitos verificadores corretos. Não consulta a situação da CNH junto ao DETRAN.",
    keywords: [
      "validador de cnh",
      "cnh válida",
      "verificar cnh",
      "dígito verificador cnh",
    ],
    icon: "id-card",
    relatedTools: ["validador-renavam", "gerador-cnh"],
    status: "ativo",
  },
  {
    id: "validador-pis-pasep",
    name: "Validador de PIS/PASEP",
    shortName: "Validador de PIS/PASEP",
    slug: "validador-pis-pasep",
    category: "validadores",
    description:
      "Valide gratuitamente se um PIS/PASEP possui formato e dígito verificador corretos. Ferramenta rápida, online e sem armazenar os dados informados.",
    keywords: [
      "validador de pis",
      "validador de pasep",
      "pis pasep válido",
      "verificar pis",
    ],
    icon: "fingerprint",
    relatedTools: ["validador-cnh", "gerador-pis-pasep"],
    status: "ativo",
  },
  {
    id: "validador-renavam",
    name: "Validador de RENAVAM",
    shortName: "Validador de RENAVAM",
    slug: "validador-renavam",
    category: "validadores",
    description:
      "Valide gratuitamente se um RENAVAM possui formato e dígito verificador corretos. Não consulta o DETRAN nem a Base Índice Nacional de Veículos.",
    keywords: [
      "validador de renavam",
      "renavam válido",
      "verificar renavam",
    ],
    icon: "file-text",
    relatedTools: ["validador-cnh", "gerador-renavam"],
    status: "ativo",
  },
  {
    id: "validador-rg",
    name: "Validador de RG",
    shortName: "Validador de RG",
    slug: "validador-rg",
    category: "validadores",
    description:
      "Valide gratuitamente o formato de um RG por estado. Para São Paulo, confere o dígito verificador; para as demais UFs, confere apenas o formato.",
    keywords: [
      "validador de rg",
      "rg válido",
      "verificar rg",
      "dígito verificador rg",
    ],
    icon: "id-card",
    relatedTools: ["validador-cpf", "gerador-rg"],
    status: "ativo",
  },
  {
    id: "validador-titulo-eleitor",
    name: "Validador de Título de Eleitor",
    shortName: "Validador de Título de Eleitor",
    slug: "validador-titulo-eleitor",
    category: "validadores",
    description:
      "Valide gratuitamente se um Título de Eleitor possui formato e dígitos verificadores corretos. Não consulta o TSE nem o cadastro de eleitores.",
    keywords: [
      "validador de título de eleitor",
      "título de eleitor válido",
      "verificar título de eleitor",
    ],
    icon: "vote",
    relatedTools: ["validador-cpf", "gerador-titulo-eleitor"],
    status: "ativo",
  },
  {
    id: "validador-inscricao-estadual",
    name: "Validador de Inscrição Estadual",
    shortName: "Validador de Inscrição Estadual",
    slug: "validador-inscricao-estadual",
    category: "validadores",
    description:
      "Valide gratuitamente o formato de uma Inscrição Estadual por UF. O dígito verificador varia por estado e ainda não é conferido nesta ferramenta.",
    keywords: [
      "validador de inscrição estadual",
      "inscrição estadual válida",
      "verificar inscrição estadual",
    ],
    icon: "stamp",
    relatedTools: ["validador-cnpj", "gerador-inscricao-estadual"],
    status: "ativo",
  },

  // FUNÇÕES STRING
  {
    id: "corretor-ortografico",
    name: "Corretor Ortográfico",
    shortName: "Corretor Ortográfico",
    slug: "corretor-ortografico",
    category: "funcoes-string",
    description:
      "Digite ou cole um texto e veja as palavras sublinhadas pelo corretor ortográfico nativo do seu navegador, sem enviar nada para servidores externos.",
    keywords: ["corretor ortográfico", "corrigir texto", "erros de português", "verificador ortográfico"],
    icon: "spell-check",
    relatedTools: ["contador-caracteres", "maiusculas-minusculas", "remover-acentos"],
    status: "ativo",
  },
  {
    id: "ordem-alfabetica",
    name: "Colocar em Ordem Alfabética",
    shortName: "Ordem Alfabética",
    slug: "ordem-alfabetica",
    category: "funcoes-string",
    description:
      "Ordene uma lista de linhas em ordem alfabética (A-Z ou Z-A), com opção de ignorar maiúsculas, remover duplicados e linhas vazias.",
    keywords: ["ordem alfabética", "ordenar lista", "organizar texto", "a-z"],
    icon: "list-ordered",
    relatedTools: ["dividir-string", "remover-quebras-linha", "contador-caracteres"],
    status: "ativo",
  },
  {
    id: "contador-caracteres",
    name: "Contador de Caracteres",
    shortName: "Contador de Caracteres",
    slug: "contador-caracteres",
    category: "funcoes-string",
    description:
      "Conte caracteres, palavras, linhas e parágrafos de um texto em tempo real, diretamente no seu navegador.",
    keywords: ["contador de caracteres", "contar palavras", "contar linhas", "limite de caracteres"],
    icon: "hash",
    relatedTools: ["cortar-textos", "contador-ocorrencia-palavra", "ordem-alfabetica"],
    status: "ativo",
  },
  {
    id: "contador-ocorrencia-palavra",
    name: "Contador de Ocorrência de Palavra em um Texto",
    shortName: "Ocorrência de Palavra",
    slug: "contador-ocorrencia-palavra",
    category: "funcoes-string",
    description:
      "Descubra quantas vezes uma palavra ou expressão aparece em um texto, com a posição de cada ocorrência.",
    keywords: ["contador de ocorrência", "buscar palavra em texto", "contar palavra repetida"],
    icon: "search",
    relatedTools: ["contador-caracteres", "dividir-string", "ordem-alfabetica"],
    status: "ativo",
  },
  {
    id: "texto-para-html",
    name: "Converter Texto para HTML",
    shortName: "Texto para HTML",
    slug: "texto-para-html",
    category: "funcoes-string",
    description:
      "Converta um texto simples em HTML seguro, com quebras de linha, parágrafos e caracteres especiais escapados automaticamente.",
    keywords: ["texto para html", "converter para html", "escapar html", "quebra de linha para br"],
    icon: "code",
    relatedTools: ["remover-quebras-linha", "cortar-textos", "informacoes-caractere"],
    status: "ativo",
  },
  {
    id: "cortar-textos",
    name: "Cortar Textos",
    shortName: "Cortar Textos",
    slug: "cortar-textos",
    category: "funcoes-string",
    description:
      "Limite um texto por quantidade de caracteres, palavras ou linhas, com opção de reticências e de não cortar uma palavra ao meio.",
    keywords: ["cortar texto", "limitar caracteres", "truncar texto", "resumir texto"],
    icon: "scissors",
    relatedTools: ["contador-caracteres", "dividir-string", "texto-para-html"],
    status: "ativo",
  },
  {
    id: "dividir-string",
    name: "Dividir String",
    shortName: "Dividir String",
    slug: "dividir-string",
    category: "funcoes-string",
    description:
      "Divida um texto em uma lista de itens a partir de um delimitador (vírgula, ponto e vírgula, espaço, quebra de linha ou personalizado).",
    keywords: ["dividir string", "separar texto", "split de texto", "quebrar texto em lista"],
    icon: "columns",
    relatedTools: ["ordem-alfabetica", "cortar-textos", "remover-quebras-linha"],
    status: "ativo",
  },
  {
    id: "informacoes-caractere",
    name: "Informações de Caractere",
    shortName: "Informações de Caractere",
    slug: "informacoes-caractere",
    category: "funcoes-string",
    description:
      "Veja o code point Unicode, o valor hexadecimal, a HTML Entity e os bytes UTF-8 de qualquer caractere.",
    keywords: ["informações de caractere", "unicode", "code point", "html entity", "utf-8"],
    icon: "info",
    relatedTools: ["texto-para-html", "simbolos-para-copiar", "gerador-letras-diferentes"],
    status: "ativo",
  },
  {
    id: "inverter-texto",
    name: "Inverter Texto",
    shortName: "Inverter Texto",
    slug: "inverter-texto",
    category: "funcoes-string",
    description:
      "Inverta um texto por caracteres, pela ordem das palavras ou pela ordem das linhas, com suporte correto a caracteres Unicode.",
    keywords: ["inverter texto", "texto ao contrário", "reverter texto"],
    icon: "arrow-left-right",
    relatedTools: ["maiusculas-minusculas", "gerador-letras-diferentes", "ordem-alfabetica"],
    status: "ativo",
  },
  {
    id: "maiusculas-minusculas",
    name: "Maiúsculas e Minúsculas",
    shortName: "Maiúsculas e Minúsculas",
    slug: "maiusculas-minusculas",
    category: "funcoes-string",
    description:
      "Converta um texto para TUDO MAIÚSCULO, tudo minúsculo, Primeira Letra Maiúscula, início de frase ou Title Case, preservando a acentuação.",
    keywords: [
      "maiúsculas e minúsculas",
      "caixa alta",
      "caixa baixa",
      "title case",
      "primeira letra maiúscula",
    ],
    icon: "type",
    relatedTools: ["corretor-ortografico", "inverter-texto", "remover-acentos"],
    status: "ativo",
  },
  {
    id: "numero-por-extenso",
    name: "Número por Extenso",
    shortName: "Número por Extenso",
    slug: "numero-por-extenso",
    category: "funcoes-string",
    description:
      "Converta um número ou um valor em reais para texto por extenso em português, no modo simples ou monetário.",
    keywords: ["número por extenso", "valor por extenso", "extenso reais", "converter número em texto"],
    icon: "calculator",
    relatedTools: ["gerador-recibo", "numero-do-banco", "contador-caracteres"],
    status: "ativo",
  },
  {
    id: "remover-acentos",
    name: "Remover Acentos de Texto",
    shortName: "Remover Acentos",
    slug: "remover-acentos",
    category: "funcoes-string",
    description:
      "Remova acentos e outras marcas diacríticas de um texto, preservando a caixa original das letras.",
    keywords: ["remover acentos", "texto sem acento", "tirar acentuação"],
    icon: "eraser",
    relatedTools: ["maiusculas-minusculas", "corretor-ortografico", "dividir-string"],
    status: "ativo",
  },
  {
    id: "remover-quebras-linha",
    name: "Remover ou Trocar Quebras de Linha",
    shortName: "Remover Quebras de Linha",
    slug: "remover-quebras-linha",
    category: "funcoes-string",
    description:
      "Remova as quebras de linha de um texto ou substitua por espaço, vírgula ou um texto personalizado.",
    keywords: ["remover quebras de linha", "juntar linhas", "remover quebra de linha", "texto em uma linha"],
    icon: "wrap-text",
    relatedTools: ["dividir-string", "cortar-textos", "ordem-alfabetica"],
    status: "ativo",
  },

  // REDE E INTERNET
  {
    id: "meu-ip",
    name: "Meu IP",
    shortName: "Meu IP",
    slug: "meu-ip",
    category: "rede-internet",
    description:
      "Veja o endereço IP detectado nesta conexão, com a versão (IPv4 ou IPv6) quando possível — sem armazenar nada.",
    keywords: ["meu ip", "qual é o meu ip", "descobrir ip", "ipv4", "ipv6"],
    icon: "wifi",
    relatedTools: ["meu-navegador", "meu-sistema-operacional"],
    status: "ativo",
  },
  {
    id: "meu-navegador",
    name: "Meu Navegador",
    shortName: "Meu Navegador",
    slug: "meu-navegador",
    category: "rede-internet",
    description:
      "Descubra o nome, a versão aproximada e o motor do navegador que você está usando, a partir do User-Agent da sua conexão.",
    keywords: ["meu navegador", "qual navegador estou usando", "user agent", "versão do navegador"],
    icon: "globe",
    relatedTools: ["meu-ip", "meu-sistema-operacional"],
    status: "ativo",
  },
  {
    id: "meu-sistema-operacional",
    name: "Meu Sistema Operacional",
    shortName: "Meu Sistema Operacional",
    slug: "meu-sistema-operacional",
    category: "rede-internet",
    description: "Descubra qual sistema operacional e dispositivo você está usando para acessar esta página.",
    keywords: [
      "meu sistema operacional",
      "qual sistema operacional estou usando",
      "windows mac linux android ios",
    ],
    icon: "monitor",
    relatedTools: ["meu-ip", "meu-navegador"],
    status: "ativo",
  },
  // CONVERSOR BASE64 (conversões 100% no navegador — ver components/tools/base64)
  {
    id: "base64-para-ascii",
    name: "Base64 para ASCII",
    shortName: "Base64 para ASCII",
    slug: "base64-para-ascii",
    category: "conversor-base64",
    description:
      "Decodifique Base64 em caracteres ASCII, byte a byte, e identifique bytes fora da tabela ASCII.",
    metaTitle: "Base64 para ASCII Online Grátis",
    metaDescription:
      "Converta Base64 para ASCII online e grátis. Decodifique byte a byte, veja caracteres fora da tabela ASCII e copie o resultado — tudo no navegador.",
    keywords: ["base64 para ascii", "decodificar base64 ascii", "base64 decode ascii", "base64 to ascii"],
    icon: "type",
    relatedTools: ["base64-para-texto", "base64-para-hex", "texto-para-base64"],
    status: "ativo",
  },
  {
    id: "base64-para-audio",
    name: "Base64 para Áudio",
    shortName: "Base64 para Áudio",
    slug: "base64-para-audio",
    category: "conversor-base64",
    description:
      "Transforme Base64 ou Data URI em áudio: ouça no player e baixe o arquivo MP3, WAV, OGG ou WEBM.",
    metaTitle: "Base64 para Áudio Online Grátis",
    metaDescription:
      "Converta Base64 em áudio online grátis. Cole o Base64 ou Data URI, ouça no player e baixe MP3, WAV, OGG ou WEBM sem enviar nada ao servidor.",
    keywords: ["base64 para áudio", "base64 para mp3", "base64 to audio", "data uri áudio", "decodificar áudio base64"],
    icon: "music",
    relatedTools: ["audio-para-base64", "base64-para-video", "base64-para-arquivo"],
    status: "ativo",
  },
  {
    id: "basic-auth-decode",
    name: "Basic Auth Decode",
    shortName: "Basic Auth Decode",
    slug: "basic-auth-decode",
    category: "conversor-base64",
    description:
      "Decodifique um cabeçalho HTTP Basic Auth e veja o usuário e a senha separados.",
    metaTitle: "Basic Auth Decode Online Grátis",
    metaDescription:
      "Decodifique cabeçalhos HTTP Basic Auth online. Cole \"Basic ...\" ou só o Base64 e veja usuário e senha separados, direto no seu navegador.",
    keywords: ["basic auth decode", "decodificar basic auth", "authorization basic", "http basic authentication", "usuário e senha base64"],
    icon: "key-round",
    relatedTools: ["base64-para-texto", "texto-para-base64", "base64-para-ascii"],
    status: "ativo",
  },
  {
    id: "base64-para-arquivo",
    name: "Base64 para Arquivo",
    shortName: "Base64 para Arquivo",
    slug: "base64-para-arquivo",
    category: "conversor-base64",
    description:
      "Converta Base64 em arquivo para download, com nome, extensão e MIME type definidos por você.",
    metaTitle: "Base64 para Arquivo Online Grátis",
    metaDescription:
      "Converta Base64 em arquivo online grátis. Defina nome, extensão e MIME type, detecte o formato automaticamente e baixe o arquivo sem upload.",
    keywords: ["base64 para arquivo", "base64 to file", "decodificar base64 arquivo", "baixar base64", "converter base64 em arquivo"],
    icon: "file-output",
    relatedTools: ["arquivo-para-base64", "base64-para-pdf", "base64-para-imagem"],
    status: "ativo",
  },
  {
    id: "base64-para-hex",
    name: "Base64 para Hexadecimal",
    shortName: "Base64 para Hex",
    slug: "base64-para-hex",
    category: "conversor-base64",
    description:
      "Converta Base64 em hexadecimal, com letras maiúsculas ou minúsculas e contagem de bytes.",
    metaTitle: "Base64 para Hexadecimal Online Grátis",
    metaDescription:
      "Converta Base64 para hexadecimal online grátis. Escolha letras maiúsculas ou minúsculas, veja a quantidade de bytes e copie o resultado.",
    keywords: ["base64 para hex", "base64 para hexadecimal", "base64 to hex", "decodificar base64 hex", "bytes hexadecimal"],
    icon: "hash",
    relatedTools: ["hex-para-base64", "base64-para-ascii", "base64-para-texto"],
    status: "ativo",
  },
  {
    id: "base64-para-imagem",
    name: "Base64 para Imagem",
    shortName: "Base64 para Imagem",
    slug: "base64-para-imagem",
    category: "conversor-base64",
    description:
      "Visualize e baixe imagens PNG, JPG, GIF, WebP ou SVG a partir de Base64 ou Data URI.",
    metaTitle: "Base64 para Imagem Online Grátis",
    metaDescription:
      "Converta Base64 em imagem online gratuitamente. Visualize e baixe PNG, JPG, GIF e WebP diretamente no navegador, com MIME, tamanho e dimensões.",
    keywords: ["base64 para imagem", "base64 to image", "base64 para png", "base64 para jpg", "data uri imagem"],
    icon: "image",
    relatedTools: ["imagem-para-base64", "base64-para-arquivo", "base64-para-pdf"],
    status: "ativo",
  },
  {
    id: "base64-para-pdf",
    name: "Base64 para PDF",
    shortName: "Base64 para PDF",
    slug: "base64-para-pdf",
    category: "conversor-base64",
    description:
      "Transforme Base64 em PDF: valide o arquivo, visualize no navegador e baixe o documento.",
    metaTitle: "Base64 para PDF Online Grátis",
    metaDescription:
      "Converta Base64 em PDF online grátis. Cole o Base64 ou data:application/pdf, visualize o documento e baixe o PDF sem enviar nada ao servidor.",
    keywords: ["base64 para pdf", "base64 to pdf", "decodificar pdf base64", "data application pdf base64", "visualizar pdf base64"],
    icon: "file-pdf",
    relatedTools: ["pdf-para-base64", "base64-para-arquivo", "base64-para-imagem"],
    status: "ativo",
  },
  {
    id: "base64-para-texto",
    name: "Base64 para Texto",
    shortName: "Base64 para Texto",
    slug: "base64-para-texto",
    category: "conversor-base64",
    description:
      "Decodifique Base64 em texto UTF-8, com suporte a acentos, emojis e caracteres especiais.",
    metaTitle: "Base64 para Texto Online Grátis",
    metaDescription:
      "Decodifique Base64 para texto online grátis. Suporte completo a UTF-8: acentos, emojis e caracteres especiais, direto no navegador.",
    keywords: ["base64 para texto", "base64 decode", "decodificar base64", "base64 to text", "base64 utf-8"],
    icon: "file-text",
    relatedTools: ["texto-para-base64", "base64-para-ascii", "basic-auth-decode"],
    status: "ativo",
  },
  {
    id: "base64-para-video",
    name: "Base64 para Vídeo",
    shortName: "Base64 para Vídeo",
    slug: "base64-para-video",
    category: "conversor-base64",
    description:
      "Converta Base64 ou Data URI em vídeo MP4, WEBM ou OGG, assista no player e baixe o arquivo.",
    metaTitle: "Base64 para Vídeo Online Grátis",
    metaDescription:
      "Converta Base64 em vídeo online grátis. Assista no player do navegador e baixe MP4, WEBM ou OGG a partir de Base64 ou Data URI, sem upload.",
    keywords: ["base64 para vídeo", "base64 para mp4", "base64 to video", "data uri vídeo", "decodificar vídeo base64"],
    icon: "video",
    relatedTools: ["video-para-base64", "base64-para-audio", "base64-para-arquivo"],
    status: "ativo",
  },
  {
    id: "audio-para-base64",
    name: "Áudio para Base64",
    shortName: "Áudio para Base64",
    slug: "audio-para-base64",
    category: "conversor-base64",
    description:
      "Converta arquivos de áudio em Base64 e Data URI localmente, com tamanho original e final.",
    metaTitle: "Áudio para Base64 Online Grátis",
    metaDescription:
      "Converta áudio para Base64 online grátis. Envie MP3, WAV, OGG ou M4A e gere Base64 e Data URI no navegador, sem upload para servidores.",
    keywords: ["áudio para base64", "mp3 para base64", "audio to base64", "wav para base64", "data uri áudio"],
    icon: "music",
    relatedTools: ["base64-para-audio", "video-para-base64", "arquivo-para-base64"],
    status: "ativo",
  },
  {
    id: "css-para-base64",
    name: "CSS para Base64",
    shortName: "CSS para Base64",
    slug: "css-para-base64",
    category: "conversor-base64",
    description:
      "Codifique CSS em Base64 e gere um Data URI text/css pronto para usar em links e @import.",
    metaTitle: "CSS para Base64 Online Grátis",
    metaDescription:
      "Converta CSS para Base64 online grátis. Cole o código ou envie um arquivo .css e gere Base64 e Data URI text/css no navegador.",
    keywords: ["css para base64", "css to base64", "data uri css", "codificar css base64", "text/css base64"],
    icon: "palette",
    relatedTools: ["html-para-base64", "texto-para-base64", "imagem-para-base64"],
    status: "ativo",
  },
  {
    id: "arquivo-para-base64",
    name: "Arquivo para Base64",
    shortName: "Arquivo para Base64",
    slug: "arquivo-para-base64",
    category: "conversor-base64",
    description:
      "Converta qualquer arquivo em Base64 e Data URI, com nome, MIME e tamanho, sem upload.",
    metaTitle: "Arquivo para Base64 Online Grátis",
    metaDescription:
      "Converta qualquer arquivo para Base64 online grátis. Veja nome, MIME e tamanho e gere Base64 e Data URI localmente, sem enviar o arquivo.",
    keywords: ["arquivo para base64", "file to base64", "converter arquivo base64", "codificar arquivo base64", "data uri arquivo"],
    icon: "file-input",
    relatedTools: ["base64-para-arquivo", "pdf-para-base64", "imagem-para-base64"],
    status: "ativo",
  },
  {
    id: "hex-para-base64",
    name: "Hexadecimal para Base64",
    shortName: "Hex para Base64",
    slug: "hex-para-base64",
    category: "conversor-base64",
    description:
      "Converta uma string hexadecimal em Base64, com remoção automática de espaços e validação.",
    metaTitle: "Hexadecimal para Base64 Online Grátis",
    metaDescription:
      "Converta hexadecimal para Base64 online grátis. Aceita maiúsculas, minúsculas, espaços e prefixo 0x, com validação dos caracteres.",
    keywords: ["hex para base64", "hexadecimal para base64", "hex to base64", "converter hex base64", "bytes para base64"],
    icon: "hash",
    relatedTools: ["base64-para-hex", "texto-para-base64", "arquivo-para-base64"],
    status: "ativo",
  },
  {
    id: "html-para-base64",
    name: "HTML para Base64",
    shortName: "HTML para Base64",
    slug: "html-para-base64",
    category: "conversor-base64",
    description:
      "Codifique HTML em Base64 (UTF-8) e gere um Data URI text/html — sem executar o código.",
    metaTitle: "HTML para Base64 Online Grátis",
    metaDescription:
      "Converta HTML para Base64 online grátis. Gere Base64 em UTF-8 e Data URI text/html com segurança: o código nunca é executado na página.",
    keywords: ["html para base64", "html to base64", "data uri html", "codificar html base64", "text/html base64"],
    icon: "code",
    relatedTools: ["css-para-base64", "texto-para-base64", "url-para-base64"],
    status: "ativo",
  },
  {
    id: "imagem-para-base64",
    name: "Imagem para Base64",
    shortName: "Imagem para Base64",
    slug: "imagem-para-base64",
    category: "conversor-base64",
    description:
      "Converta PNG, JPG, GIF, WebP ou SVG em Base64 e Data URI, com prévia e tamanho do arquivo.",
    metaTitle: "Imagem para Base64 Online Grátis",
    metaDescription:
      "Converta imagem para Base64 online grátis. Envie PNG, JPG, GIF, WebP ou SVG, veja a prévia e copie o Base64 ou o Data URI para usar em HTML e CSS.",
    keywords: ["imagem para base64", "png para base64", "jpg para base64", "image to base64", "data uri imagem"],
    icon: "image",
    relatedTools: ["base64-para-imagem", "arquivo-para-base64", "css-para-base64"],
    status: "ativo",
  },
  {
    id: "pdf-para-base64",
    name: "PDF para Base64",
    shortName: "PDF para Base64",
    slug: "pdf-para-base64",
    category: "conversor-base64",
    description:
      "Converta um PDF em Base64 e em data:application/pdf, com validação do arquivo e tamanho.",
    metaTitle: "PDF para Base64 Online Grátis",
    metaDescription:
      "Converta PDF para Base64 online grátis. O arquivo é validado e convertido no navegador, gerando Base64 e data:application/pdf prontos para copiar.",
    keywords: ["pdf para base64", "pdf to base64", "converter pdf em base64", "data application pdf", "codificar pdf base64"],
    icon: "file-pdf",
    relatedTools: ["base64-para-pdf", "arquivo-para-base64", "imagem-para-base64"],
    status: "ativo",
  },
  {
    id: "texto-para-base64",
    name: "Texto para Base64",
    shortName: "Texto para Base64",
    slug: "texto-para-base64",
    category: "conversor-base64",
    description:
      "Codifique texto em Base64 com UTF-8 correto: português, acentos, emojis e qualquer Unicode.",
    metaTitle: "Texto para Base64 Online Grátis",
    metaDescription:
      "Converta texto para Base64 online grátis. Codificação UTF-8 correta para acentos, emojis e Unicode, com resultado pronto para copiar.",
    keywords: ["texto para base64", "base64 encode", "codificar base64", "text to base64", "utf-8 base64"],
    icon: "file-text",
    relatedTools: ["base64-para-texto", "url-para-base64", "html-para-base64"],
    status: "ativo",
  },
  {
    id: "url-para-base64",
    name: "URL para Base64",
    shortName: "URL para Base64",
    slug: "url-para-base64",
    category: "conversor-base64",
    description:
      "Codifique o texto de uma URL em Base64 ou baixe o conteúdo do endereço pelo navegador e converta.",
    metaTitle: "URL para Base64 Online Grátis",
    metaDescription:
      "Converta URL para Base64 online grátis. Codifique o endereço em si ou baixe o arquivo da URL pelo seu navegador e gere Base64 e Data URI.",
    keywords: ["url para base64", "url to base64", "link para base64", "codificar url base64", "base64 de url"],
    icon: "link",
    relatedTools: ["texto-para-base64", "arquivo-para-base64", "html-para-base64"],
    status: "ativo",
  },
  {
    id: "video-para-base64",
    name: "Vídeo para Base64",
    shortName: "Vídeo para Base64",
    slug: "video-para-base64",
    category: "conversor-base64",
    description:
      "Converta vídeos MP4, WEBM, OGV ou MOV em Base64 e Data URI localmente, com barra de progresso.",
    metaTitle: "Vídeo para Base64 Online Grátis",
    metaDescription:
      "Converta vídeo para Base64 online grátis. Envie MP4, WEBM ou MOV de até 100 MB e gere Base64 e Data URI no navegador, sem upload.",
    keywords: ["vídeo para base64", "mp4 para base64", "video to base64", "data uri vídeo", "converter vídeo base64"],
    icon: "video",
    relatedTools: ["base64-para-video", "audio-para-base64", "arquivo-para-base64"],
    status: "ativo",
  },
];

export function getToolBySlug(
  category: string,
  slug: string
): Tool | undefined {
  return tools.find((tool) => tool.category === category && tool.slug === slug);
}

export function getToolsByCategory(category: string): Tool[] {
  return tools
    .filter((tool) => tool.category === category)
    .sort(compareToolsByFeatureRank);
}

export function getFeaturedTools(): Tool[] {
  return tools
    .filter((tool) => tool.featureRank !== undefined && tool.status === "ativo")
    .sort(compareToolsByFeatureRank);
}

function compareToolsByFeatureRank(left: Tool, right: Tool) {
  return (
    (left.featureRank ?? Number.MAX_SAFE_INTEGER) -
    (right.featureRank ?? Number.MAX_SAFE_INTEGER)
  );
}

export function getRelatedTools(tool: Tool, limit = 3): Tool[] {
  return tool.relatedTools
    .map((id) => tools.find((candidate) => candidate.id === id))
    .filter((candidate): candidate is Tool => Boolean(candidate))
    .slice(0, limit);
}
