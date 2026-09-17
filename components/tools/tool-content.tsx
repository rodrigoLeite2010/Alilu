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
};
