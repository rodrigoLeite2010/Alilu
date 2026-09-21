/**
 * Catálogo da categoria "Instagram e Redes Sociais".
 *
 * Mantido deliberadamente separado de data/categories.ts e data/tools.ts
 * (catálogo de calculadoras, preso à URL /utilitarios/[categoria]/[ferramenta]
 * e coberto por testes de integridade próprios em __tests__/data/catalog.test.ts
 * e __tests__/seo/seo-rules.test.ts) porque esta categoria vive em uma URL
 * própria e mais curta (/instagram), a pedido explícito do prompt de
 * implementação. Continua seguindo o mesmo princípio do catálogo original:
 * nome, descrição e URLs ficam centralizados aqui — nenhum componente deve
 * duplicá-los.
 */

export const INSTAGRAM_CATEGORY = {
  id: "instagram",
  name: "Instagram e Redes Sociais",
  shortName: "Instagram",
  path: "/instagram",
  title: "Ferramentas gratuitas para Instagram",
  subtitle:
    "Crie posts, personalize imagens e prepare conteúdos para suas redes sociais gratuitamente.",
  description:
    "Crie posts, imagens e conteúdos para Instagram gratuitamente. Edite modelos, personalize textos e baixe suas artes prontas para publicar.",
  metaTitle: "Ferramentas para Instagram Grátis | ALILU",
  metaDescription:
    "Crie posts e imagens para Instagram gratuitamente. Personalize modelos, edite textos e prepare conteúdos para suas redes sociais.",
  icon: "instagram",
} as const;

export interface InstagramTool {
  id: string;
  name: string;
  shortName: string;
  path: string;
  description: string;
  pageDescription: string;
  metaTitle: string;
  metaDescription: string;
  keywords: string[];
  icon: string;
  status: "ativo" | "em-breve";
}

/**
 * Ferramentas já publicadas da categoria, cada uma com página própria e
 * componente real (nenhuma entrada aqui deve existir sem uma rota
 * funcional correspondente em app/instagram/*).
 */
export const instagramTools: InstagramTool[] = [
  {
    id: "criador-post-instagram",
    name: "Criador de Posts para Instagram Grátis",
    shortName: "Criador de Posts",
    path: "/instagram/criar-post",
    description:
      "Monte posts para Instagram direto do navegador: escolha um template, personalize textos, cores e fotos, e baixe em PNG ou JPG.",
    pageDescription:
      "Escolha um template, personalize textos, cores e fotos, e baixe sua arte pronta para publicar no Instagram — grátis, sem cadastro e sem enviar suas imagens para nenhum servidor.",
    metaTitle: "Criar Post para Instagram Grátis Online | ALILU",
    metaDescription:
      "Crie posts para Instagram gratuitamente. Escolha modelos, personalize textos, cores e fotos e baixe suas imagens em PNG ou JPG.",
    keywords: [
      "criador de post para instagram",
      "criar post instagram grátis",
      "gerador de post instagram",
      "template instagram grátis",
      "editor de imagem para instagram",
    ],
    icon: "image",
    status: "ativo",
  },
];

/**
 * Ferramentas planejadas para esta categoria, ainda sem implementação.
 * Exibidas apenas como texto informativo (roadmap), nunca como cards
 * clicáveis — evita links quebrados e evita anunciar como disponível algo
 * que ainda não existe.
 */
export interface PlannedInstagramTool {
  name: string;
  description: string;
  icon: string;
}

export const plannedInstagramTools: PlannedInstagramTool[] = [
  {
    name: "Criador de Carrosséis",
    description:
      "Monte sequências de slides para carrosséis do Instagram reaproveitando o mesmo editor de posts.",
    icon: "columns",
  },
  {
    name: "Gerador de Legendas",
    description:
      "Sugestões de legendas e hashtags para acompanhar os posts criados aqui.",
    icon: "type",
  },
  {
    name: "Criador de Capas para Reels",
    description: "Capas verticais chamativas para vídeos e Reels.",
    icon: "image",
  },
  {
    name: "Redimensionador para Instagram",
    description:
      "Ajuste qualquer imagem para os formatos ideais de post, story e perfil.",
    icon: "scissors",
  },
  {
    name: "Calendário de Publicações",
    description: "Organize datas e temas dos próximos posts.",
    icon: "calendar",
  },
];

export function getInstagramToolByPath(path: string): InstagramTool | undefined {
  return instagramTools.find((tool) => tool.path === path);
}
