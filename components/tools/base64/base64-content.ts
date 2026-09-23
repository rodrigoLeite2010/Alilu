import type { ToolContentSection, ToolFaqItem } from "@/components/tools/ToolPageTemplate";

/**
 * Conteúdo explicativo e FAQ das ferramentas do Conversor Base64. Cada
 * ferramenta tem texto próprio (sem conteúdo duplicado entre páginas); o
 * objeto é mesclado em components/tools/tool-content.tsx.
 */

const PRIVACY: ToolContentSection = {
  title: "Privacidade",
  body: "A conversão acontece inteiramente no seu navegador. O Alilu Utilitários não envia, não recebe e não armazena o conteúdo que você cola ou os arquivos que você escolhe.",
};

export const base64ToolContent: Record<string, { contentSections: ToolContentSection[]; faq: ToolFaqItem[] }> = {
  "base64-para-ascii": {
    contentSections: [
      {
        title: "Como converter Base64 para ASCII?",
        body: "Cole o Base64 e clique em Converter. Cada byte decodificado vira um caractere da tabela ASCII. Espaços e quebras de linha no Base64 são ignorados, e a variante URL-safe (com - e _) também é aceita.",
      },
      {
        title: "ASCII ou texto UTF-8?",
        body: "ASCII cobre apenas os códigos 0 a 127 — letras sem acento, números e símbolos básicos. Se o conteúdo tiver bytes acima disso, a ferramenta avisa quantos são. Para textos em português com acentos ou emojis, use Base64 para Texto, que decodifica UTF-8 corretamente.",
      },
      PRIVACY,
    ],
    faq: [
      { question: "O que acontece com bytes fora da tabela ASCII?", answer: "Eles são exibidos como caracteres Latin-1 e contados em um aviso, para você saber que o conteúdo não é ASCII puro." },
      { question: "Base64 inválido gera erro?", answer: "Sim. Se houver caracteres fora do alfabeto Base64 ou o comprimento não fizer sentido, a ferramenta mostra \"Base64 inválido.\" em vez de um resultado incorreto." },
    ],
  },
  "base64-para-audio": {
    contentSections: [
      {
        title: "Como transformar Base64 em áudio?",
        body: "Cole o Base64 puro ou um Data URI (data:audio/mpeg;base64,...). A ferramenta decodifica os bytes, identifica o formato pela assinatura do arquivo quando possível e exibe um player para você ouvir antes de baixar.",
      },
      {
        title: "Formatos suportados",
        body: "MP3 (audio/mpeg), WAV, OGG, WEBM, M4A e FLAC são reconhecidos automaticamente. A reprodução no player depende do suporte do seu navegador; o download funciona para qualquer formato.",
      },
      PRIVACY,
    ],
    faq: [
      { question: "Preciso informar o tipo do áudio?", answer: "Não. Se o Base64 vier como Data URI, o MIME dele é usado; caso contrário, o formato é detectado pelos primeiros bytes do arquivo. Se nada for identificado, o arquivo é tratado como MP3." },
      { question: "Por que o player não toca meu áudio?", answer: "Alguns formatos não são reproduzidos por todos os navegadores. Nesse caso, baixe o arquivo e abra em um player instalado no seu dispositivo." },
    ],
  },
  "basic-auth-decode": {
    contentSections: [
      {
        title: "O que é Basic Auth?",
        body: "HTTP Basic Authentication envia usuário e senha no cabeçalho Authorization no formato \"Basic \" seguido de usuário:senha codificado em Base64. Base64 não é criptografia: qualquer pessoa com o cabeçalho consegue ler as credenciais.",
      },
      {
        title: "Como decodificar o cabeçalho?",
        body: "Cole o cabeçalho completo (Authorization: Basic ...), apenas \"Basic ...\" ou só a parte em Base64. O prefixo é removido automaticamente e a ferramenta mostra usuário, senha e o conteúdo completo, cada um com botão de copiar.",
      },
      PRIVACY,
    ],
    faq: [
      { question: "É seguro colar credenciais aqui?", answer: "A decodificação é local e nada é enviado. Mesmo assim, evite usar senhas reais ou credenciais sensíveis em computadores públicos ou compartilhados." },
      { question: "E se não houver dois-pontos no conteúdo?", answer: "O formato Basic Auth exige usuário:senha. Sem o separador, a ferramenta avisa que o conteúdo não segue esse padrão — use Base64 para Texto para ver o valor decodificado." },
    ],
  },
  "base64-para-arquivo": {
    contentSections: [
      {
        title: "Como converter Base64 em arquivo?",
        body: "Cole o Base64 ou o Data URI, defina o nome do arquivo e clique em Converter. Depois, use Baixar arquivo. Se você não informar extensão, ela é escolhida a partir do tipo detectado (por exemplo, .pdf, .png ou .zip).",
      },
      {
        title: "Detecção do tipo de arquivo",
        body: "A ordem de prioridade é: o MIME do Data URI, o MIME que você digitar e, por último, a detecção pelos bytes iniciais (PDF, PNG, JPG, GIF, WebP, ZIP, MP3, MP4 e outros). Sem nenhuma pista, o arquivo é salvo como application/octet-stream.",
      },
      PRIVACY,
    ],
    faq: [
      { question: "O nome do arquivo é tratado?", answer: "Sim. Caracteres inválidos em nomes de arquivo (como / \\ : * ? \" < > |) são substituídos antes do download." },
      { question: "Há limite de tamanho?", answer: "O limite é a memória do seu navegador. Base64 muito grandes (dezenas de MB) podem demorar para decodificar em celulares." },
    ],
  },
  "base64-para-hex": {
    contentSections: [
      {
        title: "Como converter Base64 para hexadecimal?",
        body: "O Base64 é decodificado em bytes, e cada byte vira dois dígitos hexadecimais (00 a ff). Você pode alternar entre letras minúsculas e maiúsculas a qualquer momento, sem converter de novo.",
      },
      {
        title: "Para que serve?",
        body: "Ver os bytes em hexadecimal ajuda a inspecionar hashes, chaves, assinaturas de arquivo e payloads binários que costumam circular em Base64 em APIs e tokens.",
      },
      PRIVACY,
    ],
    faq: [
      { question: "O resultado mostra quantos bytes existem?", answer: "Sim, a contagem de bytes decodificados aparece logo abaixo do hexadecimal." },
      { question: "Posso fazer o caminho inverso?", answer: "Sim, use a ferramenta Hexadecimal para Base64." },
    ],
  },
  "base64-para-imagem": {
    contentSections: [
      {
        title: "Como ver uma imagem em Base64?",
        body: "Cole o Base64 ou o Data URI (data:image/png;base64,...) e clique em Converter. A imagem aparece na prévia com o MIME, o tamanho em bytes e as dimensões em pixels, e pode ser baixada com a extensão correta.",
      },
      {
        title: "Formatos reconhecidos",
        body: "PNG, JPG/JPEG, GIF, WebP e SVG são identificados pela assinatura do arquivo. Se o conteúdo não for uma imagem, a ferramenta mostra um erro em vez de gerar um arquivo corrompido.",
      },
      PRIVACY,
    ],
    faq: [
      { question: "Funciona com Data URI copiado do CSS ou HTML?", answer: "Sim. Basta colar o valor completo, começando por data:image/...;base64,. O prefixo é removido automaticamente." },
      { question: "A imagem é enviada para algum servidor?", answer: "Não. A prévia usa um endereço temporário (Blob URL) criado no seu navegador, que é liberado quando você limpa ou converte outra imagem." },
    ],
  },
  "base64-para-pdf": {
    contentSections: [
      {
        title: "Como abrir um PDF em Base64?",
        body: "Cole o Base64 puro ou o Data URI data:application/pdf;base64,... e clique em Converter. A ferramenta confere se o conteúdo começa com a assinatura %PDF, mostra a prévia e oferece os botões Visualizar PDF e Baixar PDF.",
      },
      {
        title: "Onde encontro PDFs em Base64?",
        body: "É comum em respostas de APIs (boletos, notas fiscais, contratos), anexos de e-mail em formato bruto e integrações que trafegam arquivos dentro de JSON.",
      },
      PRIVACY,
    ],
    faq: [
      { question: "Por que aparece que não é um PDF válido?", answer: "O conteúdo decodificado não começa com %PDF. Verifique se o Base64 está completo ou se é de outro tipo de arquivo — nesse caso, use Base64 para Arquivo." },
      { question: "A prévia não aparece no celular. E agora?", answer: "Alguns navegadores móveis não exibem PDF incorporado. Use Visualizar PDF para abrir em nova aba ou baixe o arquivo." },
    ],
  },
  "base64-para-texto": {
    contentSections: [
      {
        title: "Como decodificar Base64 para texto?",
        body: "Cole o Base64 e clique em Converter. Os bytes são interpretados como UTF-8 com TextDecoder, o que preserva acentos, cedilha, emojis e qualquer caractere Unicode — diferente de usar apenas atob, que corrompe textos em português.",
      },
      {
        title: "Exemplo",
        body: "U8OjbyBKb3PDqSBkb3MgQ2FtcG9z decodifica para \"São José dos Campos\". Espaços, quebras de linha e a variante URL-safe do Base64 são aceitos.",
      },
      PRIVACY,
    ],
    faq: [
      { question: "E se o Base64 for de um arquivo binário?", answer: "A ferramenta avisa que o conteúdo não é texto UTF-8 válido. Para arquivos, use Base64 para Arquivo, Imagem ou PDF." },
      { question: "Preciso incluir o padding (=)?", answer: "Não. Se os sinais de igual no final estiverem faltando, eles são completados automaticamente." },
    ],
  },
  "base64-para-video": {
    contentSections: [
      {
        title: "Como converter Base64 em vídeo?",
        body: "Cole o Base64 ou o Data URI (data:video/mp4;base64,...), clique em Converter e assista no player. O formato é detectado pelos bytes iniciais (MP4, WEBM, OGG, MOV) e o arquivo pode ser baixado com a extensão correta.",
      },
      {
        title: "Vídeos grandes",
        body: "Vídeo em Base64 ocupa cerca de 33% a mais que o arquivo original. Colar dezenas de MB de texto pode deixar o navegador lento, principalmente em celulares.",
      },
      PRIVACY,
    ],
    faq: [
      { question: "Quais formatos tocam no player?", answer: "MP4 (H.264) e WEBM funcionam na maioria dos navegadores. OGG e MOV dependem do navegador, mas o download sempre funciona." },
      { question: "O vídeo é enviado para algum lugar?", answer: "Não. Ele é montado na memória do seu navegador e reproduzido por um Blob URL temporário." },
    ],
  },
  "audio-para-base64": {
    contentSections: [
      {
        title: "Como converter áudio para Base64?",
        body: "Selecione ou arraste um arquivo de áudio (MP3, WAV, OGG, M4A, WEBM) e clique em Converter. Você recebe o Base64 puro e o Data URI prontos para copiar, além de um player para conferir o arquivo.",
      },
      {
        title: "Quando usar áudio em Base64?",
        body: "Data URIs de áudio são úteis para embutir sons curtos em HTML, e-mails, testes automatizados ou payloads JSON, sem depender de um arquivo hospedado separadamente.",
      },
      PRIVACY,
    ],
    faq: [
      { question: "Qual o tamanho máximo?", answer: "Até 50 MB por arquivo, para não travar o navegador. O resultado em Base64 fica cerca de 33% maior que o original." },
      { question: "Posso voltar para o arquivo de áudio?", answer: "Sim, cole o Base64 na ferramenta Base64 para Áudio." },
    ],
  },
  "css-para-base64": {
    contentSections: [
      {
        title: "Como converter CSS para Base64?",
        body: "Cole o código CSS ou envie um arquivo .css e clique em Converter. O texto é codificado em UTF-8 e você recebe o Base64 e um Data URI text/css, que pode ser usado em <link href=\"data:text/css;base64,...\"> ou @import.",
      },
      {
        title: "Quando faz sentido?",
        body: "Embutir CSS em Base64 é útil em protótipos, páginas de arquivo único, e-mails e extensões, quando você não quer depender de um arquivo externo. Para sites em produção, arquivos .css separados costumam ser mais eficientes por causa do cache.",
      },
      PRIVACY,
    ],
    faq: [
      { question: "Posso mudar o MIME do Data URI?", answer: "Sim. O campo MIME type do Data URI vem preenchido com text/css, mas pode ser alterado." },
      { question: "Comentários e acentos são mantidos?", answer: "Sim. O conteúdo é codificado exatamente como foi colado, em UTF-8." },
    ],
  },
  "arquivo-para-base64": {
    contentSections: [
      {
        title: "Como converter um arquivo para Base64?",
        body: "Selecione ou arraste qualquer arquivo — ZIP, DOCX, JSON, planilhas, executáveis — e clique em Converter. A ferramenta mostra nome, MIME e tamanho e gera o Base64 e o Data URI.",
      },
      {
        title: "Arquivos grandes",
        body: "Arquivos de até 100 MB são aceitos. A conversão é feita em blocos, com barra de progresso, para a página continuar respondendo. Resultados muito grandes aparecem resumidos, mas podem ser copiados ou baixados inteiros em .txt.",
      },
      PRIVACY,
    ],
    faq: [
      { question: "O arquivo sai do meu computador?", answer: "Não. Ele é lido com a API FileReader do navegador e convertido localmente." },
      { question: "Como transformo o Base64 em arquivo de novo?", answer: "Use Base64 para Arquivo e informe o nome e a extensão desejados." },
    ],
  },
  "hex-para-base64": {
    contentSections: [
      {
        title: "Como converter hexadecimal para Base64?",
        body: "Cole a string hexadecimal e clique em Converter. Espaços, quebras de linha, dois-pontos, hífens e o prefixo 0x são removidos automaticamente, e letras maiúsculas ou minúsculas são aceitas.",
      },
      {
        title: "Validação",
        body: "A ferramenta confere se há apenas dígitos 0-9 e letras A-F e se a quantidade de dígitos é par (cada byte tem dois dígitos). Se algo estiver errado, ela explica o motivo.",
      },
      PRIVACY,
    ],
    faq: [
      { question: "Funciona com hashes SHA-256 e MD5?", answer: "Sim. É uma forma comum de converter um hash em hexadecimal para o formato Base64 usado em cabeçalhos como Content-MD5 ou em SRI." },
      { question: "Posso colar bytes separados por espaço?", answer: "Sim, por exemplo \"41 6C 69 6C 75\" vira QWxpbHU=." },
    ],
  },
  "html-para-base64": {
    contentSections: [
      {
        title: "Como converter HTML para Base64?",
        body: "Cole o código HTML e clique em Converter. O texto é codificado em UTF-8 e você recebe o Base64 puro e o Data URI data:text/html;charset=utf-8;base64,..., que pode ser aberto como página ou usado em iframes.",
      },
      {
        title: "O HTML é executado?",
        body: "Não. O código é tratado apenas como texto: nenhum script, estilo ou elemento colado é renderizado nesta página.",
      },
      PRIVACY,
    ],
    faq: [
      { question: "Acentos no HTML ficam corretos?", answer: "Sim. A codificação é UTF-8 e o Data URI inclui charset=utf-8 para que navegadores exibam os acentos corretamente." },
      { question: "Posso decodificar depois?", answer: "Sim, cole o Base64 em Base64 para Texto." },
    ],
  },
  "imagem-para-base64": {
    contentSections: [
      {
        title: "Como converter imagem para Base64?",
        body: "Selecione ou arraste uma imagem PNG, JPG, GIF, WebP ou SVG. A prévia aparece na hora e, ao clicar em Converter, você recebe o Base64 e o Data URI para usar em <img src>, background-image no CSS ou JSON.",
      },
      {
        title: "Vale a pena usar imagem em Base64?",
        body: "Para ícones e imagens pequenas, embutir em Base64 evita uma requisição extra. Para imagens grandes, prefira arquivos normais: o Base64 é cerca de 33% maior e não aproveita o cache do navegador da mesma forma.",
      },
      PRIVACY,
    ],
    faq: [
      { question: "Qual o tamanho máximo da imagem?", answer: "Até 20 MB por arquivo." },
      { question: "A ferramenta mostra as dimensões?", answer: "Sim, a prévia exibe largura e altura em pixels." },
    ],
  },
  "pdf-para-base64": {
    contentSections: [
      {
        title: "Como converter PDF para Base64?",
        body: "Selecione ou arraste um PDF e clique em Converter. O arquivo é validado pela extensão, pelo MIME e pela assinatura %PDF, e você recebe o Base64 e o Data URI data:application/pdf;base64,... para copiar.",
      },
      {
        title: "Uso em APIs",
        body: "Muitas APIs pedem documentos em Base64 dentro do JSON — por exemplo, para assinatura digital, envio de anexos ou emissão de documentos. O Base64 puro é o formato normalmente esperado nesses campos.",
      },
      PRIVACY,
    ],
    faq: [
      { question: "Qual o limite de tamanho?", answer: "Até 50 MB por PDF. O Base64 gerado fica cerca de 33% maior que o arquivo." },
      { question: "PDF protegido por senha funciona?", answer: "Sim. A conversão não abre o conteúdo do PDF, apenas codifica os bytes do arquivo como estão." },
    ],
  },
  "texto-para-base64": {
    contentSections: [
      {
        title: "Como codificar texto em Base64?",
        body: "Digite ou cole o texto e clique em Converter. O texto é transformado em bytes UTF-8 com TextEncoder antes da codificação, então português, acentos, emojis e qualquer caractere Unicode funcionam sem erro.",
      },
      {
        title: "Exemplos",
        body: "\"Alilu\" vira QWxpbHU=, \"Olá, mundo!\" vira T2zDoSwgbXVuZG8h e \"🚀 Alilu\" vira 8J+agCBBbGlsdQ==.",
      },
      PRIVACY,
    ],
    faq: [
      { question: "Base64 é criptografia?", answer: "Não. Base64 é apenas uma forma de representar bytes com caracteres seguros para texto. Qualquer pessoa consegue decodificar." },
      { question: "Por que btoa dá erro com acentos?", answer: "A função btoa do navegador só aceita caracteres Latin-1. Esta ferramenta converte o texto para UTF-8 primeiro, evitando o erro." },
    ],
  },
  "url-para-base64": {
    contentSections: [
      {
        title: "Dois modos de conversão",
        body: "Em Texto da URL, o próprio endereço é codificado (https://alilu.com.br vira aHR0cHM6Ly9hbGlsdS5jb20uYnI=). Em Conteúdo da URL, o arquivo que está no endereço é baixado e convertido para Base64 e Data URI.",
      },
      {
        title: "Como o download funciona com segurança",
        body: "O conteúdo é baixado diretamente pelo seu navegador, sem passar pelo servidor do Alilu e sem enviar cookies. Por isso só funciona com sites que liberam acesso de outros domínios (CORS), e há limite de 20 MB.",
      },
      PRIVACY,
    ],
    faq: [
      { question: "Por que o modo Conteúdo da URL falhou?", answer: "O site provavelmente não permite CORS, está fora do ar ou exige login. Nesse caso, baixe o arquivo e use Arquivo para Base64." },
      { question: "O Base64 gerado serve em URLs?", answer: "O resultado usa o alfabeto Base64 padrão (+ e /). Se for usá-lo dentro de uma URL, aplique codificação de URL (encodeURIComponent)." },
    ],
  },
  "video-para-base64": {
    contentSections: [
      {
        title: "Como converter vídeo para Base64?",
        body: "Selecione ou arraste um vídeo MP4, WEBM, OGV ou MOV e clique em Converter. A conversão é feita em blocos com barra de progresso, e você recebe o Base64 e o Data URI.",
      },
      {
        title: "Atenção ao tamanho",
        body: "Base64 normalmente aumenta o tamanho dos dados em cerca de 33%: um vídeo de 60 MB vira cerca de 80 MB de texto. O limite é de 100 MB por arquivo para não travar o navegador; resultados grandes podem ser baixados em .txt.",
      },
      PRIVACY,
    ],
    faq: [
      { question: "Por que o limite é 100 MB?", answer: "Toda a conversão acontece na memória do navegador. Acima disso, muitos dispositivos ficam lentos ou fecham a aba." },
      { question: "Posso assistir ao vídeo antes de converter?", answer: "Sim, a prévia aparece logo após selecionar o arquivo." },
    ],
  },
};
