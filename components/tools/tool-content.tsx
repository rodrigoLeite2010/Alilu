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
};
