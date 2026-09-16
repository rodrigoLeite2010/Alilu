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
};
