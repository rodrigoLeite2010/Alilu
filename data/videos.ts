/**
 * Catálogo da categoria "Vídeos".
 *
 * Mantido separado de data/categories.ts pelo mesmo motivo de
 * data/instagram.ts e data/lotteries.ts: esta categoria vive em uma URL
 * própria (/videos), fora de /utilitarios/[categoria]/[ferramenta] — mas
 * por um motivo ADICIONAL, específico desta categoria: toda ferramenta de
 * data/categories.ts é 100% client-side (a própria descrição de cada
 * categoria enfatiza "no navegador", "sem enviar ao servidor"); o editor
 * de vídeo ENVIA os dois arquivos ao servidor (Vercel Blob + FFmpeg), o
 * que quebraria essa promessa se vivesse no mesmo registro. Nome,
 * descrição e URLs ficam centralizados aqui — nenhum componente deve
 * duplicá-los.
 */

export const VIDEOS_CATEGORY = {
  id: "videos",
  name: "Vídeos",
  shortName: "Vídeos",
  path: "/videos",
  title: "Editor de Vídeo Split-Screen para Reels e Shorts",
  subtitle:
    "Combine dois vídeos MP4 em split-screen — um em cima, outro embaixo — e exporte pronto para Reels, Shorts e TikTok. Grátis e sem cadastro.",
  description:
    "Monte vídeos verticais em split-screen combinando um vídeo principal com um vídeo complementar (satisfatório), com corte, loop e controle de áudio.",
  metaTitle: "Editor de Vídeo Split-Screen Grátis (Reels, Shorts, TikTok) | ALILU",
  metaDescription:
    "Combine dois vídeos em split-screen — principal em cima, complementar embaixo — direto do navegador. Corte trechos, repita o complementar em loop e baixe em MP4. Grátis e sem cadastro.",
  icon: "film",
} as const;

export interface VideoTool {
  id: string;
  name: string;
  shortName: string;
  path: string;
  description: string;
  icon: string;
  status: "ativo" | "em-breve";
}

/**
 * Ferramentas já publicadas da categoria. Nesta fase (Fase A) só existe o
 * editor de split-screen — layouts adicionais (picture-in-picture, texto
 * sobreposto, etc.) ficam para uma fase futura (ver relatório da Fase A).
 */
export const videoTools: VideoTool[] = [
  {
    id: "editor-split-screen",
    name: "Editor de Vídeo Split-Screen",
    shortName: "Split-Screen",
    path: "/videos/editor-split-screen",
    description:
      "Combine um vídeo principal com um vídeo complementar em split-screen — corte trechos, repita o complementar em loop e escolha o áudio. Baixe pronto para Reels, Shorts e TikTok.",
    icon: "columns",
    status: "ativo",
  },
  {
    id: "imagem-para-video",
    name: "Imagem para Vídeo com IA",
    shortName: "Imagem → Vídeo IA",
    path: "/videos/imagem-para-video",
    description:
      "Envie uma imagem, descreva o movimento e gere um vídeo curto com IA (Runway). Usa Créditos de IA da Alilu — o custo aparece antes de gerar.",
    icon: "video",
    status: "ativo",
  },
  {
    id: "importar-instagram",
    name: "Importar do Instagram",
    shortName: "Importar do Instagram",
    path: "/videos/importar-instagram",
    description:
      "Cole o link de um Reel, vídeo ou foto pública do Instagram (seu ou com autorização) e importe para usar no Split-Screen, publicar no Reels ou baixar.",
    icon: "instagram",
    status: "ativo",
  },
];

export function getVideoToolByPath(path: string): VideoTool | undefined {
  return videoTools.find((tool) => tool.path === path);
}
