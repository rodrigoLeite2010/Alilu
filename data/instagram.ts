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
    "Crie posts, carrosséis e Reels. Publique diretamente ou agende suas publicações.",
  description:
    "Crie posts, carrosséis e Reels para Instagram. Edite modelos, personalize textos e prepare publicações diretas ou agendadas.",
  metaTitle: "Ferramentas para Instagram Grátis | ALILU",
  metaDescription:
    "Crie posts, carrosséis e legendas para Instagram gratuitamente. Personalize modelos, edite textos e prepare conteúdos para suas redes sociais.",
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
  {
    id: "criador-carrossel-instagram",
    name: "Criador de Carrossel para Instagram Grátis",
    shortName: "Criador de Carrosséis",
    path: "/instagram/carrossel",
    description:
      "Monte carrosséis para Instagram com vários slides: edite cada um no mesmo editor do Criador de Posts, reordene e baixe tudo em um ZIP.",
    pageDescription:
      "Crie sequências de slides para carrossel, edite cada um separadamente, reordene por arraste e baixe todas as imagens em um único arquivo ZIP — grátis, sem cadastro e sem enviar suas imagens para nenhum servidor.",
    metaTitle: "Criar Carrossel para Instagram Grátis Online | ALILU",
    metaDescription:
      "Crie carrosséis para Instagram gratuitamente. Edite slides, organize a sequência e baixe todas as imagens em ZIP.",
    keywords: [
      "criador de carrossel para instagram",
      "criar carrossel instagram grátis",
      "gerador de carrossel instagram",
      "template carrossel instagram",
      "carrossel instagram online",
    ],
    icon: "columns",
    status: "ativo",
  },
  {
    id: "criador-reels-instagram",
    name: "Criador de Reels para Instagram",
    shortName: "Criador de Reels",
    path: "/instagram/reels",
    description:
      "Envie um vídeo vertical, escreva a legenda, confira a prévia e prepare um Reel para publicar agora ou agendar.",
    pageDescription:
      "Crie Reels a partir de um vídeo seu, com legenda, hashtags, prévia e publicação pela conta Instagram conectada.",
    metaTitle: "Criar Reels para Instagram Online | ALILU",
    metaDescription:
      "Crie Reels para Instagram com upload de vídeo, legenda, hashtags, prévia e publicação ou agendamento pela conta conectada.",
    keywords: [
      "criar reels instagram",
      "publicar reels instagram",
      "agendar reels instagram",
      "editor de reels online",
    ],
    icon: "video",
    status: "ativo",
  },
  {
    id: "gerador-legendas-instagram",
    name: "Gerador de Legendas para Instagram Grátis",
    shortName: "Gerador de Legendas",
    path: "/instagram/legendas",
    description:
      "Monte legendas para Instagram a partir de modelos prontos: escolha o tipo de conteúdo, o estilo e o tamanho, e copie o texto pronto para editar.",
    pageDescription:
      "Escolha modelos, personalize o estilo e copie textos prontos para editar — grátis, sem cadastro e sem nenhuma promessa de geração por inteligência artificial.",
    metaTitle: "Gerador de Legendas para Instagram Grátis | ALILU",
    metaDescription:
      "Crie legendas para Instagram gratuitamente. Escolha modelos, personalize o estilo e copie textos prontos para editar.",
    keywords: [
      "gerador de legendas para instagram",
      "legenda para instagram grátis",
      "criar legenda instagram",
      "frases para instagram",
      "hashtags para instagram",
    ],
    icon: "type",
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
