/**
 * Catálogo de categorias e temas das Filas de vídeos (lógica pura, sem
 * banco — usado no servidor e na tela).
 *
 * Para acrescentar um jogo/tema novo basta incluir um item em `themes`; para
 * uma categoria nova, um item em VIDEO_QUEUE_CATEGORIES. O banco guarda só os
 * ids (video_queues.category / video_queues.theme), então nada precisa de
 * migração.
 *
 * Os textos padrão são deliberadamente neutros: nunca afirmam que um vídeo
 * é trailer oficial, vazamento ou notícia — quem publica descreve o conteúdo
 * real de cada vídeo no título/legenda.
 */

export interface VideoQueueTheme {
  id: string;
  name: string;
  description: string;
  /** Hashtags sugeridas para o tema (o usuário pode editar o template). */
  hashtags: string[];
}

export interface VideoQueueCategory {
  id: string;
  name: string;
  description: string;
  themes: VideoQueueTheme[];
}

export const VIDEO_QUEUE_CATEGORIES: VideoQueueCategory[] = [
  {
    id: "games",
    name: "Games",
    description: "Vídeos de jogos: gameplay, momentos, comparações e criações da comunidade.",
    themes: [
      {
        id: "gta-6",
        name: "GTA 6",
        description: "Grand Theft Auto VI — gameplay, trechos e conteúdo da comunidade.",
        hashtags: ["#GTA6", "#GTAVI", "#GrandTheftAuto", "#Games"],
      },
      {
        id: "gta-5",
        name: "GTA 5",
        description: "Grand Theft Auto V e GTA Online.",
        hashtags: ["#GTA5", "#GTAV", "#GTAOnline", "#Games"],
      },
      {
        id: "outros-jogos",
        name: "Outros jogos",
        description: "Qualquer outro jogo.",
        hashtags: ["#Games", "#Gamer", "#Gameplay"],
      },
    ],
  },
];

export const DEFAULT_VIDEO_QUEUE_CATEGORY = "games";
export const DEFAULT_VIDEO_QUEUE_THEME = "gta-6";

export function findCategory(categoryId: string | null | undefined): VideoQueueCategory | null {
  return VIDEO_QUEUE_CATEGORIES.find((category) => category.id === categoryId) ?? null;
}

export function findTheme(categoryId: string | null | undefined, themeId: string | null | undefined): VideoQueueTheme | null {
  return findCategory(categoryId)?.themes.find((theme) => theme.id === themeId) ?? null;
}

/** Template de legenda sugerido para um tema (editável na criação da fila). */
export function defaultCaptionTemplate(categoryId: string, themeId: string): string {
  const theme = findTheme(categoryId, themeId);
  const hashtags = theme?.hashtags.join(" ") ?? "";
  return ["{titulo}", "", "O que você achou? Conta aqui nos comentários 👇", "", hashtags].join("\n").trim();
}
