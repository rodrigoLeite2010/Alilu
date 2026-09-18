import type { ToolContentSection, ToolFaqItem } from "@/components/tools/ToolPageTemplate";

/**
 * Conteúdo explicativo e FAQ específicos de cada ferramenta já implementada
 * (ETAPA 2, seção 15). Ferramentas sem entrada aqui continuam usando o
 * texto genérico de ToolPageTemplate (adequado para ferramentas
 * "em-breve") — este arquivo só é consultado para ferramentas com
 * componente real em components/tools/tool-registry.tsx.
 */
export const toolContent: Record<
  string,
  { contentSections: ToolContentSection[]; faq: ToolFaqItem[] }
> = {
  "gerador-recibo": {
    contentSections: [
      {
        title: "Como gerar um recibo online?",
        body: "Preencha o valor recebido, quem pagou e quem está recebendo, e o motivo do pagamento. Clique em \"Gerar recibo\" para ver a prévia pronta, e use \"Imprimir / Salvar PDF\" para imprimir ou salvar o arquivo em PDF pelo seu navegador.",
      },
      {
        title: "O que informar em um recibo?",
        body: "Um recibo simples costuma trazer o valor recebido (em número e por extenso), quem pagou e quem recebeu, a data e o motivo do pagamento. CPF/CNPJ e forma de pagamento ajudam a identificar as partes, mas são opcionais.",
      },
      {
        title: "Como salvar o recibo em PDF?",
        body: "O botão \"Imprimir / Salvar PDF\" abre a caixa de impressão do seu navegador. Nela, escolha a opção \"Salvar como PDF\" (ou equivalente) no lugar de uma impressora física, quando essa opção estiver disponível no seu dispositivo.",
      },
      {
        title: "Privacidade",
        body: "Todos os dados que você preenche são processados apenas no seu navegador. O Alilu Utilitários não envia, não recebe e não armazena os dados do seu recibo em nenhum servidor.",
      },
    ],
    faq: [
      {
        question: "O gerador de recibo é gratuito?",
        answer: "Sim, é totalmente gratuito e não exige cadastro.",
      },
      {
        question: "Os meus dados ficam armazenados?",
        answer:
          "Não. O recibo é montado inteiramente no seu navegador; nenhum dado preenchido é enviado ou guardado pela Alilu.",
      },
      {
        question: "Posso salvar o recibo em PDF?",
        answer:
          "Sim. Use o botão \"Imprimir / Salvar PDF\" e escolha a opção de salvar em PDF na caixa de impressão do seu navegador.",
      },
      {
        question: "Posso imprimir o recibo?",
        answer:
          "Sim. O botão \"Imprimir / Salvar PDF\" abre a impressão já formatada, mostrando somente o documento do recibo.",
      },
      {
        question: "Preciso informar CPF ou CNPJ?",
        answer:
          "Não é obrigatório. Mas, se você preencher, o número precisa ser um CPF ou CNPJ válido.",
      },
      {
        question: "Posso gerar recibo pelo celular?",
        answer:
          "Sim. O gerador de recibo funciona bem em celular, tablet e computador.",
      },
    ],
  },
  "juros-compostos": {
    contentSections: [
      {
        title: "O que são juros compostos?",
        body: "Juros compostos são os juros calculados sobre o saldo total do período anterior, incluindo os juros já ganhos antes — por isso o rendimento cresce cada vez mais rápido ao longo do tempo, diferente dos juros simples.",
      },
      {
        title: "Como funciona o cálculo?",
        body: "A cada mês, a calculadora aplica a taxa mensal sobre o saldo atual e soma o resultado ao saldo. Se houver aporte mensal, ele é somado ao final do mês e passa a render juros a partir do mês seguinte.",
      },
      {
        title: "Como funcionam os aportes mensais?",
        body: "O aporte mensal é um valor opcional que você soma ao investimento todo mês, além do valor inicial. Aportes recorrentes aceleram bastante o crescimento do saldo ao longo do tempo.",
      },
      {
        title: "Diferença entre taxa mensal e anual",
        body: "Se você já sabe a taxa mensal, escolha \"Mensal\". Se só tem a taxa anual (ex.: de um CDB ou poupança), escolha \"Anual\": a calculadora converte automaticamente para a taxa mensal equivalente antes de simular.",
      },
      {
        title: "Exemplo prático",
        body: "R$ 1.000,00 iniciais, com aporte de R$ 100,00 por mês, a 1% ao mês durante 12 meses, chegam a aproximadamente R$ 2.395,08 — sendo R$ 2.200,00 de capital investido e o restante em juros.",
      },
    ],
    faq: [
      {
        question: "Os resultados são uma promessa de rentabilidade?",
        answer:
          "Não. Esta é uma simulação matemática baseada nos valores e na taxa que você informar — não é uma garantia nem uma recomendação de investimento.",
      },
      {
        question: "Os meus dados ficam armazenados?",
        answer:
          "Não. Todo o cálculo acontece no seu navegador; nenhum valor digitado é enviado ou guardado pela Alilu.",
      },
      {
        question: "Posso simular sem aporte mensal?",
        answer: "Sim, o aporte mensal é opcional — deixe o campo em branco ou zerado.",
      },
      {
        question: "Posso usar taxa anual em vez de mensal?",
        answer:
          "Sim. Escolha \"Anual\" no tipo da taxa que a conversão para a taxa mensal equivalente é feita automaticamente.",
      },
      {
        question: "O período pode ser em anos?",
        answer: "Sim, escolha \"Anos\" no tipo do período.",
      },
      {
        question: "Posso usar a calculadora pelo celular?",
        answer: "Sim. Ela funciona bem em celular, tablet e computador.",
      },
    ],
  },
  // Chave = tool.id ("sac-x-price"), não o slug — ver comentário
  // equivalente em components/tools/tool-registry.tsx.
  "sac-x-price": {
    contentSections: [
      {
        title: "O que é Tabela Price?",
        body: "A Tabela Price é um sistema de amortização em que a prestação é constante do início ao fim do financiamento. No começo, a maior parte da prestação é juros; com o tempo, a parcela de amortização cresce e a de juros diminui, mas o valor total pago por mês não muda.",
      },
      {
        title: "O que é SAC?",
        body: "No SAC (Sistema de Amortização Constante), a amortização é sempre a mesma a cada parcela. Como os juros incidem sobre um saldo devedor que diminui mais rápido, a prestação começa mais alta e vai caindo mês a mês até o fim do financiamento.",
      },
      {
        title: "Qual a diferença entre SAC e Price?",
        body: "No Price, a prestação é fixa e a amortização cresce aos poucos. No SAC, a amortização é fixa e a prestação cai aos poucos. Para o mesmo valor financiado, taxa e prazo, o SAC costuma gerar menos juros totais (porque amortiza mais rápido no início), mas exige uma parcela inicial mais alta. A melhor opção depende da sua capacidade de pagamento em cada momento — esta ferramenta não indica um sistema como \"melhor\", apenas mostra as diferenças matemáticas.",
      },
      {
        title: "Como a taxa de juros influencia o financiamento?",
        body: "Quanto maior a taxa de juros, maior o total pago em ambos os sistemas, e maior também a diferença entre as prestações inicial e final do SAC. Se você informar uma taxa anual, ela é convertida para a taxa mensal equivalente antes da simulação, e não simplesmente dividida por 12.",
      },
      {
        title: "Como funciona esta simulação?",
        body: "Você informa o valor do bem, uma entrada opcional, a taxa de juros e o número de parcelas. O valor financiado (valor do bem menos a entrada) é simulado pelo sistema escolhido — Price, SAC ou os dois lado a lado — mostrando parcela inicial e final, total pago, total de juros, o gráfico de evolução do saldo devedor e a tabela de amortização completa. É uma simulação matemática: financiamentos reais podem incluir tarifas, seguros, impostos, o Custo Efetivo Total (CET) e outras condições não consideradas aqui.",
      },
    ],
    faq: [
      {
        question: "SAC ou Price: qual é melhor?",
        answer:
          "Não existe um sistema sempre melhor. O SAC costuma gerar menos juros totais, mas a primeira parcela é mais alta; o Price tem prestação fixa, mais previsível. A escolha depende da sua situação financeira.",
      },
      {
        question: "Os resultados incluem tarifas, seguros ou o CET?",
        answer:
          "Não. Esta é uma simulação apenas dos sistemas de amortização SAC e Price. Financiamentos reais podem ter tarifas, seguros, impostos e outras condições que mudam o custo total.",
      },
      {
        question: "Os meus dados ficam armazenados?",
        answer:
          "Não. Todo o cálculo acontece no seu navegador; nenhum valor digitado é enviado ou guardado pela Alilu.",
      },
      {
        question: "Posso simular sem entrada?",
        answer: "Sim, a entrada é opcional — deixe o campo em branco ou zerado.",
      },
      {
        question: "Posso comparar os dois sistemas ao mesmo tempo?",
        answer:
          "Sim. Escolha \"Comparar os dois\" no campo Sistema para ver Price e SAC lado a lado.",
      },
      {
        question: "Posso usar taxa anual em vez de mensal?",
        answer:
          "Sim. Escolha \"Anual\" no tipo da taxa que a conversão para a taxa mensal equivalente é feita automaticamente.",
      },
    ],
  },

  porcentagem: {
    contentSections: [
      {
        title: "Como calcular porcentagem?",
        body: 'Escolha o que você quer calcular: "X% de Y" (ex.: 10% de 200), "X é quantos % de Y" (ex.: 50 é quantos % de 200), aumentar ou reduzir um valor em um percentual, ou a variação percentual entre dois valores (ex.: de R$ 100 para R$ 150).',
      },
      {
        title: "Qual a fórmula usada?",
        body: "X% de Y = (X ÷ 100) × Y. Para saber quantos % X representa de Y, a conta é (X ÷ Y) × 100. Aumentos e reduções multiplicam o valor por (1 + X/100) ou (1 − X/100). A variação percentual entre dois valores é ((valor final − valor inicial) ÷ valor inicial) × 100.",
      },
      {
        title: "Exemplo prático",
        body: "Uma calça custava R$ 100 e passou a custar R$ 150. A variação percentual é ((150 − 100) ÷ 100) × 100 = 50% de aumento.",
      },
    ],
    faq: [
      {
        question: "Os meus dados ficam armazenados?",
        answer: "Não. Todo o cálculo acontece no seu navegador; nenhum valor digitado é enviado ou guardado pela Alilu.",
      },
      {
        question: "Posso usar percentuais acima de 100%?",
        answer: "Sim, em todos os modos exceto onde isso não faria sentido matematicamente (a calculadora avisa quando um valor não é válido).",
      },
    ],
  },

  markup: {
    contentSections: [
      {
        title: "O que é markup?",
        body: 'Markup é o índice usado para formar o preço de venda a partir do custo, cobrindo despesas variáveis (impostos, comissões, taxas de cartão), despesas fixas rateadas e a margem de lucro desejada — todas expressas como percentual do PREÇO DE VENDA, não do custo. Por isso usamos o método do "markup divisor": preço de venda = custo ÷ [(100 − soma dos percentuais) ÷ 100].',
      },
      {
        title: "Por que não simplesmente somar os percentuais ao custo?",
        body: "Porque despesas e margem incidem sobre o preço de venda final, que ainda não existe no momento do cálculo — somar diretamente ao custo sempre resulta em um preço menor do que o necessário para cobrir tudo o que foi planejado.",
      },
      {
        title: "Exemplo prático",
        body: "Custo de R$ 100, sem despesas, com margem de lucro desejada de 20%: divisor = (100 − 20) / 100 = 0,80; preço de venda = 100 ÷ 0,80 = R$ 125,00.",
      },
    ],
    faq: [
      {
        question: "Qual a diferença entre este cálculo e a Calculadora de Margem de Lucro?",
        answer: "O Markup FORMA um preço de venda a partir do custo e de percentuais desejados. A Margem de Lucro ANALISA um custo e um preço de venda que você já pratica.",
      },
      {
        question: "Os meus dados ficam armazenados?",
        answer: "Não. Todo o cálculo acontece no seu navegador.",
      },
    ],
  },

  "margem-de-lucro": {
    contentSections: [
      {
        title: "O que é margem de lucro?",
        body: "É o percentual do preço de venda que representa lucro: margem = (preço de venda − custo) ÷ preço de venda × 100. É diferente do markup, que compara o lucro com o CUSTO em vez do preço de venda.",
      },
      {
        title: "Margem ou markup: qual usar?",
        body: "Ambos vêm dos mesmos dois números (custo e preço), mas respondem perguntas diferentes. Margem responde \"que fatia do preço de venda é lucro?\"; markup responde \"quanto o preço de venda está acima do custo?\". Por isso os dois são mostrados lado a lado.",
      },
    ],
    faq: [
      {
        question: "O resultado pode ser negativo?",
        answer: "Sim, quando o preço de venda é menor que o custo — isso indica prejuízo, e a calculadora mostra o valor normalmente, sem esconder.",
      },
      {
        question: "Os meus dados ficam armazenados?",
        answer: "Não. Todo o cálculo acontece no seu navegador.",
      },
    ],
  },

  "dias-uteis": {
    contentSections: [
      {
        title: "Como funciona o cálculo de dias úteis?",
        body: "Você informa a data inicial e a final; a calculadora conta os dias corridos entre elas e retira sábados, domingos e (se você escolher) os feriados nacionais, mostrando cada contagem separadamente.",
      },
      {
        title: "Quais feriados são considerados?",
        body: "Somente feriados NACIONAIS fixados por lei federal (Confraternização Universal, Tiradentes, Dia do Trabalho, Independência, Nossa Senhora Aparecida, Finados, Proclamação da República, Consciência Negra e Natal) e a Sexta-feira Santa, móvel, calculada a partir da Páscoa (Corpus Christi é opcional). O Carnaval NÃO entra na contagem: é ponto facultativo, não feriado nacional obrigatório. Feriados estaduais, municipais e pontos facultativos (incluindo o Carnaval) NÃO são considerados, pois não existe uma fonte única e confiável para todos os municípios do Brasil.",
      },
    ],
    faq: [
      {
        question: "A calculadora considera feriados da minha cidade?",
        answer: "Não. Só feriados nacionais são considerados, e isso é informado claramente no resultado.",
      },
      {
        question: "Os meus dados ficam armazenados?",
        answer: "Não. Todo o cálculo acontece no seu navegador.",
      },
    ],
  },

  "divisao-de-despesas": {
    contentSections: [
      {
        title: "Como dividir uma conta?",
        body: 'Escolha "dividir igualmente" para repartir o total entre todos, ou "cada um paga o que consumiu" para informar o valor gasto por cada participante — nesse modo, a taxa de serviço e o desconto são rateados proporcionalmente ao que cada um consumiu.',
      },
      {
        title: "Como funciona a taxa de serviço e o desconto?",
        body: "Ambos incidem sobre o valor total da conta antes da divisão. A taxa de serviço aumenta o total; o desconto reduz. No modo personalizado, cada participante recebe sua parte proporcional desse ajuste.",
      },
    ],
    faq: [
      {
        question: "Os nomes e valores ficam salvos?",
        answer: "Não. Nada digitado é enviado ou armazenado — tudo acontece no seu navegador.",
      },
      {
        question: "Posso dividir entre uma pessoa só?",
        answer: "Sim, embora nesse caso o valor por pessoa seja simplesmente o total da conta.",
      },
    ],
  },

  "hora-extra": {
    contentSections: [
      {
        title: "Como é calculado o valor da hora extra?",
        body: "Primeiro se calcula o valor da hora normal (salário mensal dividido pelo divisor de horas mensais, que é a jornada semanal × 5 — por exemplo, 220 para 44h semanais). Depois aplica-se o adicional (no mínimo 50%, conforme art. 7º, XVI, da Constituição) sobre essa hora.",
      },
      {
        title: "Por que o divisor é jornada × 5?",
        body: "É o divisor padrão de mercado para transformar salário mensal em valor da hora, confirmado pela Súmula 431 do TST para jornada de 40h (divisor 200) e consolidado na prática para 44h (divisor 220).",
      },
      {
        title: "Exemplo prático",
        body: "Salário de R$ 2.200, jornada de 44h (divisor 220): a hora normal vale R$ 10,00. Com adicional de 50%, a hora extra vale R$ 15,00. Para 10 horas extras, o total é R$ 150,00.",
      },
    ],
    faq: [
      {
        question: "O adicional pode ser diferente de 50%?",
        answer: "Sim. Convenções coletivas podem prever adicional maior — 100% é comum para horas trabalhadas em domingos e feriados.",
      },
      {
        question: "Os meus dados ficam armazenados?",
        answer: "Não. Todo o cálculo acontece no seu navegador.",
      },
    ],
  },

  parcelamento: {
    contentSections: [
      {
        title: "Como funciona a Calculadora de Parcelamento?",
        body: "Informe o valor da compra, uma entrada (opcional), a taxa de juros e o número de parcelas. O cálculo usa o sistema de prestação constante (Tabela Price) — o mesmo motor usado no Simulador de Financiamento SAC x Price — mostrando o valor de cada parcela, o total pago e o total de juros.",
      },
      {
        title: "Parcelamento sem juros",
        body: "Deixe a taxa de juros em 0% para simular um parcelamento sem juros: nesse caso, o valor da parcela é simplesmente o valor a financiar dividido pelo número de parcelas.",
      },
    ],
    faq: [
      {
        question: "A calculadora considera juros compostos?",
        answer: "Sim. O sistema de prestação constante (Price) usado aqui é o mesmo dos financiamentos bancários, com juros compostos incidindo sobre o saldo devedor.",
      },
      {
        question: "Os meus dados ficam armazenados?",
        answer: "Não. Todo o cálculo acontece no seu navegador.",
      },
    ],
  },

  "financiamento-veiculo": {
    contentSections: [
      {
        title: "Como simular o financiamento do meu veículo?",
        body: "Informe o preço do veículo, uma entrada (opcional), a taxa de juros contratada e o número de parcelas. A simulação usa o sistema de prestação constante (Tabela Price), o formato mais comum oferecido por bancos e financeiras para veículos.",
      },
      {
        title: "Por que o valor pode ser diferente do que o banco oferece?",
        body: "Esta calculadora simula apenas a matemática financeira do financiamento (juros compostos sobre o saldo devedor). Tarifas, seguros, impostos (IOF) e o Custo Efetivo Total (CET) — que a instituição financeira é obrigada a informar — podem alterar o valor final contratado.",
      },
    ],
    faq: [
      {
        question: "O resultado é o valor exato que vou pagar no banco?",
        answer: "Não necessariamente. É uma simulação matemática do financiamento; o CET informado pela instituição financeira é a referência oficial para comparar propostas, pois inclui todas as taxas e tarifas.",
      },
      {
        question: "Os meus dados ficam armazenados?",
        answer: "Não. Todo o cálculo acontece no seu navegador.",
      },
    ],
  },

  "quanto-guardar-por-mes": {
    contentSections: [
      {
        title: "Como funciona o cálculo?",
        body: "Você informa a meta financeira, quanto já tem guardado, o prazo e a rentabilidade estimada do investimento. A calculadora resolve a fórmula de juros compostos com aportes mensais para descobrir quanto você precisa guardar todo mês para chegar à meta dentro do prazo.",
      },
      {
        title: "E se eu não souber a rentabilidade?",
        body: "Deixe o campo de rentabilidade em branco (ou 0%) para simular guardando o dinheiro sem rendimento — o resultado será simplesmente a meta dividida pelo número de meses.",
      },
    ],
    faq: [
      {
        question: "E se eu já tiver dinheiro suficiente guardado?",
        answer: "A calculadora mostra que a meta já é alcançável com o valor disponível e a rentabilidade informada, sem necessidade de novos aportes.",
      },
      {
        question: "A rentabilidade real do meu investimento é garantida?",
        answer: "Não. Esta é uma simulação com rentabilidade constante; investimentos reais têm rentabilidade variável, então o resultado real pode ser diferente do estimado.",
      },
      {
        question: "Os meus dados ficam armazenados?",
        answer: "Não. Todo o cálculo acontece no seu navegador.",
      },
    ],
  },

  "salario-liquido": {
    contentSections: [
      {
        title: "Como é calculado o salário líquido?",
        body: "A partir do salário bruto, descontamos o INSS (contribuição previdenciária, pela tabela progressiva com parcela a deduzir) e o IRRF (imposto de renda retido na fonte, também progressivo, considerando dependentes). Você também pode informar outros descontos, como vale-transporte ou plano de saúde.",
      },
      {
        title: "De onde vêm as tabelas de INSS e IRRF?",
        body: "As tabelas usadas são as vigentes a partir de janeiro de 2026, publicadas pela Previdência Social (Portaria Interministerial MPS/MF nº 13/2026) e pela Receita Federal (Lei nº 15.191/2025). Elas são revisadas sempre que uma nova norma altera os valores.",
      },
    ],
    faq: [
      {
        question: "O resultado é igual ao do meu holerite?",
        answer: "Pode haver diferenças: o holerite oficial pode incluir outras rubricas (horas extras, comissões, adicionais, pensão alimentícia) e o ajuste anual da declaração de Imposto de Renda não é calculado aqui.",
      },
      {
        question: "Os meus dados ficam armazenados?",
        answer: "Não. Todo o cálculo acontece no seu navegador — nenhum dado salarial é enviado a nenhum servidor.",
      },
    ],
  },

  "calculadora-ferias": {
    contentSections: [
      {
        title: "Como funciona o cálculo das férias?",
        body: "O valor das férias é o salário diário multiplicado pelos dias gozados, acrescido do terço constitucional (1/3). Se você vender parte das férias (abono pecuniário, até 10 dos 30 dias), esse valor também entra com seu respectivo terço — o abono em si é isento de INSS e IRRF, mas o terço constitucional sobre o abono, embora isento de INSS, é tributável para fins de IRRF.",
      },
      {
        title: "O que é o abono pecuniário?",
        body: "É a possibilidade de \"vender\" até 1/3 dos dias de férias (10 de 30) para o empregador, recebendo o valor correspondente em dinheiro em vez de descansar esses dias (art. 143 da CLT). É uma verba indenizatória, isenta de INSS e IRRF — mas o terço constitucional calculado sobre esse valor não tem a mesma isenção de IRRF (apenas de INSS).",
      },
    ],
    faq: [
      {
        question: "Os descontos de INSS e IRRF incidem sobre o abono pecuniário?",
        answer: "O abono pecuniário em si é isento de INSS e de IRRF. Já o terço constitucional sobre o abono é isento de INSS, mas entra na base de cálculo do IRRF. O valor das férias efetivamente gozadas (+ 1/3) sofre desconto de INSS e IRRF normalmente.",
      },
      {
        question: "Os meus dados ficam armazenados?",
        answer: "Não. Todo o cálculo acontece no seu navegador.",
      },
    ],
  },

  "decimo-terceiro": {
    contentSections: [
      {
        title: "Como é calculado o 13º salário?",
        body: "O valor bruto proporcional é o salário dividido por 12, multiplicado pelos meses trabalhados no ano (mês com 15 dias ou mais conta como completo). A 1ª parcela (50%) é paga sem descontos; a 2ª parcela concentra o INSS e o IRRF calculados sobre o valor bruto total do 13º.",
      },
      {
        title: "Por que os descontos ficam só na 2ª parcela?",
        body: "É assim que funciona na prática de folha de pagamento: a 1ª parcela é um adiantamento sem desconto algum, e todo o INSS/IRRF do 13º inteiro é calculado e descontado de uma vez na 2ª parcela.",
      },
    ],
    faq: [
      {
        question: "Quem trabalhou o ano inteiro recebe o 13º integral?",
        answer: "Sim, desde que tenha trabalhado os 12 meses do ano (ou tenha 15 dias ou mais em cada mês considerado).",
      },
      {
        question: "Os meus dados ficam armazenados?",
        answer: "Não. Todo o cálculo acontece no seu navegador.",
      },
    ],
  },

  "custo-funcionario": {
    contentSections: [
      {
        title: "O que entra no custo de um funcionário além do salário?",
        body: "Encargos patronais (INSS patronal, RAT e contribuições a terceiros, no regime geral), FGTS sobre o salário, provisões mensais de férias e 13º (+ FGTS sobre essas provisões) e benefícios como vale-transporte, vale-refeição e plano de saúde.",
      },
      {
        title: "Regime geral ou Simples Nacional: por que isso importa?",
        body: "No Simples Nacional, o INSS patronal, o RAT e as contribuições a terceiros já estão embutidos na alíquota unificada do DAS — por isso a calculadora não os soma separadamente nesse regime, para não contar o mesmo encargo duas vezes. Você escolhe o regime explicitamente antes de calcular.",
      },
    ],
    faq: [
      {
        question: "A calculadora presume algum regime tributário?",
        answer: "Não. Você precisa escolher explicitamente entre regime geral (Lucro Presumido/Real) e Simples Nacional antes de ver o resultado.",
      },
      {
        question: "As provisões de férias e 13º são um desconto do funcionário?",
        answer: "Não. São estimativas contábeis do custo médio mensal desses direitos para a empresa, não um valor descontado do salário do funcionário.",
      },
      {
        question: "Os meus dados ficam armazenados?",
        answer: "Não. Todo o cálculo acontece no seu navegador.",
      },
    ],
  },

  "calculadora-rescisao": {
    contentSections: [
      {
        title: "Quais tipos de desligamento esta calculadora cobre?",
        body: "Apenas dois: dispensa sem justa causa (pelo empregador) e pedido de demissão (pelo empregado). Justa causa, acordo mútuo (distrato), término de contrato de experiência, aposentadoria e falecimento NÃO são cobertos, por exigirem regras adicionais e mais sujeitas a controvérsia.",
      },
      {
        title: "Quais verbas são calculadas?",
        body: "Saldo de salário, aviso prévio indenizado proporcional (só na dispensa sem justa causa, conforme a Lei nº 12.506/2011), férias vencidas e proporcionais (+ 1/3), 13º salário proporcional e a multa de 40% do FGTS (opcional, a partir do saldo informado pelo usuário a partir do extrato).",
      },
    ],
    faq: [
      {
        question: "Esta calculadora substitui o TRCT ou a homologação?",
        answer: "Não. É uma estimativa para fins de referência. O Termo de Rescisão do Contrato de Trabalho (TRCT) oficial, a eventual homologação e a orientação de um contador, sindicato ou advogado continuam sendo necessários.",
      },
      {
        question: "Por que a calculadora não calcula o saldo do FGTS?",
        answer: "Porque o saldo do FGTS depende do histórico real de depósitos ao longo de todo o contrato, que esta ferramenta não tem acesso. Por isso, para calcular a multa de 40%, você informa o saldo a partir do seu extrato do FGTS.",
      },
      {
        question: "Os meus dados ficam armazenados?",
        answer: "Não. Todo o cálculo acontece no seu navegador.",
      },
    ],
  },

  "qr-code": {
    contentSections: [
      {
        title: "Como funciona o Gerador de QR Code?",
        body: "Escolha se quer codificar um link (URL) ou um texto livre, digite o conteúdo e clique em gerar. O QR Code é desenhado inteiramente no seu navegador — nenhum dado digitado é enviado para a Alilu ou para qualquer servidor.",
      },
      {
        title: "O QR Code aponta direto para o meu link?",
        body: "Sim. O conteúdo codificado é sempre o texto ou link exatamente como você digitou, nunca um link intermediário ou encurtador da Alilu — por isso o QR Code continua funcionando mesmo se esta ferramenta sair do ar.",
      },
    ],
    faq: [
      {
        question: "Os QR Codes gerados expiram?",
        answer: "Não. Como o conteúdo é fixo (o texto ou link que você digitou), o QR Code funciona enquanto esse conteúdo existir — não há dependência de nenhum serviço da Alilu.",
      },
      {
        question: "Os meus dados ficam armazenados?",
        answer: "Não. A geração acontece inteiramente no seu navegador.",
      },
    ],
  },

  "leitor-xml-nfe": {
    contentSections: [
      {
        title: "Como funciona o Leitor de XML de NF-e?",
        body: "Selecione o arquivo XML de uma Nota Fiscal Eletrônica. O arquivo é lido inteiramente no seu navegador (nunca enviado para nenhum servidor) e os dados principais — identificação, emitente, destinatário, produtos e totais — são extraídos e exibidos de forma organizada.",
      },
      {
        title: "É seguro abrir um XML de NF-e aqui?",
        body: "Sim. O navegador interpreta o XML apenas como dados (texto e estrutura), nunca como código executável ou HTML — não há risco de o conteúdo do arquivo executar algo no seu navegador.",
      },
    ],
    faq: [
      {
        question: "O arquivo é enviado para algum servidor?",
        answer: "Não. Toda a leitura acontece localmente, no seu navegador, usando a API nativa do navegador para arquivos.",
      },
      {
        question: "O que acontece se eu selecionar um XML inválido ou de outro tipo?",
        answer: "A ferramenta mostra uma mensagem de erro clara, sem travar, indicando que o arquivo não pôde ser lido como XML ou não é uma NF-e.",
      },
    ],
  },

  "unir-pdf": {
    contentSections: [
      {
        title: "Como unir arquivos PDF?",
        body: "Selecione pelo menos dois arquivos PDF, confira a ordem em que eles aparecem na lista, reorganize quando necessário e clique em \"Unir PDFs\". Ao terminar, baixe o novo documento em um único arquivo.",
      },
      {
        title: "Por que utilizar o ALILU para juntar PDFs?",
        body: "A união acontece diretamente no navegador, sem cadastro nem instalação de programas. Seus arquivos permanecem no seu dispositivo durante o processo e o PDF final só é criado quando você escolhe unir a lista.",
      },
      {
        title: "Posso unir PDFs pelo celular?",
        body: "Sim. Abra esta página no navegador do celular, escolha os documentos do aparelho e use os botões de mover para cima ou para baixo para ajustar a sequência antes de gerar o arquivo final.",
      },
      {
        title: "Meus documentos ficam armazenados?",
        body: "Não. Os documentos são lidos temporariamente pelo navegador para montar o PDF final. Esta ferramenta não envia, salva ou registra os arquivos nos servidores da ALILU.",
      },
    ],
    faq: [
      {
        question: "Como juntar dois arquivos PDF?",
        answer: "Adicione os dois arquivos à lista, deixe-os na ordem desejada e clique em \"Unir PDFs\". Quando a operação terminar, use o botão para baixar o documento resultante.",
      },
      {
        question: "Posso juntar mais de dois PDFs?",
        answer: "Sim. Você pode adicionar quantos arquivos forem necessários dentro do limite técnico mostrado na ferramenta: até 50 MB por arquivo e 150 MB no total.",
      },
      {
        question: "É possível alterar a ordem dos arquivos?",
        answer: "Sim. Em computadores, arraste os itens da lista. Em qualquer dispositivo, use os botões de mover para cima e para baixo ao lado de cada arquivo.",
      },
      {
        question: "Preciso instalar algum programa?",
        answer: "Não. A ferramenta funciona diretamente no navegador, sem instalar programas ou extensões.",
      },
      {
        question: "O serviço é gratuito?",
        answer: "Sim. A união de PDFs no ALILU é gratuita e não exige cadastro.",
      },
      {
        question: "Posso juntar PDFs protegidos por senha?",
        answer: "Não. Por segurança, PDFs protegidos por senha precisam ser desbloqueados por você antes de serem adicionados à lista. Assinaturas digitais válidas também não são preservadas ao gerar um novo documento.",
      },
    ],
  },

  "gerador-cpf": {
    contentSections: [
      {
        title: "Como funciona o Gerador de CPF?",
        body: "Os 9 primeiros dígitos são sorteados no seu navegador com crypto.getRandomValues (fonte criptograficamente segura, não Math.random) e os 2 dígitos verificadores são calculados pelo algoritmo oficial de módulo 11 — o mesmo usado para validar um CPF. Sequências totalmente repetidas, como 111.111.111-11, nunca são retornadas: se acontecer de sortear uma (extremamente raro), a ferramenta sorteia novamente.",
      },
      {
        title: "Para que serve gerar um CPF de teste?",
        body: "É útil para testar máscaras de formulário, mensagens de erro de validação, geração de massa de dados em ambientes de desenvolvimento/homologação e testes automatizados (QA) — sempre com números que não pertencem a nenhuma pessoa real.",
      },
      {
        title: "O CPF gerado é real?",
        body: "Não. A ferramenta não consulta a Receita Federal nem qualquer base de dados de pessoas — o número apenas passa na conta matemática do dígito verificador, o que não comprova que ele exista ou tenha sido emitido para alguém.",
      },
    ],
    faq: [
      {
        question: "O CPF gerado pode coincidir com o de uma pessoa real?",
        answer:
          "Matematicamente é possível (existem só 11 dígitos), mas a ferramenta não usa, consulta nem tem acesso a nenhuma base de dados de pessoas — a geração é puramente aleatória e sem qualquer relação com CPFs reais emitidos.",
      },
      {
        question: "Os CPFs gerados ficam armazenados?",
        answer:
          "Não. Toda a geração acontece no seu navegador; nenhum número gerado é enviado, salvo ou registrado em log pela Alilu.",
      },
      {
        question: "Posso gerar vários CPFs de uma vez?",
        answer:
          "Sim, em lote de até 100 por vez, com a opção de copiar todos de uma vez ou individualmente.",
      },
      {
        question: "Essa ferramenta serve para validar um CPF que eu já tenho?",
        answer:
          "Não, ela gera CPFs novos. Para validar um CPF existente, o campo de CPF/CNPJ usado em outras calculadoras do Alilu (como o Gerador de Recibo) já faz essa validação ao digitar.",
      },
    ],
  },

  "gerador-cnpj": {
    contentSections: [
      {
        title: "Como funciona o Gerador de CNPJ?",
        body: "Os 12 primeiros caracteres são sorteados no seu navegador com crypto.getRandomValues, e os 2 dígitos verificadores são calculados pelo algoritmo oficial de módulo 11 da Receita Federal — cada caractere entra na conta pelo seu valor numérico (dígitos 0-9 mantêm o próprio valor; letras A-Z valem de 17 a 42), o mesmo cálculo usado para validar um CNPJ.",
      },
      {
        title: "O que é o CNPJ alfanumérico?",
        body: "É o novo formato de CNPJ da Receita Federal (Instrução Normativa RFB nº 2.229/2024), que permite letras maiúsculas nos 12 primeiros caracteres além dos números — os 2 dígitos verificadores continuam sempre numéricos. CNPJs já existentes continuam válidos normalmente; o formato numérico tradicional não deixa de funcionar.",
      },
      {
        title: "Para que serve gerar um CNPJ de teste?",
        body: "Para testar máscaras de formulário preparadas para o novo formato alfanumérico, validações de cadastro de empresas, integrações e massa de dados em ambientes de desenvolvimento — sem usar o CNPJ de nenhuma empresa real.",
      },
    ],
    faq: [
      {
        question: "O CNPJ alfanumérico já está em uso obrigatório?",
        answer:
          "A Receita Federal publicou o novo formato pela Instrução Normativa RFB nº 2.229/2024; consulte sempre a documentação oficial da Receita Federal para a data de vigência atualizada antes de decidir quando adaptar seus sistemas.",
      },
      {
        question: "O CNPJ gerado corresponde a uma empresa real?",
        answer:
          "Não. Esta ferramenta não consulta cadastros empresariais — o número apenas passa na conta matemática do dígito verificador, o que não comprova cadastro ou existência de empresa alguma.",
      },
      {
        question: "Os CNPJs gerados ficam armazenados?",
        answer:
          "Não. Toda a geração acontece no seu navegador; nenhum número gerado é enviado, salvo ou registrado em log pela Alilu.",
      },
      {
        question: "Posso gerar CNPJ numérico e alfanumérico na mesma página?",
        answer:
          "Sim, escolha o tipo desejado no campo \"Tipo de CNPJ\" antes de gerar — os dois modos usam o mesmo gerador.",
      },
    ],
  },

  "gerador-cartao-credito": {
    contentSections: [
      {
        title: "Como funciona o Gerador de Cartão de Crédito de Teste?",
        body: "Escolha entre números de teste oficialmente documentados por processadores de pagamento (modo recomendado) ou números sintéticos gerados aleatoriamente no seu navegador, sempre validados pelo algoritmo de Luhn. Nenhuma validade (mês/ano) ou CVV é gerado — apenas o número do cartão.",
      },
      {
        title: "Qual a diferença entre \"Teste oficial\" e \"Sintético\"?",
        body: "\"Teste oficial\" retorna um dos números de teste publicamente documentados pelas bandeiras e processadores de pagamento (ex.: 4242 4242 4242 4242 para Visa), prontos para uso em ambientes de desenvolvimento que já reconhecem esses números. \"Sintético\" gera um número aleatório Luhn-válido, seguindo apenas o comprimento e o dígito de rede de cada bandeira — não corresponde a nenhuma faixa real de banco emissor e não é reconhecido por nenhum sandbox de pagamento.",
      },
      {
        title: "O que é o algoritmo de Luhn?",
        body: "É a fórmula matemática (soma ponderada com dígito verificador) usada pelas bandeiras de cartão para detectar erros de digitação. Um número Luhn-válido tem a estrutura correta de um número de cartão, mas isso não significa que ele tenha sido emitido por um banco, esteja ativo ou autorizado para qualquer transação.",
      },
    ],
    faq: [
      {
        question: "Esses números funcionam em compras reais?",
        answer:
          "Não. São exclusivamente para testar máscaras de formulário e validações — não são cartões emitidos e não devem ser usados em transações reais.",
      },
      {
        question: "A ferramenta gera validade e CVV também?",
        answer:
          "Não, nunca. Apenas o número do cartão é gerado, justamente para evitar montar uma combinação que pareça uma credencial completa de pagamento.",
      },
      {
        question: "Os números sintéticos funcionam em sandboxes de pagamento?",
        answer:
          "Não é garantido. Só os números do modo \"Teste oficial\" são reconhecidos pelos processadores que os documentam publicamente. Para testar pagamentos de verdade, use sempre os cartões oficiais do ambiente sandbox do seu provedor.",
      },
      {
        question: "Os números gerados ficam armazenados?",
        answer:
          "Não. Toda a geração acontece no seu navegador; nenhum número é enviado, salvo em analytics ou registrado em log pela Alilu.",
      },
    ],
  },

  "gerador-pis-pasep": {
    contentSections: [
      {
        title: "Como funciona o Gerador de PIS/PASEP?",
        body: "Os 10 primeiros dígitos são sorteados no seu navegador com crypto.getRandomValues, e o dígito verificador é calculado pelo mesmo algoritmo de módulo 11 usado pelo eSocial/CAGED para validar um NIT/PIS/PASEP — pesos [3,2,9,8,7,6,5,4,3,2] aplicados aos 10 dígitos-base.",
      },
      {
        title: "Para que serve gerar um PIS/PASEP de teste?",
        body: "Para testar máscaras de formulário, validações de cadastro de funcionários e integrações com sistemas de folha de pagamento em ambientes de desenvolvimento — sempre com números que não pertencem a nenhum trabalhador real.",
      },
      {
        title: "O PIS/PASEP gerado é real?",
        body: "Não. A ferramenta não consulta a Caixa Econômica Federal nem o eSocial — o número apenas passa na conta matemática do dígito verificador, o que não comprova que ele exista ou tenha sido emitido para alguém.",
      },
    ],
    faq: [
      {
        question: "Os números gerados ficam armazenados?",
        answer:
          "Não. Toda a geração acontece no seu navegador; nenhum número é enviado, salvo ou registrado em log pela Alilu.",
      },
      {
        question: "Posso gerar vários PIS/PASEP de uma vez?",
        answer: "Sim, em lote de até 100 por vez, com a opção de copiar todos de uma vez ou individualmente.",
      },
      {
        question: "O dígito verificador segue o mesmo cálculo do sistema real?",
        answer:
          "Sim, é o mesmo algoritmo público de módulo 11 usado para validar um PIS/PASEP — o que muda é que os 10 dígitos-base são sorteados, não vinculados a nenhum trabalhador.",
      },
    ],
  },

  "gerador-renavam": {
    contentSections: [
      {
        title: "Como funciona o Gerador de RENAVAM?",
        body: "Os 10 primeiros dígitos são sorteados no seu navegador com crypto.getRandomValues, e o dígito verificador é calculado pelo algoritmo documentado publicamente para o RENAVAM (pesos [2,3,4,5,6,7,8,9,2,3] aplicados aos dígitos invertidos).",
      },
      {
        title: "Para que serve gerar um RENAVAM de teste?",
        body: "Para testar máscaras de formulário e validações em sistemas de cadastro de veículos, seguros e financiamentos, em ambientes de desenvolvimento — sempre com números que não correspondem a nenhum veículo real.",
      },
      {
        title: "O RENAVAM gerado é real?",
        body: "Não. A ferramenta não consulta o DETRAN nem a Base Índice Nacional de Veículos — o número apenas passa na conta matemática do dígito verificador, o que não comprova a existência de um veículo real.",
      },
    ],
    faq: [
      {
        question: "Os números gerados ficam armazenados?",
        answer:
          "Não. Toda a geração acontece no seu navegador; nenhum número é enviado, salvo ou registrado em log pela Alilu.",
      },
      {
        question: "Posso gerar vários RENAVAM de uma vez?",
        answer: "Sim, em lote de até 100 por vez, com a opção de copiar todos de uma vez ou individualmente.",
      },
    ],
  },

  "gerador-cnh": {
    contentSections: [
      {
        title: "Como funciona o Gerador de CNH?",
        body: "Os 9 primeiros dígitos são sorteados no seu navegador com crypto.getRandomValues, e os 2 dígitos verificadores são calculados pelo algoritmo do DENATRAN reproduzido por validadores públicos de terceiros.",
      },
      {
        title: "Para que serve gerar uma CNH de teste?",
        body: "Para testar máscaras de formulário e validações em cadastros que pedem número de CNH (locadoras, aplicativos de transporte, seguradoras), em ambientes de desenvolvimento — sempre com números que não correspondem a nenhuma habilitação real.",
      },
      {
        title: "A CNH gerada é real?",
        body: "Não. A ferramenta não consulta o DENATRAN nem o RENACH — o número apenas passa na conta matemática dos dois dígitos verificadores, o que não comprova a existência de uma habilitação real.",
      },
    ],
    faq: [
      {
        question: "Os números gerados ficam armazenados?",
        answer:
          "Não. Toda a geração acontece no seu navegador; nenhum número é enviado, salvo ou registrado em log pela Alilu.",
      },
      {
        question: "Posso gerar várias CNH de uma vez?",
        answer: "Sim, em lote de até 100 por vez, com a opção de copiar todas de uma vez ou individualmente.",
      },
    ],
  },

  "gerador-titulo-eleitor": {
    contentSections: [
      {
        title: "Como funciona o Gerador de Título de Eleitor?",
        body: "Você escolhe o estado (ou deixa sortear), a ferramenta sorteia 8 dígitos de sequencial com crypto.getRandomValues e calcula os 2 dígitos verificadores pelo algoritmo público do TSE, a partir do sequencial e do código da UF escolhida.",
      },
      {
        title: "O gerador reproduz exatamente o sistema do TSE?",
        body: "Quase: São Paulo e Minas Gerais já usam, no mundo real, um sequencial de 9 dígitos (por terem emitido mais de 99.999.999 títulos ao longo da história) — este gerador usa sempre 8 dígitos para todos os estados, o que é suficiente para testar máscaras e validações de formulário, mas não é uma cópia bit-a-bit do sistema oficial.",
      },
      {
        title: "O título gerado é real?",
        body: "Não. A ferramenta não consulta o TSE nem o cadastro de eleitores — o número apenas passa na conta matemática dos dois dígitos verificadores, o que não comprova a existência de um título real.",
      },
    ],
    faq: [
      {
        question: "Os números gerados ficam armazenados?",
        answer:
          "Não. Toda a geração acontece no seu navegador; nenhum número é enviado, salvo ou registrado em log pela Alilu.",
      },
      {
        question: "Posso escolher o estado (UF) do título gerado?",
        answer: "Sim, selecione o estado desejado ou deixe em \"Sortear estado\" para uma UF aleatória.",
      },
    ],
  },

  "gerador-placa-veiculo": {
    contentSections: [
      {
        title: "Como funciona o Gerador de Placa de Veículo?",
        body: "Escolha o padrão Mercosul (3 letras, 1 número, 1 letra, 2 números — em vigor desde 2018) ou o padrão antigo (3 letras, 4 números, com hífen). Todos os caracteres são sorteados no seu navegador com crypto.getRandomValues.",
      },
      {
        title: "As placas geradas correspondem a veículos reais?",
        body: "Não. São combinações aleatórias de letras e números dentro do formato oficial — a ferramenta não consulta o DETRAN nem qualquer cadastro de veículos, e não garante que a combinação não esteja em uso por outro veículo.",
      },
    ],
    faq: [
      {
        question: "As placas geradas ficam armazenadas?",
        answer:
          "Não. Toda a geração acontece no seu navegador; nenhuma placa é enviada, salva ou registrada em log pela Alilu.",
      },
      {
        question: "Qual a diferença entre o padrão Mercosul e o antigo?",
        answer:
          "O padrão Mercosul (LLL0L00, ex.: ABC1D23) está em vigor desde 2018 e não usa hífen. O padrão antigo (LLL-0000, ex.: ABC-1234) foi usado no Brasil até a transição para o Mercosul.",
      },
    ],
  },

  "gerador-senha": {
    contentSections: [
      {
        title: "Como funciona o Gerador de Senha?",
        body: "Escolha o tamanho e quais tipos de caractere incluir (maiúsculas, minúsculas, números e símbolos). A senha é montada no seu navegador com crypto.getRandomValues, garantindo pelo menos 1 caractere de cada tipo selecionado e embaralhando o resultado.",
      },
      {
        title: "Como é calculada a força da senha?",
        body: "Por uma estimativa de entropia (tamanho da senha × log2 do tamanho do alfabeto disponível). É um indicador rápido, não uma análise completa contra dicionários de senhas vazadas — para contas importantes, prefira sempre o tamanho máximo com todos os tipos de caractere habilitados.",
      },
    ],
    faq: [
      {
        question: "As senhas geradas ficam armazenadas?",
        answer:
          "Não. Toda a geração acontece no seu navegador; nenhuma senha é enviada, salva ou registrada em log pela Alilu.",
      },
      {
        question: "Qual tamanho de senha eu devo usar?",
        answer:
          "Quanto maior, melhor. Para a maioria dos serviços, recomenda-se pelo menos 12-16 caracteres com todos os tipos de caractere habilitados.",
      },
      {
        question: "Posso usar a mesma senha em vários serviços?",
        answer:
          "Não é recomendado. Gere uma senha diferente para cada serviço e considere usar um gerenciador de senhas para guardá-las com segurança.",
      },
    ],
  },

  "gerador-numeros-aleatorios": {
    contentSections: [
      {
        title: "Como funciona o Gerador de Números Aleatórios?",
        body: "Informe o intervalo (mínimo e máximo) e a quantidade de números desejada. A geração usa crypto.getRandomValues no seu navegador, com a opção de permitir ou não números repetidos no resultado.",
      },
      {
        title: "Qual a diferença para o Sorteador de Números?",
        body: "Esta ferramenta é voltada para uso geral (testes, amostragens) e permite repetição por padrão. O Sorteador de Números é focado em sorteios/rifas e nunca repete um número no mesmo resultado, por padrão.",
      },
    ],
    faq: [
      {
        question: "Os números gerados são realmente aleatórios?",
        answer:
          "Sim, usam a Web Crypto API (crypto.getRandomValues), uma fonte de aleatoriedade criptograficamente segura — não Math.random.",
      },
      {
        question: "Os números gerados ficam armazenados?",
        answer:
          "Não. Toda a geração acontece no seu navegador; nenhum número é enviado, salvo ou registrado em log pela Alilu.",
      },
    ],
  },

  "sorteador-numeros": {
    contentSections: [
      {
        title: "Como funciona o Sorteador de Números?",
        body: "Informe o intervalo (mínimo e máximo) e quantos números sortear. Por padrão, cada número sorteado aparece uma única vez no resultado — ideal para rifas, bingos e sorteios entre grupos de pessoas. A geração usa crypto.getRandomValues no seu navegador.",
      },
      {
        title: "Posso sortear com números repetidos?",
        body: "Sim, marque a opção \"Permitir números repetidos no sorteio\" se o seu caso de uso precisar disso (por padrão, ela fica desmarcada, para o comportamento típico de um sorteio/rifa).",
      },
    ],
    faq: [
      {
        question: "O sorteio é justo?",
        answer:
          "Sim. Cada número dentro do intervalo tem a mesma probabilidade de ser sorteado, usando a Web Crypto API (crypto.getRandomValues) com amostragem sem viés.",
      },
      {
        question: "Os resultados do sorteio ficam armazenados?",
        answer:
          "Não. Todo o sorteio acontece no seu navegador; nenhum resultado é enviado, salvo ou registrado em log pela Alilu.",
      },
    ],
  },

  "gerador-nomes": {
    contentSections: [
      {
        title: "Como funciona o Gerador de Nomes?",
        body: "Escolha o tipo (nome completo ou só o primeiro nome), o gênero e, para nome completo, quantos sobrenomes incluir. O nome é montado no seu navegador combinando um primeiro nome e sobrenome(s) sorteados de listas comuns no Brasil.",
      },
      {
        title: "Os nomes gerados pertencem a pessoas reais?",
        body: "Não. São combinações aleatórias de primeiro nome + sobrenome(s) a partir de listas de nomes comuns — qualquer coincidência com uma pessoa real é possível (nomes comuns se repetem), mas não é intencional nem baseada em nenhum cadastro real.",
      },
    ],
    faq: [
      {
        question: "Os nomes gerados ficam armazenados?",
        answer:
          "Não. Toda a geração acontece no seu navegador; nenhum nome é enviado, salvo ou registrado em log pela Alilu.",
      },
      {
        question: "Posso gerar só o primeiro nome?",
        answer: "Sim, selecione \"Somente primeiro nome\" no campo Tipo.",
      },
    ],
  },

  "gerador-cep": {
    contentSections: [
      {
        title: "Como funciona o Gerador de CEP?",
        body: "Os 8 dígitos são sorteados no seu navegador com crypto.getRandomValues, no formato de CEP (00000-000). Como um CEP não tem dígito verificador (é uma numeração administrativa dos Correios), não há uma conta de validade a aplicar — só o formato.",
      },
      {
        title: "O CEP gerado corresponde a um endereço real?",
        body: "Não é garantido. A ferramenta não consulta os Correios nem qualquer base de endereços — o número apenas segue o formato de CEP, útil para testar máscaras e validações de formulário.",
      },
    ],
    faq: [
      {
        question: "Os CEPs gerados ficam armazenados?",
        answer:
          "Não. Toda a geração acontece no seu navegador; nenhum CEP é enviado, salvo ou registrado em log pela Alilu.",
      },
      {
        question: "Posso gerar vários CEPs de uma vez?",
        answer: "Sim, em lote de até 100 por vez, com a opção de copiar todos de uma vez ou individualmente.",
      },
    ],
  },

  "gerador-rg": {
    contentSections: [
      {
        title: "Como funciona o Gerador de RG?",
        body: "Os 8 dígitos-base são sorteados no seu navegador com crypto.getRandomValues, e o dígito verificador é calculado por um padrão ilustrativo de módulo 11 (o mesmo formato reproduzido por validadores públicos de terceiros para o padrão SSP-SP).",
      },
      {
        title: "O RG segue o padrão oficial de todos os estados?",
        body: "Não existe um padrão nacional único de RG: cada Secretaria de Segurança Pública estadual numera à sua própria maneira, sem um algoritmo unificado. Este gerador usa um formato ilustrativo apenas como estrutura plausível — não representa o padrão oficial de nenhum estado específico.",
      },
      {
        title: "O RG gerado é real?",
        body: "Não. A ferramenta não consulta nenhuma Secretaria de Segurança Pública — o número apenas segue o formato ilustrativo descrito acima.",
      },
    ],
    faq: [
      {
        question: "Os RGs gerados ficam armazenados?",
        answer:
          "Não. Toda a geração acontece no seu navegador; nenhum número é enviado, salvo ou registrado em log pela Alilu.",
      },
      {
        question: "Posso gerar vários RG de uma vez?",
        answer: "Sim, em lote de até 100 por vez, com a opção de copiar todos de uma vez ou individualmente.",
      },
    ],
  },

  "gerador-conta-bancaria": {
    contentSections: [
      {
        title: "Como funciona o Gerador de Conta Bancária?",
        body: "Escolha o banco (ou deixe sortear) e o tipo de conta. Agência (4 dígitos), conta (7 dígitos) e dígito verificador são sorteados no seu navegador com crypto.getRandomValues.",
      },
      {
        title: "O dígito verificador segue o algoritmo real do banco?",
        body: "Não. Cada banco usa um algoritmo interno e não público para calcular o dígito da conta — por isso esta ferramenta não reproduz o padrão oficial de nenhum banco. Os nomes de banco servem apenas como rótulo de exemplo para testar um campo \"banco\" de formulário.",
      },
    ],
    faq: [
      {
        question: "Os dados gerados ficam armazenados?",
        answer:
          "Não. Toda a geração acontece no seu navegador; nenhum dado é enviado, salvo ou registrado em log pela Alilu.",
      },
      {
        question: "Posso escolher o banco?",
        answer: "Sim, selecione um banco específico ou deixe em \"Sortear banco\".",
      },
    ],
  },

  "gerador-veiculo": {
    contentSections: [
      {
        title: "Como funciona o Gerador de Veículos?",
        body: "Marca e modelo são sorteados de uma lista de veículos populares no mercado brasileiro, junto com ano, cor, categoria (Hatch, Sedã, SUV, Picape) e tipo de combustível — tudo no seu navegador com crypto.getRandomValues.",
      },
      {
        title: "Qual a diferença para o Gerador de Placa de Veículo?",
        body: "Esta ferramenta gera dados gerais do veículo (marca, modelo, ano, cor). Para gerar uma placa fictícia no padrão Mercosul ou antigo, use o Gerador de Placa de Veículo.",
      },
      {
        title: "Os dados gerados correspondem a um veículo real?",
        body: "Não. São combinações fictícias — a ferramenta não consulta o DETRAN nem qualquer cadastro real de veículos.",
      },
    ],
    faq: [
      {
        question: "Os veículos gerados ficam armazenados?",
        answer:
          "Não. Toda a geração acontece no seu navegador; nenhum dado é enviado, salvo ou registrado em log pela Alilu.",
      },
      {
        question: "Posso gerar vários veículos de uma vez?",
        answer: "Sim, em lote de até 100 por vez, com a opção de copiar todos de uma vez ou individualmente.",
      },
    ],
  },

  "gerador-inscricao-estadual": {
    contentSections: [
      {
        title: "Como funciona o Gerador de Inscrição Estadual?",
        body: "Escolha o estado (UF) ou deixe sortear. Os 9 dígitos são sorteados no seu navegador com crypto.getRandomValues, em um formato genérico — sem aplicar o algoritmo de dígito verificador oficial de nenhuma UF específica.",
      },
      {
        title: "Por que o gerador não usa o algoritmo oficial de cada estado?",
        body: "Cada um dos 26 estados + DF define seu próprio formato e algoritmo de dígito verificador de Inscrição Estadual, de forma independente — não existe uma Receita Estadual única como há para CPF/CNPJ na Receita Federal. Esta primeira versão entrega a estrutura escalável (seletor de UF + formato de 9 dígitos); o algoritmo oficial de uma UF específica pode ser adicionado depois.",
      },
    ],
    faq: [
      {
        question: "Os números gerados ficam armazenados?",
        answer:
          "Não. Toda a geração acontece no seu navegador; nenhum número é enviado, salvo ou registrado em log pela Alilu.",
      },
      {
        question: "O número gerado é válido para o estado escolhido?",
        answer:
          "Não segue o dígito verificador oficial de nenhum estado específico — é um formato genérico de 9 dígitos, útil para testar campos de formulário que aceitam o valor como texto livre.",
      },
    ],
  },

  "gerador-pessoas": {
    contentSections: [
      {
        title: "Como funciona o Gerador de Pessoas?",
        body: "Combina os geradores de nome, CPF, RG e CEP já existentes com data de nascimento, telefone e e-mail sintéticos, formando um perfil fictício completo — tudo sorteado no seu navegador com crypto.getRandomValues.",
      },
      {
        title: "O perfil gerado é de uma pessoa real?",
        body: "Não. É uma combinação de dados sintéticos — o CPF e o RG usam os mesmos geradores já documentados nesta plataforma, e o restante (nome, data de nascimento, telefone, e-mail) é apenas uma combinação plausível, sem consulta a nenhuma base de dados real.",
      },
    ],
    faq: [
      {
        question: "Os dados gerados ficam armazenados?",
        answer:
          "Não. Toda a geração acontece no seu navegador; nenhum dado é enviado, salvo ou registrado em log pela Alilu.",
      },
      {
        question: "Posso escolher o gênero da pessoa gerada?",
        answer: "Sim, selecione \"Feminino\" ou \"Masculino\", ou deixe em \"Aleatório\".",
      },
    ],
  },

  "gerador-empresas": {
    contentSections: [
      {
        title: "Como funciona o Gerador de Empresas?",
        body: "Combina os geradores de CNPJ, Inscrição Estadual e CEP já existentes com nome fantasia, telefone e e-mail sintéticos, formando um perfil de empresa fictícia completo.",
      },
      {
        title: "O perfil gerado é de uma empresa real?",
        body: "Não. O CNPJ usa o mesmo gerador sintético já documentado nesta plataforma, e o nome fantasia é uma combinação aleatória de palavras genéricas — qualquer semelhança com uma empresa real é coincidência.",
      },
    ],
    faq: [
      {
        question: "Os dados gerados ficam armazenados?",
        answer:
          "Não. Toda a geração acontece no seu navegador; nenhum dado é enviado, salvo ou registrado em log pela Alilu.",
      },
      {
        question: "Posso gerar várias empresas de uma vez?",
        answer: "Sim, em lote de até 50 por vez, com a opção de copiar todos de uma vez ou individualmente.",
      },
    ],
  },

  "gerador-nicks": {
    contentSections: [
      {
        title: "Como funciona o Gerador de Nicks?",
        body: "Combina uma palavra de uma lista de adjetivos com uma palavra de uma lista de substantivos (em inglês, estilo gamer), com número opcional no final — tudo sorteado no seu navegador.",
      },
      {
        title: "O nick gerado está disponível na plataforma que eu quero usar?",
        body: "Não é garantido. Esta ferramenta não consulta nenhuma base real de usuários — verifique a disponibilidade diretamente na plataforma desejada.",
      },
    ],
    faq: [
      {
        question: "Os nicks gerados ficam armazenados?",
        answer:
          "Não. Toda a geração acontece no seu navegador; nenhum nick é enviado, salvo ou registrado em log pela Alilu.",
      },
      {
        question: "Posso escolher o separador entre as palavras?",
        answer: "Sim: nenhum, underline (_) ou ponto (.).",
      },
    ],
  },

  "gerador-letras-diferentes": {
    contentSections: [
      {
        title: "Como funciona o Gerador de Letras Diferentes?",
        body: "Digite um texto e veja, na hora, a versão dele em negrito, itálico, bolha, largura total, invertido, riscado e sublinhado — usando blocos especiais do Unicode. Nenhuma fonte nova é instalada: são caracteres Unicode que qualquer app ou site já exibe.",
      },
      {
        title: "Por que algumas letras não mudam?",
        body: "Alguns estilos (como itálico) não têm uma versão Unicode para números — nesse caso, os números aparecem no formato normal, misturados com as letras estilizadas.",
      },
      {
        title: "O texto digitado fica salvo?",
        body: "Não. Toda a conversão acontece no seu navegador; o texto que você digita nunca é enviado, salvo ou registrado em log pela Alilu.",
      },
    ],
    faq: [
      {
        question: "Funciona em qualquer rede social?",
        answer:
          "Na maioria. Como são caracteres Unicode (não uma fonte especial), funcionam em bios, posts e comentários de praticamente qualquer app — mas a aparência pode variar um pouco entre dispositivos.",
      },
      {
        question: "Posso copiar cada estilo separadamente?",
        answer: "Sim, cada variação tem seu próprio botão \"Copiar\".",
      },
    ],
  },

  "simbolos-para-copiar": {
    contentSections: [
      {
        title: "Como funciona o Símbolos para Copiar?",
        body: "É um catálogo com símbolos comuns (setas, moedas, matemática, pontuação, formas e outros), organizados por categoria e pesquisáveis por nome. Clique em um símbolo para copiá-lo.",
      },
      {
        title: "Os símbolos funcionam em qualquer lugar?",
        body: "Na maioria dos apps e sites, sim — são caracteres Unicode padrão, não imagens. A aparência exata pode variar um pouco conforme a fonte do dispositivo.",
      },
    ],
    faq: [
      {
        question: "Preciso estar online para usar depois de copiar?",
        answer: "Não. Depois de copiado, o símbolo é só texto — pode ser colado em qualquer lugar, offline inclusive.",
      },
      {
        question: "A busca funciona em português?",
        answer: "Sim, cada símbolo tem um nome em português para facilitar a busca (ex.: \"seta para a direita\", \"coração\").",
      },
    ],
  },

  "gerador-lorem-ipsum": {
    contentSections: [
      {
        title: "Como funciona o Gerador de Lorem Ipsum?",
        body: "Escolha a unidade (palavras, frases ou parágrafos) e a quantidade. O texto é montado no seu navegador a partir do banco de palavras do Lorem Ipsum clássico, com crypto.getRandomValues.",
      },
      {
        title: "O que é Lorem Ipsum?",
        body: "É um texto de preenchimento (placeholder) usado há décadas em design e tipografia para simular o espaço que um texto real ocuparia, sem distrair com conteúdo legível.",
      },
    ],
    faq: [
      {
        question: "O texto gerado tem algum significado?",
        answer: "Não. É derivado do latim clássico e usado apenas para preencher espaço visualmente — não é um texto legível em nenhum idioma.",
      },
      {
        question: "Posso gerar em parágrafos?",
        answer: "Sim, escolha \"Parágrafos\" na unidade e a quantidade desejada.",
      },
    ],
  },

  "gerador-curriculo": {
    contentSections: [
      {
        title: "Como funciona o Gerador de Currículo?",
        body: "Preencha seus dados, experiências profissionais, formação e habilidades. Clique em \"Gerar currículo\" para ver a prévia pronta, e use \"Imprimir / Salvar PDF\" para imprimir ou salvar o arquivo em PDF pelo seu navegador.",
      },
      {
        title: "Os meus dados ficam salvos?",
        body: "Não. Assim como no Gerador de Recibo e no Gerador de Orçamento, todo o processamento acontece no seu navegador — nenhum dado do currículo é enviado ou armazenado pela Alilu.",
      },
    ],
    faq: [
      {
        question: "Posso adicionar mais de uma experiência profissional?",
        answer: "Sim, use o botão \"Adicionar experiência\" quantas vezes precisar (até o limite da ferramenta).",
      },
      {
        question: "Posso baixar o currículo em PDF?",
        answer:
          "Sim. Use o botão \"Imprimir / Salvar PDF\" e escolha a opção de salvar em PDF na caixa de impressão do seu navegador.",
      },
      {
        question: "Os meus dados ficam armazenados?",
        answer: "Não. Todo o processamento acontece no seu navegador.",
      },
    ],
  },

  "gerador-certidao": {
    contentSections: [
      {
        title: "Como funciona o Gerador de Certidões?",
        body: "Escolha o tipo (nascimento, casamento ou óbito) e a quantidade. A ferramenta sorteia, no seu navegador, um número de 32 dígitos no comprimento total usado pela matrícula do registro civil brasileiro — nunca uma imagem ou documento.",
      },
      {
        title: "O número gerado é válido?",
        body: "Não é uma reprodução verificada da divisão oficial em blocos do CNJ (código do cartório, ano, tipo de livro etc.), nem inclui um dígito verificador oficial — é um número de 32 dígitos no comprimento certo, útil para testar campos de formulário que aceitam o valor como texto livre.",
      },
      {
        title: "Esta ferramenta gera um documento de certidão?",
        body: "Não, e nunca vai gerar. Só o número de matrícula em texto — nenhuma imagem, PDF ou layout que se pareça com uma certidão real é criado aqui.",
      },
    ],
    faq: [
      {
        question: "Os números gerados ficam armazenados?",
        answer:
          "Não. Toda a geração acontece no seu navegador; nenhum número é enviado, salvo ou registrado em log pela Alilu.",
      },
      {
        question: "Essa ferramenta consulta algum cartório?",
        answer: "Não. Nenhuma consulta é feita à Central Nacional de Informações do Registro Civil nem a qualquer cartório.",
      },
    ],
  },

  "gerador-imagem": {
    contentSections: [
      {
        title: "Como funciona o Gerador de Imagem?",
        body: "Escolha a largura, a altura, a cor de fundo, a cor do texto e (opcionalmente) o texto a exibir. A imagem é desenhada no seu navegador usando a Canvas API — não é geração de imagem por inteligência artificial.",
      },
      {
        title: "Para que serve uma imagem placeholder?",
        body: "Para preencher o espaço de uma imagem em protótipos, layouts e páginas em desenvolvimento, antes de a imagem final estar pronta.",
      },
    ],
    faq: [
      {
        question: "A imagem gerada fica salva em algum servidor?",
        answer: "Não. A imagem é criada e baixada inteiramente no seu navegador.",
      },
      {
        question: "Em que formato a imagem é baixada?",
        answer: "Em PNG, pronta para usar em qualquer protótipo ou documento.",
      },
    ],
  },

  "gerador-orcamento": {
    contentSections: [
      {
        title: "Como criar um orçamento?",
        body: "Preencha seus dados e os do cliente, adicione os itens (descrição, quantidade e valor unitário) e gere a prévia. Você pode imprimir ou salvar como PDF diretamente do navegador.",
      },
      {
        title: "Os dados do orçamento ficam salvos?",
        body: "Não. Assim como no Gerador de Recibo, todo o processamento acontece no seu navegador — nenhum dado do orçamento é enviado ou armazenado pela Alilu.",
      },
    ],
    faq: [
      {
        question: "Posso adicionar quantos itens eu quiser?",
        answer: "Sim, não há limite de itens — use o botão \"Adicionar item\" quantas vezes precisar.",
      },
      {
        question: "Os meus dados ficam armazenados?",
        answer: "Não. Todo o processamento acontece no seu navegador.",
      },
    ],
  },

  // VALIDADORES
  "validador-cpf": {
    contentSections: [
      {
        title: "O que é o CPF?",
        body: "O Cadastro de Pessoas Físicas (CPF) é o documento de identificação fiscal usado pela Receita Federal para identificar contribuintes. Ele tem 11 dígitos: 9 dígitos-base e 2 dígitos verificadores, calculados por um algoritmo público de módulo 11.",
      },
      {
        title: "Como funciona a validação?",
        body: "Esta ferramenta recalcula os dois dígitos verificadores a partir dos 9 primeiros dígitos digitados (aceitando com ou sem pontuação) e compara com os dígitos informados — o mesmo cálculo usado para gerar um CPF sintético no Gerador de CPF. Sequências com todos os dígitos iguais (como 111.111.111-11) são sempre rejeitadas.",
      },
      {
        title: "O que significa um CPF válido aqui?",
        body: "CPF válido = dígitos verificadores matematicamente corretos. Isso não significa que o CPF existe, está ativo ou pertence a uma pessoa específica — esta ferramenta não consulta a Receita Federal nem qualquer base de dados de pessoas.",
      },
    ],
    faq: [
      {
        question: "Esta ferramenta consulta a Receita Federal?",
        answer:
          "Não. A validação verifica apenas o formato e os dígitos verificadores — não há consulta a nenhuma base de dados oficial nem confirmação de que o CPF pertence a alguém.",
      },
      {
        question: "O CPF que eu digitei fica armazenado?",
        answer:
          "Não. Toda a validação acontece no seu navegador; o valor digitado não é enviado, salvo ou registrado em log pela Alilu.",
      },
      {
        question: "Posso digitar o CPF com ou sem pontuação?",
        answer: "Sim. A máscara 000.000.000-00 é aplicada automaticamente enquanto você digita.",
      },
      {
        question: "Essa ferramenta serve para gerar um CPF novo?",
        answer:
          "Não, ela valida um CPF que você já tem. Para gerar CPFs sintéticos para teste, use o Gerador de CPF.",
      },
    ],
  },

  "validador-cnpj": {
    contentSections: [
      {
        title: "O que é o CNPJ?",
        body: "O Cadastro Nacional da Pessoa Jurídica (CNPJ) identifica empresas perante a Receita Federal. Tem 14 dígitos: 12 dígitos-base e 2 dígitos verificadores, calculados por um algoritmo público de módulo 11.",
      },
      {
        title: "Como funciona a validação?",
        body: "Esta ferramenta recalcula os dois dígitos verificadores a partir dos 12 primeiros dígitos digitados (aceitando com ou sem pontuação, como 12.345.678/0001-95) e compara com os dígitos informados — o mesmo cálculo usado pelo Gerador de CNPJ.",
      },
      {
        title: "O que significa um CNPJ válido aqui?",
        body: "CNPJ válido = dígitos verificadores matematicamente corretos. Isso não significa que a empresa existe, está ativa ou que o CNPJ está registrado na Receita Federal — esta ferramenta não consulta nenhuma base de dados oficial.",
      },
    ],
    faq: [
      {
        question: "Esta ferramenta consulta a situação cadastral da empresa?",
        answer:
          "Não. A validação verifica apenas o formato e os dígitos verificadores — não há consulta à Receita Federal nem confirmação de que a empresa existe ou está ativa.",
      },
      {
        question: "O CNPJ que eu digitei fica armazenado?",
        answer:
          "Não. Toda a validação acontece no seu navegador; o valor digitado não é enviado, salvo ou registrado em log pela Alilu.",
      },
      {
        question: "Posso digitar o CNPJ com ou sem pontuação?",
        answer: "Sim. A máscara 00.000.000/0000-00 é aplicada automaticamente enquanto você digita.",
      },
    ],
  },

  "validador-cartao-credito": {
    contentSections: [
      {
        title: "Como funciona a validação de cartão?",
        body: "Esta ferramenta aplica o algoritmo de Luhn — um cálculo público usado pela indústria de pagamentos para conferir a consistência matemática de um número de cartão — inteiramente no seu navegador. Opcionalmente, identifica a bandeira provável (Visa, Mastercard, American Express, Elo ou Hipercard) pelo padrão numérico do início do número.",
      },
      {
        title: "O que significa um número 'válido' aqui?",
        body: "Válido pelo algoritmo de Luhn significa apenas que a sequência de dígitos é matematicamente consistente — não que o cartão existe, está ativo, tem limite disponível ou foi de fato emitido por um banco. A identificação da bandeira é baseada apenas no padrão numérico e não confirma que o cartão exista.",
      },
      {
        title: "Segurança e privacidade",
        body: "Esta ferramenta pede apenas o número do cartão — nunca validade, CVV, nome do titular ou data de nascimento. Nada digitado é armazenado, transmitido para uma API, salvo em banco de dados ou registrado em log: a validação é 100% local.",
      },
    ],
    faq: [
      {
        question: "Esta ferramenta consulta o banco emissor ou um gateway de pagamento?",
        answer:
          "Não. A validação é local e verifica apenas a consistência matemática do número (Luhn) — não há consulta a bancos, bandeiras ou processadoras de pagamento.",
      },
      {
        question: "Por que a ferramenta não pede validade ou CVV?",
        answer:
          "Porque isso não é necessário para validar o formato do número, e pedir esses dados criaria um risco de segurança desnecessário. Esta ferramenta nunca solicita dados sensíveis de pagamento.",
      },
      {
        question: "O número do cartão fica salvo em algum lugar?",
        answer:
          "Não. Nada digitado é armazenado, enviado para servidor, registrado em log/console ou salvo no navegador (localStorage/sessionStorage).",
      },
    ],
  },

  "validador-conta-bancaria": {
    contentSections: [
      {
        title: "Como funciona a validação de conta bancária?",
        body: "Cada banco brasileiro usa um algoritmo próprio, não público, para calcular o dígito verificador da conta — não existe uma fórmula única confiável para todos os bancos. Por isso, esta ferramenta confere apenas se banco, agência, conta e dígito foram preenchidos em um formato compatível (campos obrigatórios e caracteres permitidos).",
      },
      {
        title: "O que essa validação não faz",
        body: "A validação completa do dígito da conta pode variar conforme a instituição financeira. Esta ferramenta não confirma que a conta existe, está ativa ou pertence a alguém — e não consulta nenhum banco ou sistema bancário.",
      },
    ],
    faq: [
      {
        question: "Por que não há verificação do dígito da conta?",
        answer:
          "Porque cada banco calcula esse dígito com uma regra própria e não publicada — implementar um cálculo sem confirmação oficial poderia dar um resultado incorreto. Por isso a ferramenta valida apenas o formato dos campos.",
      },
      {
        question: "Meus dados bancários ficam armazenados?",
        answer:
          "Não. Toda a validação acontece no seu navegador; nenhum dado é enviado, salvo ou registrado em log pela Alilu.",
      },
    ],
  },

  "validador-certidoes": {
    contentSections: [
      {
        title: "O que é a matrícula de uma certidão?",
        body: "Desde 2010, as certidões de nascimento, casamento e óbito emitidas no Brasil usam um número de matrícula de 32 dígitos, controlado pelo CNJ (Conselho Nacional de Justiça).",
      },
      {
        title: "O que esta ferramenta verifica",
        body: "Este projeto não tem acesso à especificação oficial exata da divisão em blocos (código do cartório, ano, tipo de livro/acervo, número do livro, folha e termo) nem ao cálculo do dígito verificador oficial. Por isso, a validação verifica apenas se o número tem exatamente 32 dígitos — nunca o dígito verificador ou a estrutura interna dos blocos.",
      },
      {
        title: "Esta ferramenta consulta algum cadastro oficial?",
        body: "Não. Ela nunca consulta a Central Nacional de Informações do Registro Civil (CRC Nacional) nem qualquer cartório. Um número com 32 dígitos matematicamente 'no formato certo' não significa necessariamente que a certidão esteja registrada ou seja autêntica.",
      },
    ],
    faq: [
      {
        question: "Esta ferramenta confirma que a certidão é autêntica?",
        answer:
          "Não. Ela verifica apenas se o número tem o comprimento de 32 dígitos usado pelo registro civil brasileiro — não confere o dígito verificador nem consulta nenhum cartório ou o CRC Nacional.",
      },
      {
        question: "Por que não há verificação completa da matrícula?",
        answer:
          "Porque a divisão oficial em blocos e o cálculo do dígito verificador do CNJ não são reproduzidos aqui sem uma fonte oficial confirmada — evitamos apresentar um algoritmo que poderia estar incorreto.",
      },
    ],
  },

  "validador-cnh": {
    contentSections: [
      {
        title: "O que é a CNH?",
        body: "A Carteira Nacional de Habilitação (CNH) tem um número de 11 dígitos: 9 dígitos-base e 2 dígitos verificadores, calculados por um algoritmo do DENATRAN reproduzido publicamente por validadores de terceiros.",
      },
      {
        title: "Como funciona a validação?",
        body: "Esta ferramenta recalcula os dois dígitos verificadores a partir dos 9 primeiros dígitos e compara com os dígitos informados — o mesmo cálculo usado pelo Gerador de CNH.",
      },
      {
        title: "O que essa validação não faz",
        body: "Esta ferramenta verifica apenas a estrutura do número informado e não consulta a situação da CNH junto ao DETRAN — ou seja, não indica se a habilitação está ativa, suspensa ou cassada.",
      },
    ],
    faq: [
      {
        question: "Esta ferramenta consulta o DETRAN?",
        answer:
          "Não. A validação verifica apenas os dígitos verificadores do número — não há consulta ao DETRAN nem ao RENACH (cadastro de condutores).",
      },
      {
        question: "O número da CNH fica armazenado?",
        answer: "Não. Toda a validação acontece no seu navegador; nada é enviado, salvo ou registrado em log.",
      },
    ],
  },

  "validador-pis-pasep": {
    contentSections: [
      {
        title: "O que é o PIS/PASEP?",
        body: "O PIS/PASEP (também chamado de NIT) tem 11 dígitos: 10 dígitos-base e 1 dígito verificador, calculado pelo mesmo algoritmo de módulo 11 usado pelo eSocial/CAGED.",
      },
      {
        title: "Como funciona a validação?",
        body: "Esta ferramenta recalcula o dígito verificador a partir dos 10 primeiros dígitos digitados (com ou sem pontuação) e compara com o dígito informado — o mesmo cálculo usado pelo Gerador de PIS/PASEP.",
      },
      {
        title: "O que significa um número válido aqui?",
        body: "Válido = dígito verificador matematicamente correto. Isso não confirma que o número existe ou pertence a um trabalhador real — esta ferramenta não consulta a Caixa Econômica Federal nem o eSocial.",
      },
    ],
    faq: [
      {
        question: "Esta ferramenta consulta a Caixa ou o eSocial?",
        answer: "Não. A validação é local e verifica apenas o dígito verificador — não há consulta a nenhuma base de dados de trabalhadores.",
      },
      {
        question: "O número digitado fica armazenado?",
        answer: "Não. Toda a validação acontece no seu navegador; nada é enviado, salvo ou registrado em log.",
      },
    ],
  },

  "validador-renavam": {
    contentSections: [
      {
        title: "O que é o RENAVAM?",
        body: "O Registro Nacional de Veículos Automotores (RENAVAM) tem 11 dígitos: 10 dígitos-base e 1 dígito verificador, calculado por um algoritmo documentado publicamente e usado por validadores de terceiros.",
      },
      {
        title: "Como funciona a validação?",
        body: "Esta ferramenta recalcula o dígito verificador a partir dos 10 primeiros dígitos e compara com o dígito informado — o mesmo cálculo usado pelo Gerador de RENAVAM.",
      },
      {
        title: "O que essa validação não faz",
        body: "Um RENAVAM matematicamente válido não significa que o veículo existe, está licenciado ou regularizado — esta ferramenta não consulta o DETRAN nem a Base Índice Nacional de Veículos (BIN).",
      },
    ],
    faq: [
      {
        question: "Esta ferramenta consulta o DETRAN ou a BIN?",
        answer: "Não. A validação verifica apenas o dígito verificador do número — não há consulta a nenhum cadastro de veículos.",
      },
      {
        question: "O RENAVAM digitado fica armazenado?",
        answer: "Não. Toda a validação acontece no seu navegador; nada é enviado, salvo ou registrado em log.",
      },
    ],
  },

  "validador-rg": {
    contentSections: [
      {
        title: "O que é o RG?",
        body: "O Registro Geral (RG) é o documento de identidade emitido por cada Secretaria de Segurança Pública (SSP) estadual. Diferente de CPF ou CNPJ, não existe um cadastro ou algoritmo federal único — cada estado define seu próprio formato.",
      },
      {
        title: "Como funciona a validação?",
        body: "Para São Paulo, esta ferramenta aplica o padrão de cálculo do dígito verificador (8 dígitos-base + 1 dígito verificador por módulo 11) mais comumente usado por validadores públicos de terceiros — o mesmo já usado pelo Gerador de RG deste site. Para as demais UFs, como não existe um algoritmo público e unificado, é conferido apenas o formato geral do número.",
      },
      {
        title: "O que essa validação não faz",
        body: "Um RG com formato ou dígito verificador válido não significa que o documento existe ou foi emitido — esta ferramenta nunca consulta nenhuma Secretaria de Segurança Pública ou cadastro de pessoas.",
      },
    ],
    faq: [
      {
        question: "Por que só São Paulo tem verificação de dígito?",
        answer:
          "Porque o RG não tem um algoritmo nacional único — cada SSP estadual define o seu. São Paulo é a UF cujo padrão de cálculo é mais amplamente reproduzido por validadores públicos; para as demais, validamos apenas o formato, para não inventar um algoritmo incorreto.",
      },
      {
        question: "O número do RG fica armazenado?",
        answer: "Não. Toda a validação acontece no seu navegador; nada é enviado, salvo ou registrado em log.",
      },
    ],
  },

  "validador-titulo-eleitor": {
    contentSections: [
      {
        title: "O que é o Título de Eleitor?",
        body: "O Título de Eleitor tem 12 dígitos: 8 dígitos de sequencial, 2 dígitos do código da UF de emissão e 2 dígitos verificadores, calculados por um algoritmo documentado publicamente.",
      },
      {
        title: "Como funciona a validação?",
        body: "Esta ferramenta recalcula os dois dígitos verificadores a partir do sequencial e do código de UF já contidos nos 12 dígitos digitados — o mesmo cálculo usado pelo Gerador de Título de Eleitor. Não é preciso selecionar o estado à parte: o código já faz parte do número.",
      },
      {
        title: "O que essa validação não faz",
        body: "Um título matematicamente válido não significa que ele existe ou está ativo — esta ferramenta nunca consulta o TSE nem o cadastro de eleitores.",
      },
    ],
    faq: [
      {
        question: "Esta ferramenta consulta o TSE?",
        answer: "Não. A validação verifica apenas os dígitos verificadores do número — não há consulta ao TSE nem ao cadastro de eleitores.",
      },
      {
        question: "O número digitado fica armazenado?",
        answer: "Não. Toda a validação acontece no seu navegador; nada é enviado, salvo ou registrado em log.",
      },
    ],
  },

  "validador-inscricao-estadual": {
    contentSections: [
      {
        title: "O que é a Inscrição Estadual?",
        body: "A Inscrição Estadual (IE) identifica um contribuinte perante a Secretaria da Fazenda de um estado. Cada uma das 27 unidades federativas define seu próprio formato e algoritmo de dígito verificador, de forma independente — não existe uma Receita Estadual única, como há para CPF/CNPJ na Receita Federal.",
      },
      {
        title: "Como funciona a validação?",
        body: "Esta ferramenta confere apenas se a quantidade de dígitos informada é compatível com a UF selecionada — implementar corretamente o algoritmo de dígito verificador de cada uma das 27 UFs está fora do escopo desta primeira versão, e um algoritmo incorreto seria pior do que nenhum algoritmo.",
      },
      {
        title: "O que essa validação não faz",
        body: "Um formato compatível não significa que a inscrição existe, está ativa ou pertence a uma empresa — esta ferramenta nunca consulta nenhuma Secretaria da Fazenda estadual.",
      },
    ],
    faq: [
      {
        question: "Por que o dígito verificador não é conferido?",
        answer:
          "Porque cada estado tem seu próprio algoritmo, não há uma fórmula única para todos — implementar isso incorretamente seria pior do que não implementar. Por enquanto, a ferramenta confere apenas o formato geral por UF.",
      },
      {
        question: "A Inscrição Estadual digitada fica armazenada?",
        answer: "Não. Toda a validação acontece no seu navegador; nada é enviado, salvo ou registrado em log.",
      },
    ],
  },

  "numero-do-banco": {
    contentSections: [
      {
        title: "Para que serve o código do banco?",
        body: "O código de instituição (COMPE) identifica o banco em boletos, TEDs, DOCs e cadastros de conta. É um número curto (geralmente de 3 dígitos) diferente da agência e da conta — por exemplo, 341 é o Itaú e 260 é o Nubank.",
      },
      {
        title: "Como usar a consulta?",
        body: "Digite o nome do banco (ou parte dele) ou o próprio número na busca. A lista é filtrada instantaneamente, no seu navegador. Clique em \"Copiar\" ao lado do código para copiá-lo para a área de transferência.",
      },
      {
        title: "O que esta ferramenta não faz",
        body: "Esta é uma consulta de códigos de instituição — não é uma consulta de conta bancária, saldo ou dados de titular de ninguém. A lista reúne os bancos, fintechs e cooperativas mais conhecidos; para o cadastro completo e sempre atualizado, a fonte oficial é o Banco Central do Brasil (bcb.gov.br).",
      },
    ],
    faq: [
      {
        question: "Essa lista tem todos os bancos do Brasil?",
        answer:
          "Não. Reunimos os bancos, fintechs e cooperativas mais conhecidos para consulta rápida. Para o cadastro completo e oficial de instituições, consulte o Banco Central do Brasil.",
      },
      {
        question: "O código do banco é a mesma coisa que agência ou conta?",
        answer:
          "Não. O código do banco identifica a instituição financeira; agência e conta identificam o ponto de atendimento e a conta específica dentro daquele banco.",
      },
      {
        question: "Esta ferramenta consulta dados da minha conta?",
        answer: "Não. É apenas uma lista de códigos de instituição para consulta — nenhum dado de conta é consultado ou solicitado.",
      },
    ],
  },

  "corretor-ortografico": {
    contentSections: [
      {
        title: "Como funciona o corretor ortográfico?",
        body: "Esta ferramenta usa o corretor ortográfico nativo do seu próprio navegador (o mesmo que sublinha palavras em qualquer campo de texto do Chrome, Firefox, Edge ou Safari). Nenhum texto é enviado a um serviço externo de correção — a análise acontece inteiramente no seu dispositivo.",
      },
      {
        title: "Como corrigir uma palavra sublinhada?",
        body: "Clique com o botão direito (ou toque e segure, no celular) sobre a palavra sublinhada para ver as sugestões de correção do seu navegador. Esse menu de sugestões pertence ao navegador, não a esta página.",
      },
      {
        title: "Por que não usamos um corretor por IA?",
        body: "Não implementamos um mecanismo próprio de correção ortográfica nem uma IA de verdade rodando por trás desta ferramenta, para não simular uma funcionalidade que na prática não existiria. O recurso nativo do navegador é gratuito, não depende de rede e preserva totalmente a sua privacidade.",
      },
    ],
    faq: [
      {
        question: "O texto que eu digito é enviado para algum servidor?",
        answer: "Não. A correção é feita pelo dicionário do seu próprio navegador/sistema operacional — o texto nunca sai do seu dispositivo.",
      },
      {
        question: "Por que nenhuma palavra aparece sublinhada?",
        answer:
          "Verifique se a correção ortográfica está habilitada nas configurações do seu navegador e se há um dicionário em português instalado. Alguns navegadores desabilitam a correção por padrão em certos campos.",
      },
      {
        question: "Essa ferramenta corrige gramática, não só ortografia?",
        answer: "Não. O corretor nativo do navegador verifica principalmente a grafia das palavras — regras de gramática e concordância não são verificadas.",
      },
    ],
  },

  "ordem-alfabetica": {
    contentSections: [
      {
        title: "Como ordenar uma lista em ordem alfabética?",
        body: "Cole cada item em uma linha diferente e o resultado ordenado aparece automaticamente ao lado. Escolha A → Z ou Z → A, e ative as opções de ignorar maiúsculas/minúsculas, remover linhas duplicadas ou ignorar linhas vazias, conforme sua necessidade.",
      },
      {
        title: "Como a acentuação é tratada?",
        body: "A ordenação usa o padrão de comparação de texto do português (Intl.Collator), que posiciona corretamente palavras acentuadas — por exemplo, \"é\" fica ordenado perto de \"e\", e não jogado para o fim da lista, como aconteceria em uma ordenação alfabética ingênua.",
      },
    ],
    faq: [
      {
        question: "Consigo remover itens repetidos ao ordenar?",
        answer: "Sim. Ative a opção \"Remover duplicados\" — a comparação respeita a opção de ignorar maiúsculas/minúsculas que você escolheu.",
      },
      {
        question: "Linhas em branco atrapalham a ordenação?",
        answer: "Por padrão, linhas vazias são ignoradas. Você pode desativar essa opção se quiser mantê-las no resultado.",
      },
      {
        question: "Meus dados ficam armazenados?",
        answer: "Não. A ordenação acontece inteiramente no seu navegador; nada é enviado ou salvo em nenhum servidor.",
      },
    ],
  },

  "contador-caracteres": {
    contentSections: [
      {
        title: "Para que serve o contador de caracteres?",
        body: "Ajuda a conferir se um texto respeita um limite de caracteres — por exemplo, de uma rede social, um formulário ou um campo de banco de dados — mostrando a contagem em tempo real enquanto você digita ou cola o texto.",
      },
      {
        title: "O que é contado?",
        body: "A ferramenta mostra caracteres com e sem espaços, quantidade de palavras, linhas, parágrafos e dígitos numéricos. Emojis e caracteres acentuados são contados corretamente, um por um.",
      },
    ],
    faq: [
      {
        question: "A contagem é atualizada automaticamente?",
        answer: "Sim, em tempo real, a cada tecla digitada ou texto colado — não é preciso clicar em nenhum botão.",
      },
      {
        question: "Emojis contam como um caractere só?",
        answer: "Sim. A contagem usa iteração por ponto de código Unicode, então um emoji conta como um caractere, mesmo quando ele ocupa mais de uma posição internamente.",
      },
      {
        question: "Existe um limite de tamanho de texto?",
        answer: "Sim, um limite de segurança bem generoso (200.000 caracteres), só para evitar travamentos com textos gigantes colados por engano.",
      },
    ],
  },

  "contador-ocorrencia-palavra": {
    contentSections: [
      {
        title: "Como contar quantas vezes uma palavra aparece em um texto?",
        body: "Cole o texto, digite a palavra ou expressão que deseja buscar, e o total de ocorrências aparece automaticamente, junto com a linha e a coluna de cada uma delas.",
      },
      {
        title: "Opções de busca",
        body: "Ative \"Diferenciar maiúsculas/minúsculas\" para uma busca sensível a caixa (ex.: \"Sol\" diferente de \"sol\"). Ative \"Apenas palavra inteira\" para não contar a palavra quando ela aparece dentro de outra (ex.: buscar \"sol\" sem contar \"solto\").",
      },
    ],
    faq: [
      {
        question: "Posso buscar uma expressão com mais de uma palavra?",
        answer: "Sim. A busca aceita qualquer trecho de texto, não apenas uma palavra isolada.",
      },
      {
        question: "O que significa a posição \"linha, coluna\"?",
        answer: "A linha é a posição do texto (contando a partir da primeira linha como 1) e a coluna é a posição do primeiro caractere da ocorrência dentro dessa linha.",
      },
      {
        question: "O texto que eu colo fica salvo em algum lugar?",
        answer: "Não. Toda a busca acontece localmente, no seu navegador.",
      },
    ],
  },

  "texto-para-html": {
    contentSections: [
      {
        title: "Como converter um texto para HTML?",
        body: "Cole o texto original, escolha se cada linha deve virar uma quebra (<br>) ou se cada parágrafo (separado por linha em branco) deve virar um bloco <p>, e o HTML correspondente aparece pronto para copiar.",
      },
      {
        title: "Por que os caracteres especiais são escapados?",
        body: "Antes de qualquer conversão, os cinco caracteres especiais do HTML (&, <, >, \", ') são escapados para suas entidades correspondentes (como &amp;, &lt;, &gt;). Isso evita que um texto com esses símbolos gere HTML quebrado ou, em um cenário de uso indevido, código executável — é a mesma proteção usada contra ataques de XSS.",
      },
      {
        title: "O HTML gerado é executado nesta página?",
        body: "Não. O resultado é mostrado sempre como texto simples, dentro de uma caixa de texto somente leitura, para você copiar e colar onde precisar — esta página nunca interpreta ou executa o HTML que ela mesma gera.",
      },
    ],
    faq: [
      {
        question: "Essa ferramenta é segura contra XSS?",
        answer:
          "Sim. Todo o texto é escapado antes de virar HTML, e o resultado nunca é renderizado como HTML de verdade nesta página — só exibido como texto para você copiar.",
      },
      {
        question: "O que é a opção \"Preservar espaços extras\"?",
        answer:
          "Ela converte sequências de espaços repetidos em &nbsp;, para que o espaçamento visual do texto original não se perca quando o HTML for exibido em uma página (navegadores colapsam espaços repetidos por padrão).",
      },
    ],
  },

  "cortar-textos": {
    contentSections: [
      {
        title: "Como cortar um texto em um limite específico?",
        body: "Cole o texto, escolha se o limite é em caracteres, palavras ou linhas, defina o número desejado e o resultado cortado aparece automaticamente.",
      },
      {
        title: "Opções de corte",
        body: "\"Adicionar '…' ao final\" acrescenta reticências quando o texto é efetivamente cortado. \"Evitar cortar palavra ao meio\" (disponível no corte por caracteres) recua o corte até o último espaço, para não interromper uma palavra na metade.",
      },
    ],
    faq: [
      {
        question: "Se o texto já for menor que o limite, o que acontece?",
        answer: "Nada é cortado — o texto original é mostrado como resultado, sem reticências.",
      },
      {
        question: "Existe um limite máximo para o valor do corte?",
        answer: "Sim, um limite de segurança de 100.000, para evitar valores absurdos que travariam o navegador sem necessidade.",
      },
    ],
  },

  "dividir-string": {
    contentSections: [
      {
        title: "Como dividir um texto em uma lista de itens?",
        body: "Cole o texto e escolha o delimitador: vírgula, ponto e vírgula, espaço, quebra de linha ou um delimitador personalizado (qualquer texto que você definir). Cada trecho separado pelo delimitador vira um item da lista.",
      },
      {
        title: "Opções de limpeza",
        body: "\"Remover espaços das pontas de cada item\" tira espaços em branco no início/fim de cada pedaço. \"Remover itens vazios\" descarta pedaços em branco resultantes de delimitadores repetidos (ex.: duas vírgulas seguidas).",
      },
    ],
    faq: [
      {
        question: "Posso usar mais de um caractere como delimitador?",
        answer: "Sim, no modo \"Delimitador personalizado\" você pode digitar qualquer texto, com um ou mais caracteres.",
      },
      {
        question: "Consigo copiar todos os itens de uma vez?",
        answer: "Sim. O botão \"Copiar lista\" copia todos os itens, um por linha, para a área de transferência.",
      },
    ],
  },

  "informacoes-caractere": {
    contentSections: [
      {
        title: "O que esta ferramenta mostra sobre um caractere?",
        body: "Ao digitar um caractere, você vê seu code point Unicode (em decimal e hexadecimal), a HTML Entity correspondente (em decimal e hexadecimal, quando aplicável) e a sequência de bytes em UTF-8 — tudo calculado a partir de funções padrão do próprio JavaScript.",
      },
      {
        title: "Para que serve saber isso?",
        body: "É útil para desenvolvedores depurando problemas de codificação de texto, para escrever uma entidade HTML específica, ou simplesmente para entender como um caractere (inclusive emojis) é representado internamente.",
      },
    ],
    faq: [
      {
        question: "Funciona com emojis?",
        answer: "Sim. Emojis e outros caracteres fora do conjunto básico do Unicode são tratados corretamente, um caractere completo por vez.",
      },
      {
        question: "Se eu digitar várias letras, o que acontece?",
        answer: "Apenas o primeiro caractere digitado é analisado — a ferramenta é pensada para um único caractere por vez.",
      },
    ],
  },

  "inverter-texto": {
    contentSections: [
      {
        title: "Como inverter um texto?",
        body: "Cole o texto e escolha o modo de inversão: por caracteres (o texto inteiro de trás para frente), pela ordem das palavras (mantendo cada palavra intacta) ou pela ordem das linhas (últimas linhas primeiro).",
      },
      {
        title: "Funciona com acentos e emojis?",
        body: "Sim. A inversão de caracteres usa iteração por ponto de código Unicode, então acentos, emojis e outros caracteres compostos são preservados corretamente, sem ficarem quebrados ou corrompidos.",
      },
    ],
    faq: [
      {
        question: "Qual a diferença entre inverter por caracteres e por palavras?",
        answer:
          "Por caracteres, o texto inteiro é lido de trás para frente (ex.: \"Olá\" vira \"álO\"). Por palavras, a ordem das palavras é invertida, mas cada palavra continua escrita normalmente (ex.: \"bom dia\" vira \"dia bom\").",
      },
      {
        question: "E a inversão por linhas?",
        answer: "A última linha do texto passa a ser a primeira, e assim por diante — o conteúdo de cada linha não é alterado.",
      },
    ],
  },

  "maiusculas-minusculas": {
    contentSections: [
      {
        title: "Quais conversões esta ferramenta faz?",
        body: "Ao digitar um texto, você vê ao mesmo tempo as variações TUDO MAIÚSCULO, tudo minúsculo, Primeira letra maiúscula (só a primeira letra do texto todo), Primeira letra de cada frase (após ponto final, exclamação ou interrogação) e Title Case (Cada Palavra Iniciando Com Maiúscula).",
      },
      {
        title: "A acentuação é preservada?",
        body: "Sim. As conversões usam os métodos nativos do JavaScript para maiúsculas/minúsculas, que tratam corretamente letras acentuadas do português (á, é, ç, õ, e assim por diante).",
      },
    ],
    faq: [
      {
        question: "Preciso escolher qual conversão usar antes de digitar?",
        answer: "Não. Todas as variações são calculadas e exibidas ao mesmo tempo, assim que você digita algo — cada uma com seu próprio botão de copiar.",
      },
      {
        question: "O que é Title Case?",
        answer: "É o estilo em que a primeira letra de cada palavra fica maiúscula — comum em títulos de artigos e capas de livros em inglês, e também usado em português para nomes próprios e títulos.",
      },
    ],
  },

  "numero-por-extenso": {
    contentSections: [
      {
        title: "Como converter um número para texto por extenso?",
        body: "Escolha o modo \"Número\" para converter um valor inteiro (ex.: 123 → \"cento e vinte e três\") ou o modo \"Valor em reais\" para converter um valor monetário (ex.: 123,45 → \"cento e vinte e três reais e quarenta e cinco centavos\"), com reais e centavos tratados separadamente.",
      },
      {
        title: "Existe um limite de valor?",
        body: "Sim. Para garantir um resultado sempre correto (sem erros de arredondamento de ponto flutuante ou nomes de escala não definidos), o conversor aceita valores até 999.999.999.999.999 — um limite bem acima de qualquer uso prático.",
      },
    ],
    faq: [
      {
        question: "Esta ferramenta é a mesma usada no Gerador de Recibo?",
        answer: "Sim. O modo \"Valor em reais\" reaproveita exatamente o mesmo conversor por extenso já usado pelo Gerador de Recibo deste site.",
      },
      {
        question: "No modo \"Número\", valores com casas decimais funcionam?",
        answer: "A parte decimal é ignorada nesse modo — para converter centavos junto com reais, use o modo \"Valor em reais\".",
      },
    ],
  },

  "remover-acentos": {
    contentSections: [
      {
        title: "Como remover acentos de um texto?",
        body: "Cole o texto e o resultado sem acentuação aparece automaticamente — por exemplo, \"São José\" se torna \"Sao Jose\". A caixa original das letras (maiúscula/minúscula) é preservada.",
      },
      {
        title: "Como funciona tecnicamente?",
        body: "A remoção usa normalização Unicode (forma NFD), que separa cada letra acentuada em sua letra-base mais a marca de acento, e então remove apenas as marcas — sem afetar o restante do texto.",
      },
    ],
    faq: [
      {
        question: "Isso funciona para todos os acentos do português?",
        answer: "Sim, incluindo til (ã, õ), cedilha (ç), acento agudo, grave e circunflexo.",
      },
      {
        question: "Pontuação e números são afetados?",
        answer: "Não. Apenas as marcas diacríticas das letras são removidas — o resto do texto permanece exatamente como foi digitado.",
      },
    ],
  },

  "remover-quebras-linha": {
    contentSections: [
      {
        title: "Como remover ou trocar quebras de linha?",
        body: "Cole o texto e escolha o que colocar no lugar de cada quebra de linha: nada (remoção simples), um espaço, uma vírgula, ou um texto personalizado. A ferramenta reconhece os três formatos de quebra de linha existentes (\\n, \\r\\n e \\r).",
      },
      {
        title: "Por que existe a opção \"Evitar espaços duplos\"?",
        body: "Quando várias quebras de linha seguidas são substituídas por espaço ou vírgula, é comum sobrar espaço duplicado no resultado. Essa opção reduz espaços repetidos a um só, deixando o texto final mais limpo.",
      },
    ],
    faq: [
      {
        question: "Funciona com texto colado do Windows, Mac ou Linux?",
        answer: "Sim. Os três estilos de quebra de linha usados por esses sistemas (\\r\\n, \\n e \\r) são reconhecidos e tratados da mesma forma.",
      },
      {
        question: "Posso usar um texto personalizado no lugar da quebra de linha?",
        answer: "Sim, escolha \"Texto personalizado\" e digite o que quiser colocar no lugar de cada quebra (por exemplo, \" | \").",
      },
    ],
  },

  "meu-ip": {
    contentSections: [
      {
        title: "O que é o meu IP?",
        body: "É o endereço que identifica sua conexão na internet no momento desta consulta. Esta ferramenta detecta o IP a partir dos headers da própria requisição que seu navegador já envia ao acessar esta página — sem usar nenhum serviço externo de geolocalização ou de análise de tráfego.",
      },
      {
        title: "IPv4 ou IPv6?",
        body: "Quando possível, a ferramenta indica se o endereço detectado é IPv4 (o formato mais tradicional, como 200.10.20.30) ou IPv6 (um formato mais novo e mais longo). A versão exibida depende de como a sua conexão chega até o servidor.",
      },
    ],
    faq: [
      {
        question: "Meu IP fica armazenado por esta ferramenta?",
        answer: "Não. O endereço é calculado a cada consulta e exibido só para você, nesta página — nada é salvo em banco de dados, log ou serviço de analytics.",
      },
      {
        question: "Por que às vezes o IP aparece como não identificado?",
        answer: "Isso acontece quando a conexão não passa por um proxy/CDN que define o header de IP do cliente (é o caso, por exemplo, de alguns ambientes de desenvolvimento local) — em produção, a infraestrutura padrão da hospedagem normalmente informa esse header.",
      },
    ],
  },

  "meu-navegador": {
    contentSections: [
      {
        title: "Como esta ferramenta identifica meu navegador?",
        body: "A identificação usa o header User-Agent que o seu próprio navegador já envia a cada página que você visita, junto com o helper nativo de interpretação de User-Agent do Next.js — sem nenhuma técnica de fingerprinting invasivo (como leitura de canvas, fontes instaladas ou plugins).",
      },
      {
        title: "A versão exibida é sempre exata?",
        body: "Não necessariamente. Navegadores modernos (como o Chrome, por política de privacidade chamada User-Agent Reduction) podem reduzir ou \"congelar\" as informações de versão enviadas no User-Agent, então o número exibido pode ser aproximado.",
      },
    ],
    faq: [
      {
        question: "Essa ferramenta rastreia meu comportamento de navegação?",
        answer: "Não. Ela apenas interpreta o User-Agent da requisição atual, exibe o resultado para você e não armazena nem envia esses dados a nenhum serviço de terceiros.",
      },
      {
        question: "Por que meus cookies aparecem como desabilitados mesmo estando ativados?",
        answer: "Essa informação é lida diretamente do seu navegador (navigator.cookieEnabled) no momento em que a página carrega — configurações específicas de privacidade do navegador podem influenciar esse valor.",
      },
    ],
  },

  "meu-sistema-operacional": {
    contentSections: [
      {
        title: "Como esta ferramenta identifica meu sistema operacional?",
        body: "A identificação vem do mesmo header User-Agent enviado pelo seu navegador, interpretado pelo helper nativo do Next.js — reconhecendo famílias como Windows, macOS, Linux, Android e iOS. Nenhuma coleta adicional de hardware é feita.",
      },
      {
        title: "Por que a versão às vezes não aparece?",
        body: "Vários navegadores atuais, por padrão de privacidade, omitem ou simplificam a versão exata do sistema operacional no User-Agent. Quando isso acontece, a ferramenta mostra \"Não identificada\" em vez de arriscar um palpite incorreto.",
      },
    ],
    faq: [
      {
        question: "Essa ferramenta coleta informações do meu hardware?",
        answer: "Não. Apenas o que o próprio navegador já declara no header User-Agent é utilizado — nenhuma técnica adicional de fingerprinting é aplicada.",
      },
      {
        question: "Funciona em celulares?",
        answer: "Sim. A ferramenta reconhece sistemas móveis como Android e iOS, além do tipo de dispositivo (celular, tablet, etc.), quando essa informação está disponível no User-Agent.",
      },
    ],
  },
};
