/**
 * Banco de modelos de texto por tipo de conteúdo (ETAPA 9). Cada tipo tem
 * 3 estruturas de frase (abertura/corpo/fechamento) que já nascem com
 * diferenças reais de redação entre si — não são a mesma frase com
 * sinônimos trocados — para cumprir o requisito de gerar variações que
 * realmente parecem diferentes (ETAPA 10).
 *
 * Cada função recebe apenas o que o próprio usuário informou (assunto e,
 * quando preenchido, o público-alvo) e nunca inventa preço, desconto,
 * data, resultado ou depoimento — só frases genéricas de conexão em volta
 * do que foi digitado (ETAPA 9).
 */

import type { CaptionContentTypeId } from "./types";

export interface CaptionContext {
  /** Sempre preenchido — usa um texto neutro de reserva se o usuário não digitou nada. */
  subject: string;
  /** null quando o usuário não informou público-alvo. */
  audience: string | null;
}

export interface CaptionTemplateVariant {
  hook: (ctx: CaptionContext) => string;
  body: (ctx: CaptionContext) => string;
  closing: (ctx: CaptionContext) => string;
}

function audienceClause(ctx: CaptionContext): string {
  return ctx.audience ? ` Pensado especialmente para ${ctx.audience}.` : "";
}

export const CAPTION_CONTENT_TEMPLATES: Record<CaptionContentTypeId, CaptionTemplateVariant[]> = {
  promocao: [
    {
      hook: (ctx) => `${ctx.subject} está em destaque por aqui.${audienceClause(ctx)}`,
      body: () => "Preparamos essa novidade com cuidado para você conferir de perto.",
      closing: () => "Não deixe essa oportunidade passar.",
    },
    {
      hook: (ctx) => `Tem novidade fresquinha por aqui: ${ctx.subject}.${audienceClause(ctx)}`,
      body: () => "Foi pensada com carinho para quem acompanha a gente por aqui.",
      closing: () => "Vem conferir antes que a novidade esfrie.",
    },
    {
      hook: (ctx) => `Já ouviu falar em ${ctx.subject}?${audienceClause(ctx)}`,
      body: () => "Um convite para você conhecer de pertinho o que preparamos.",
      closing: () => "Fica ligado, essa é para você.",
    },
  ],
  produto: [
    {
      hook: (ctx) => `Apresentamos ${ctx.subject}.${audienceClause(ctx)}`,
      body: () => "Cada detalhe foi pensado para atender bem quem confia na gente.",
      closing: () => "Conheça de perto e tire suas dúvidas com a gente.",
    },
    {
      hook: (ctx) => `${ctx.subject} agora faz parte do nosso catálogo.${audienceClause(ctx)}`,
      body: () => "Um item pensado para o dia a dia de quem busca praticidade.",
      closing: () => "Fale com a gente para saber mais.",
    },
    {
      hook: (ctx) => `Curiosidade sobre ${ctx.subject}? Vamos te mostrar.${audienceClause(ctx)}`,
      body: () => "Reunimos as principais informações para facilitar sua decisão.",
      closing: () => "Chama no direct para conversar melhor.",
    },
  ],
  restaurante: [
    {
      hook: (ctx) => `${ctx.subject} está esperando por você.${audienceClause(ctx)}`,
      body: () => "Preparado com carinho para tornar sua experiência ainda melhor.",
      closing: () => "Reserve sua mesa e venha experimentar.",
    },
    {
      hook: (ctx) => `Bateu aquela vontade de ${ctx.subject}?${audienceClause(ctx)}`,
      body: () => "Aqui você encontra um ambiente pensado para receber bem.",
      closing: () => "Estamos te esperando de portas abertas.",
    },
    {
      hook: (ctx) => `Conheça mais sobre ${ctx.subject} no nosso cardápio.${audienceClause(ctx)}`,
      body: () => "Cada prato é preparado com atenção para agradar quem visita a gente.",
      closing: () => "Venha nos visitar e conte pra gente o que achou.",
    },
  ],
  aniversario: [
    {
      hook: (ctx) => `Hoje é dia de celebrar ${ctx.subject}.${audienceClause(ctx)}`,
      body: () => "Um momento especial que merece ser comemorado com quem a gente gosta.",
      closing: () => "Parabéns, que venham muitas alegrias!",
    },
    {
      hook: (ctx) => `Mais um ano de ${ctx.subject}!${audienceClause(ctx)}`,
      body: () => "Que essa nova fase venha cheia de boas conquistas.",
      closing: () => "Desejamos tudo de bom nesse novo ciclo.",
    },
    {
      hook: (ctx) => `Celebrando ${ctx.subject} com muito carinho.${audienceClause(ctx)}`,
      body: () => "Cada ano é uma nova página cheia de histórias para contar.",
      closing: () => "Felicidades, hoje e sempre!",
    },
  ],
  agradecimento: [
    {
      hook: (ctx) => `Nosso muito obrigado por ${ctx.subject}.${audienceClause(ctx)}`,
      body: () => "Cada gesto de apoio faz toda a diferença para a gente continuar.",
      closing: () => "Gratidão é o que sentimos por ter você com a gente.",
    },
    {
      hook: (ctx) => `Queremos agradecer por ${ctx.subject}.${audienceClause(ctx)}`,
      body: () => "Reconhecer quem caminha com a gente é sempre importante.",
      closing: () => "De coração, muito obrigado.",
    },
    {
      hook: (ctx) => `${ctx.subject} nos deixou muito gratos.${audienceClause(ctx)}`,
      body: () => "Ter esse tipo de apoio motiva a gente a continuar fazendo o nosso melhor.",
      closing: () => "Obrigado por fazer parte dessa jornada.",
    },
  ],
  "conteudo-educativo": [
    {
      hook: (ctx) => `Vamos falar sobre ${ctx.subject}.${audienceClause(ctx)}`,
      body: () => "Reunimos informações úteis para ajudar quem quer entender melhor o assunto.",
      closing: () => "Salve esse post para consultar depois.",
    },
    {
      hook: (ctx) => `Você sabia mais sobre ${ctx.subject}?${audienceClause(ctx)}`,
      body: () => "Preparamos um conteúdo pensado para esclarecer as principais dúvidas.",
      closing: () => "Compartilhe com quem também precisa saber disso.",
    },
    {
      hook: (ctx) => `Hoje o assunto é ${ctx.subject}.${audienceClause(ctx)}`,
      body: () => "Trouxemos informações relevantes de um jeito simples de entender.",
      closing: () => "Deixe sua dúvida nos comentários.",
    },
  ],
  dicas: [
    {
      hook: (ctx) => `Separamos algumas dicas sobre ${ctx.subject}.${audienceClause(ctx)}`,
      body: () => "Ideias simples que podem fazer diferença no seu dia a dia.",
      closing: () => "Salve esse post para consultar quando precisar.",
    },
    {
      hook: (ctx) => `Quer dicas sobre ${ctx.subject}?${audienceClause(ctx)}`,
      body: () => "Reunimos sugestões práticas para você aplicar quando quiser.",
      closing: () => "Conta pra gente se já testou alguma dessas.",
    },
    {
      hook: (ctx) => `Hoje trouxemos dicas sobre ${ctx.subject}.${audienceClause(ctx)}`,
      body: () => "Um conteúdo pensado para facilitar o seu dia a dia.",
      closing: () => "Compartilhe com quem também vai gostar dessas dicas.",
    },
  ],
  comunicado: [
    {
      hook: (ctx) => `Um aviso importante sobre ${ctx.subject}.${audienceClause(ctx)}`,
      body: () => "Preparamos essa comunicação para manter você sempre bem informado.",
      closing: () => "Qualquer dúvida, estamos à disposição.",
    },
    {
      hook: (ctx) => `Atenção: novidades sobre ${ctx.subject}.${audienceClause(ctx)}`,
      body: () => "Queremos manter você por dentro de tudo que está acontecendo.",
      closing: () => "Conte com a gente para o que precisar.",
    },
    {
      hook: (ctx) => `Comunicado sobre ${ctx.subject}.${audienceClause(ctx)}`,
      body: () => "Reunimos as principais informações para deixar tudo claro.",
      closing: () => "Fique atento às próximas atualizações.",
    },
  ],
  motivacional: [
    {
      hook: (ctx) => `Sobre ${ctx.subject}, uma reflexão para o seu dia.${audienceClause(ctx)}`,
      body: () => "Cada passo dado com dedicação vale a pena, mesmo quando parece pequeno.",
      closing: () => "Continue seguindo em frente, você está no caminho certo.",
    },
    {
      hook: (ctx) => `Um lembrete sobre ${ctx.subject}.${audienceClause(ctx)}`,
      body: () => "Grandes conquistas começam com pequenas atitudes do dia a dia.",
      closing: () => "Acredite no seu processo.",
    },
    {
      hook: (ctx) => `Hoje a reflexão é sobre ${ctx.subject}.${audienceClause(ctx)}`,
      body: () => "Nem sempre o caminho é fácil, mas cada esforço conta.",
      closing: () => "Siga em frente, confiando no seu potencial.",
    },
  ],
  pessoal: [
    {
      hook: (ctx) => `Um momento especial: ${ctx.subject}.${audienceClause(ctx)}`,
      body: () => "Guardar essas lembranças é sempre bom, para poder revisitar depois.",
      closing: () => "Obrigado por acompanhar mais essa parte da minha história.",
    },
    {
      hook: (ctx) => `Compartilhando um pouco sobre ${ctx.subject}.${audienceClause(ctx)}`,
      body: () => "Esses momentos merecem ser registrados e lembrados com carinho.",
      closing: () => "Obrigado por estar por aqui comigo.",
    },
    {
      hook: (ctx) => `Sobre ${ctx.subject}: um registro para guardar.${audienceClause(ctx)}`,
      body: () => "Cada momento assim vale a pena ser compartilhado com quem acompanha a gente.",
      closing: () => "Até a próxima novidade por aqui.",
    },
  ],
};
