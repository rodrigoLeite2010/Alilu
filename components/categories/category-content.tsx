import type { CategoryId } from "@/data/categories";

export interface CategoryHighlight {
  toolId: string;
  reason: string;
}

/**
 * Texto introdutório real por categoria (uma ou duas frases já existem em
 * data/categories.ts para meta description e listagens curtas — este
 * arquivo é o texto mais longo, específico da categoria, exibido no topo
 * do hub /utilitarios/[categoria], para que a página deixe de ser só um
 * grid de cards).
 *
 * `highlights` aponta, por tool.id, 2–3 ferramentas da própria categoria
 * com uma frase de contexto real (por que usar, quando usar) — não é uma
 * lista genérica, é montada olhando as ferramentas reais de cada
 * categoria (ver data/tools.ts).
 */
export const categoryContent: Record<
  CategoryId,
  { intro: string; highlights: CategoryHighlight[] }
> = {
  trabalho: {
    intro:
      "Calculadoras para quem é empregado CLT ou cuida do RH de uma empresa conferir valores antes de bater com o contracheque ou o TRCT: rescisão, salário líquido com os descontos de INSS e IRRF, férias, 13º salário e hora extra. Servem tanto para o trabalhador entender o que deveria receber quanto para o RH validar um cálculo rapidamente, sem depender de planilha.",
    highlights: [
      { toolId: "calculadora-rescisao", reason: "simula o total da rescisão por tipo de desligamento (sem justa causa, pedido de demissão, acordo etc.)." },
      { toolId: "salario-liquido", reason: "mostra o salário líquido já com INSS e IRRF descontados, mês a mês." },
      { toolId: "hora-extra", reason: "calcula o valor da hora extra com o adicional de 50% ou 100% sobre o salário-base." },
    ],
  },
  financeiro: {
    intro:
      "A maior categoria do site: 18 ferramentas de matemática financeira, do juro composto básico a um simulador completo de financiamento de veículo com mais de dez calculadoras derivadas (entrada, prazo, taxa de juros, CET estimado, financiamento x consórcio, financiamento x à vista). Todas deixam claro que o resultado é uma simulação — o banco pode calcular com taxas e regras próprias, então vale usar como referência antes de assinar um contrato.",
    highlights: [
      { toolId: "juros-compostos", reason: "projeta o crescimento de um valor investido mês a mês, com aportes opcionais." },
      { toolId: "financiamento-veiculos", reason: "reúne o simulador principal e as ferramentas derivadas para comparar entrada, prazo e taxa antes de financiar um carro." },
      { toolId: "sac-x-price", reason: "compara lado a lado as parcelas dos sistemas SAC e Price no mesmo financiamento." },
    ],
  },
  empresa: {
    intro:
      "Ferramentas para quem empreende resolver o dia a dia sem precisar de um sistema de gestão: emitir um recibo simples, montar um orçamento para enviar ao cliente, ou definir o preço de venda calculando markup e margem de lucro. Pensadas para autônomos, MEIs e pequenos negócios que precisam de um cálculo rápido e confiável.",
    highlights: [
      { toolId: "gerador-recibo", reason: "monta um recibo pronto para imprimir ou salvar em PDF, sem cadastro." },
      { toolId: "markup", reason: "calcula o preço de venda a partir do custo, das despesas e da margem desejada." },
      { toolId: "margem-de-lucro", reason: "mostra a margem de lucro real de um produto a partir do custo e do preço de venda." },
    ],
  },
  outros: {
    intro:
      "Utilidades que não se encaixam em uma categoria só sua, mas resolvem um problema pontual e específico: contar dias úteis entre duas datas, calcular uma porcentagem de várias formas diferentes, gerar um QR Code, ler o XML de uma nota fiscal eletrônica ou dividir uma conta entre amigos.",
    highlights: [
      { toolId: "porcentagem", reason: "resolve os cinco tipos mais comuns de conta de porcentagem em um só lugar (quanto é X% de Y, variação percentual, e mais)." },
      { toolId: "qr-code", reason: "gera um QR Code a partir de um texto ou link, pronto para baixar." },
      { toolId: "leitor-xml-nfe", reason: "lê o arquivo XML de uma nota fiscal eletrônica e mostra os dados de forma legível." },
    ],
  },
  pdf: {
    intro:
      "18 ferramentas para organizar, converter e proteger arquivos PDF sem instalar programa nenhum: unir, dividir, girar, comprimir, converter de e para Word/Excel/PowerPoint/JPG, assinar, adicionar marca d'água, desbloquear ou proteger com senha. Todo o processamento acontece no navegador — o arquivo não é enviado nem armazenado nos servidores da ALILU.",
    highlights: [
      { toolId: "unir-pdf", reason: "junta vários PDFs em um único arquivo, na ordem que você escolher." },
      { toolId: "comprimir-pdf", reason: "reduz o tamanho de um PDF grande antes de enviar por e-mail ou sistema com limite de upload." },
      { toolId: "assinar-pdf", reason: "adiciona uma assinatura desenhada ou digitada diretamente no documento." },
    ],
  },
  geradores: {
    intro:
      "26 geradores de dados sintéticos e conteúdo para testes de software, formulários de exemplo e produtividade: CPF, CNPJ, cartão de crédito, RG e outros documentos gerados são matematicamente válidos no formato (passam nos dígitos verificadores), mas são fictícios — não pertencem a nenhuma pessoa real e não devem ser usados fora de ambiente de teste. Também há geradores de senha segura, Lorem Ipsum, nomes, currículo e imagens placeholder.",
    highlights: [
      { toolId: "gerador-cpf", reason: "gera um número de CPF fictício com dígito verificador válido, para popular formulários de teste." },
      { toolId: "gerador-senha", reason: "cria uma senha aleatória segura com o tamanho e os critérios que você escolher." },
      { toolId: "gerador-lorem-ipsum", reason: "gera texto de preenchimento em parágrafos, frases ou palavras para maquetes e layouts." },
    ],
  },
  validadores: {
    intro:
      "11 ferramentas que conferem se um CPF, CNPJ, cartão de crédito ou outro documento brasileiro tem o formato e o dígito verificador corretos — útil para validar um formulário antes de enviar ou para checar um número digitado errado. Nenhuma dessas ferramentas consulta Receita Federal, DETRAN, bancos ou qualquer base de dados: elas confirmam a matemática do número, não se ele pertence a alguém ou está ativo.",
    highlights: [
      { toolId: "validador-cpf", reason: "confere se os dígitos verificadores de um CPF batem com o algoritmo oficial." },
      { toolId: "validador-cnpj", reason: "valida o formato e os dígitos verificadores de um CNPJ, incluindo o novo formato alfanumérico." },
      { toolId: "validador-cartao-credito", reason: "verifica se o número do cartão passa no algoritmo de Luhn, usado por bandeiras como Visa e Mastercard." },
    ],
  },
  "funcoes-string": {
    intro:
      "13 ferramentas para manipular texto diretamente no navegador: contar caracteres e palavras, corrigir ortografia, colocar em ordem alfabética, remover acentos ou quebras de linha, inverter o texto, converter para maiúsculas/minúsculas, escrever um número por extenso e mais. Úteis para quem trabalha com redação, atendimento, planilhas ou qualquer tarefa que exija limpar ou reformatar texto rapidamente.",
    highlights: [
      { toolId: "contador-caracteres", reason: "conta caracteres, palavras e linhas em tempo real — útil para limites de legenda, bio ou anúncio." },
      { toolId: "remover-acentos", reason: "remove acentuação de um texto inteiro, útil para nomes de arquivo ou sistemas que não aceitam acento." },
      { toolId: "numero-por-extenso", reason: "escreve um número por extenso em português, incluindo valores em reais." },
    ],
  },
  "rede-internet": {
    intro:
      "Três ferramentas de diagnóstico rápido para descobrir informações básicas sobre a sua própria conexão, navegador e sistema operacional — úteis na hora de abrir um chamado de suporte técnico ou confirmar qual IP, navegador ou sistema você está usando neste momento.",
    highlights: [
      { toolId: "meu-ip", reason: "mostra o endereço IP público da sua conexão atual." },
      { toolId: "meu-navegador", reason: "identifica o navegador e a versão que você está usando." },
      { toolId: "meu-sistema-operacional", reason: "identifica o sistema operacional do dispositivo que você está usando." },
    ],
  },
  "conversor-base64": {
    intro:
      "19 conversores de e para Base64 — texto, arquivo, imagem, PDF, áudio, vídeo, HTML, CSS, hexadecimal, URL e Basic Auth — cada um com sua própria página, além do conversor unificado com busca logo abaixo. Toda a conversão acontece no navegador: nada do que você cola ou envia aqui passa pelos servidores da ALILU.",
    highlights: [
      { toolId: "texto-para-base64", reason: "converte qualquer texto para Base64, útil para embutir dados em APIs ou URLs." },
      { toolId: "imagem-para-base64", reason: "converte uma imagem para uma string Base64 pronta para usar em CSS ou HTML (data URI)." },
      { toolId: "base64-para-arquivo", reason: "decodifica uma string Base64 de volta para o arquivo original, pronto para baixar." },
    ],
  },
};
