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
};
