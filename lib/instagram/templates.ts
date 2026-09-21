/**
 * Os cinco templates profissionais do Criador de Posts (ETAPA 4). Cada
 * template é apenas DADOS: posições proporcionais (frações de 0 a 1 da
 * largura/altura do canvas), estilos e textos padrão — o desenho real é
 * feito por lib/instagram/render.ts, que interpreta esta configuração para
 * qualquer um dos três formatos (lib/instagram/formats.ts). Usar frações em
 * vez de pixels fixos é o que garante que os elementos continuem
 * proporcionais e nunca fiquem cortados ao trocar de formato (ETAPA 3).
 *
 * Os quatro "slots" de texto (badge, heading, body, footer) existem em
 * TODOS os templates, com rótulos e valores padrão adaptados a cada
 * contexto — isso mantém a Área A do editor genérica e previsível (mesmos
 * controles em qualquer template), enquanto cada template continua
 * cobrindo os elementos pedidos nas especificações originais:
 *   - Promoção: badge = desconto, heading = título promocional,
 *     body = texto complementar, footer = nome da loja, além da área de
 *     fotografia do produto.
 *   - Restaurante: badge = preço opcional, heading = nome do produto,
 *     body = texto de destaque, footer = chamada para ação.
 *   - Aniversário: badge = eyebrow "convite", heading = nome do
 *     aniversariante, body = data e horário, footer = local.
 *   - Comunicado: badge = rótulo curto, heading = título,
 *     body = mensagem principal (multilinha), footer = nome da empresa.
 *   - Frase motivacional: heading = frase (multilinha), footer = autor.
 *
 * Um slot cujo valor fica vazio nunca é desenhado (ETAPA 4: "preservar uma
 * margem de segurança para textos" e nunca desenhar espaço reservado
 * vazio) — ver lib/instagram/render.ts.
 */

export type PostTemplateId =
  | "promocao"
  | "restaurante"
  | "aniversario"
  | "comunicado"
  | "frase-motivacional";

export type TextSlotId = "badge" | "heading" | "body" | "footer";

export type TextAlign = "left" | "center" | "right";

export interface TextSlotLayout {
  /**
   * Posição de ancoragem do texto, em fração da largura/altura do canvas
   * (0..1). Para align "left"/"right" representa a borda esquerda/direita
   * do bloco; para "center", o centro horizontal.
   */
  xFrac: number;
  yFrac: number;
  /** Largura máxima do bloco de texto, em fração da largura do canvas. */
  maxWidthFrac: number;
  align: TextAlign;
  /** Tamanho de fonte em fração da MENOR dimensão do canvas (mantém a proporção do texto ao trocar de formato). */
  fontSizeFrac: number;
  fontWeight: "normal" | "bold";
  lineHeight: number;
  uppercase?: boolean;
  letterSpacing?: number;
  /** Desenha o texto dentro de um "pill" (cápsula) com cor de destaque — usado para selos e chamadas para ação. */
  pill?: boolean;
}

export interface TextSlotConfig {
  label: string;
  placeholder: string;
  defaultValue: string;
  maxLength: number;
  multiline: boolean;
  layout: TextSlotLayout;
}

export interface ImageAreaConfig {
  xFrac: number;
  yFrac: number;
  widthFrac: number;
  heightFrac: number;
  cornerRadiusFrac: number;
}

export type TemplateDecoration = "ribbon" | "frame" | "dots" | "clean" | "quote-marks";

export interface PostTemplate {
  id: PostTemplateId;
  name: string;
  audience: string;
  description: string;
  defaultColorComboId: string;
  defaultFontId: string;
  slots: {
    badge: TextSlotConfig & { enabledByDefault: boolean };
    heading: TextSlotConfig;
    body: TextSlotConfig;
    footer: TextSlotConfig;
  };
  /**
   * Área reservada para a fotografia do produto/prato/pessoa, dentro do
   * cartão. Quando `null`, o template não tem uma área de foto separada:
   * se o usuário enviar uma imagem, ela é usada como imagem de fundo em
   * tela cheia (com um degradê escuro por cima, para manter o texto
   * legível — ver `scrimOverBackgroundImage`).
   */
  imageArea: ImageAreaConfig | null;
  scrimOverBackgroundImage: boolean;
  decoration: TemplateDecoration;
}

const baseSlotDefaults = {
  badgeMaxLength: 24,
  headingMaxLength: 70,
  bodyMaxLength: 140,
  footerMaxLength: 40,
};

export const POST_TEMPLATES: PostTemplate[] = [
  {
    id: "promocao",
    name: "Promoção",
    audience: "Lojas e comércio",
    description:
      "Visual comercial e chamativo, com selo de desconto e área para foto do produto.",
    defaultColorComboId: "sunset",
    defaultFontId: "sans-ui",
    imageArea: { xFrac: 0.12, yFrac: 0.13, widthFrac: 0.76, heightFrac: 0.4, cornerRadiusFrac: 0.06 },
    scrimOverBackgroundImage: false,
    decoration: "ribbon",
    slots: {
      badge: {
        label: "Destaque para desconto",
        placeholder: "Ex.: 50% OFF",
        defaultValue: "50% OFF",
        maxLength: baseSlotDefaults.badgeMaxLength,
        multiline: false,
        enabledByDefault: true,
        layout: { xFrac: 0.5, yFrac: 0.555, maxWidthFrac: 0.5, align: "center", fontSizeFrac: 0.052, fontWeight: "bold", lineHeight: 1.1, uppercase: true, pill: true },
      },
      heading: {
        label: "Título promocional",
        placeholder: "Ex.: Mega Promoção de Verão",
        defaultValue: "Mega Promoção",
        maxLength: baseSlotDefaults.headingMaxLength,
        multiline: false,
        layout: { xFrac: 0.5, yFrac: 0.665, maxWidthFrac: 0.86, align: "center", fontSizeFrac: 0.078, fontWeight: "bold", lineHeight: 1.15, uppercase: true },
      },
      body: {
        label: "Texto complementar",
        placeholder: "Ex.: Só esta semana, em todas as lojas",
        defaultValue: "Só esta semana, aproveite!",
        maxLength: baseSlotDefaults.bodyMaxLength,
        multiline: false,
        layout: { xFrac: 0.5, yFrac: 0.755, maxWidthFrac: 0.8, align: "center", fontSizeFrac: 0.04, fontWeight: "normal", lineHeight: 1.3 },
      },
      footer: {
        label: "Nome da loja",
        placeholder: "Ex.: Loja Alilu",
        defaultValue: "Sua Loja Aqui",
        maxLength: baseSlotDefaults.footerMaxLength,
        multiline: false,
        layout: { xFrac: 0.5, yFrac: 0.915, maxWidthFrac: 0.8, align: "center", fontSizeFrac: 0.032, fontWeight: "bold", lineHeight: 1.2, uppercase: true, letterSpacing: 1.5 },
      },
    },
  },
  {
    id: "restaurante",
    name: "Restaurante",
    audience: "Restaurantes, lanchonetes e delivery",
    description:
      "Foto do prato em destaque, preço opcional e chamada para ação em formato de botão.",
    defaultColorComboId: "forest",
    defaultFontId: "sans",
    imageArea: { xFrac: 0.08, yFrac: 0.07, widthFrac: 0.84, heightFrac: 0.46, cornerRadiusFrac: 0.07 },
    scrimOverBackgroundImage: false,
    decoration: "frame",
    slots: {
      badge: {
        label: "Preço (opcional)",
        placeholder: "Ex.: R$ 29,90",
        defaultValue: "",
        maxLength: baseSlotDefaults.badgeMaxLength,
        multiline: false,
        enabledByDefault: false,
        layout: { xFrac: 0.87, yFrac: 0.135, maxWidthFrac: 0.35, align: "right", fontSizeFrac: 0.048, fontWeight: "bold", lineHeight: 1.1, pill: true },
      },
      heading: {
        label: "Nome do produto",
        placeholder: "Ex.: X-Burger Especial",
        defaultValue: "X-Burger Especial",
        maxLength: baseSlotDefaults.headingMaxLength,
        multiline: false,
        layout: { xFrac: 0.5, yFrac: 0.635, maxWidthFrac: 0.86, align: "center", fontSizeFrac: 0.072, fontWeight: "bold", lineHeight: 1.15 },
      },
      body: {
        label: "Texto de destaque",
        placeholder: "Ex.: Novidade da casa",
        defaultValue: "Novidade da casa",
        maxLength: baseSlotDefaults.bodyMaxLength,
        multiline: false,
        layout: { xFrac: 0.5, yFrac: 0.72, maxWidthFrac: 0.8, align: "center", fontSizeFrac: 0.04, fontWeight: "normal", lineHeight: 1.3 },
      },
      footer: {
        label: "Chamada para ação",
        placeholder: "Ex.: Peça já pelo delivery",
        defaultValue: "Peça já pelo delivery",
        maxLength: baseSlotDefaults.footerMaxLength,
        multiline: false,
        layout: { xFrac: 0.5, yFrac: 0.875, maxWidthFrac: 0.7, align: "center", fontSizeFrac: 0.038, fontWeight: "bold", lineHeight: 1.2, uppercase: true, pill: true },
      },
    },
  },
  {
    id: "aniversario",
    name: "Aniversário",
    audience: "Convites e comemorações",
    description: "Layout convidativo para avisos de aniversário e festas.",
    defaultColorComboId: "berry",
    defaultFontId: "serif",
    imageArea: { xFrac: 0.24, yFrac: 0.06, widthFrac: 0.52, heightFrac: 0.3, cornerRadiusFrac: 0.5 },
    scrimOverBackgroundImage: false,
    decoration: "dots",
    slots: {
      badge: {
        label: "Texto de convite (opcional)",
        placeholder: "Ex.: Você está convidado!",
        defaultValue: "Você está convidado!",
        maxLength: baseSlotDefaults.badgeMaxLength,
        multiline: false,
        enabledByDefault: true,
        layout: { xFrac: 0.5, yFrac: 0.42, maxWidthFrac: 0.8, align: "center", fontSizeFrac: 0.034, fontWeight: "bold", lineHeight: 1.2, uppercase: true, letterSpacing: 1.5 },
      },
      heading: {
        label: "Nome do aniversariante",
        placeholder: "Ex.: Maria",
        defaultValue: "Maria",
        maxLength: 40,
        multiline: false,
        layout: { xFrac: 0.5, yFrac: 0.525, maxWidthFrac: 0.86, align: "center", fontSizeFrac: 0.1, fontWeight: "bold", lineHeight: 1.1 },
      },
      body: {
        label: "Data e horário",
        placeholder: "Ex.: 20 de setembro às 19h",
        defaultValue: "20 de setembro às 19h",
        maxLength: baseSlotDefaults.bodyMaxLength,
        multiline: false,
        layout: { xFrac: 0.5, yFrac: 0.635, maxWidthFrac: 0.8, align: "center", fontSizeFrac: 0.044, fontWeight: "normal", lineHeight: 1.3 },
      },
      footer: {
        label: "Local",
        placeholder: "Ex.: Salão de festas Alilu",
        defaultValue: "Salão de festas Alilu",
        maxLength: baseSlotDefaults.footerMaxLength,
        multiline: false,
        layout: { xFrac: 0.5, yFrac: 0.71, maxWidthFrac: 0.8, align: "center", fontSizeFrac: 0.038, fontWeight: "normal", lineHeight: 1.3 },
      },
    },
  },
  {
    id: "comunicado",
    name: "Comunicado",
    audience: "Empresas e profissionais",
    description: "Visual limpo, profissional e de fácil leitura para avisos importantes.",
    defaultColorComboId: "paper",
    defaultFontId: "sans-ui",
    imageArea: null,
    scrimOverBackgroundImage: true,
    decoration: "clean",
    slots: {
      badge: {
        label: "Rótulo curto (opcional)",
        placeholder: "Ex.: Comunicado Oficial",
        defaultValue: "Comunicado Oficial",
        maxLength: baseSlotDefaults.badgeMaxLength,
        multiline: false,
        enabledByDefault: true,
        layout: { xFrac: 0.08, yFrac: 0.3, maxWidthFrac: 0.84, align: "left", fontSizeFrac: 0.03, fontWeight: "bold", lineHeight: 1.2, uppercase: true, letterSpacing: 1.5 },
      },
      heading: {
        label: "Título",
        placeholder: "Ex.: Novo horário de atendimento",
        defaultValue: "Novo horário de atendimento",
        maxLength: baseSlotDefaults.headingMaxLength,
        multiline: false,
        layout: { xFrac: 0.08, yFrac: 0.41, maxWidthFrac: 0.84, align: "left", fontSizeFrac: 0.07, fontWeight: "bold", lineHeight: 1.2 },
      },
      body: {
        label: "Mensagem principal",
        placeholder: "Ex.: A partir de segunda-feira, atendemos das 9h às 18h.",
        defaultValue: "A partir de segunda-feira, atendemos das 9h às 18h, de segunda a sexta.",
        maxLength: 220,
        multiline: true,
        layout: { xFrac: 0.08, yFrac: 0.56, maxWidthFrac: 0.84, align: "left", fontSizeFrac: 0.038, fontWeight: "normal", lineHeight: 1.5 },
      },
      footer: {
        label: "Nome da empresa",
        placeholder: "Ex.: Alilu Utilitários",
        defaultValue: "Alilu Utilitários",
        maxLength: baseSlotDefaults.footerMaxLength,
        multiline: false,
        layout: { xFrac: 0.08, yFrac: 0.9, maxWidthFrac: 0.84, align: "left", fontSizeFrac: 0.034, fontWeight: "bold", lineHeight: 1.2, uppercase: true },
      },
    },
  },
  {
    id: "frase-motivacional",
    name: "Frase motivacional",
    audience: "Criadores de conteúdo",
    description: "Frase em destaque com autoria opcional, para inspirar seguidores.",
    defaultColorComboId: "midnight",
    defaultFontId: "serif",
    imageArea: null,
    scrimOverBackgroundImage: true,
    decoration: "quote-marks",
    slots: {
      badge: {
        label: "Kicker (opcional)",
        placeholder: "Ex.: Frase da semana",
        defaultValue: "",
        maxLength: baseSlotDefaults.badgeMaxLength,
        multiline: false,
        enabledByDefault: false,
        layout: { xFrac: 0.5, yFrac: 0.28, maxWidthFrac: 0.8, align: "center", fontSizeFrac: 0.03, fontWeight: "bold", lineHeight: 1.2, uppercase: true, letterSpacing: 1.5 },
      },
      heading: {
        label: "Frase principal",
        placeholder: "Ex.: Feito é melhor que perfeito.",
        defaultValue: "Feito é melhor que perfeito.",
        maxLength: 160,
        multiline: true,
        layout: { xFrac: 0.5, yFrac: 0.48, maxWidthFrac: 0.78, align: "center", fontSizeFrac: 0.062, fontWeight: "bold", lineHeight: 1.35 },
      },
      body: {
        label: "Texto adicional (opcional)",
        placeholder: "Deixe em branco para um visual mais limpo",
        defaultValue: "",
        maxLength: baseSlotDefaults.bodyMaxLength,
        multiline: true,
        layout: { xFrac: 0.5, yFrac: 0.68, maxWidthFrac: 0.78, align: "center", fontSizeFrac: 0.036, fontWeight: "normal", lineHeight: 1.4 },
      },
      footer: {
        label: "Nome do autor (opcional)",
        placeholder: "Ex.: Provérbio popular",
        defaultValue: "",
        maxLength: baseSlotDefaults.footerMaxLength,
        multiline: false,
        layout: { xFrac: 0.5, yFrac: 0.82, maxWidthFrac: 0.7, align: "center", fontSizeFrac: 0.036, fontWeight: "normal", lineHeight: 1.2 },
      },
    },
  },
];

export const DEFAULT_TEMPLATE_ID: PostTemplateId = "promocao";

export function getTemplateById(id: string): PostTemplate {
  return POST_TEMPLATES.find((template) => template.id === id) ?? POST_TEMPLATES[0];
}

export function isPostTemplateId(value: string): value is PostTemplateId {
  return POST_TEMPLATES.some((template) => template.id === value);
}

export const TEXT_SLOT_IDS: TextSlotId[] = ["badge", "heading", "body", "footer"];
