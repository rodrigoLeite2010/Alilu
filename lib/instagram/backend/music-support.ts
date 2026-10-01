/**
 * Regras puras (sem banco, sem chamada à Meta) de "música padrão para
 * publicações": o que cada `MusicMode` resolve para, e se a API
 * atualmente usada pelo projeto ("Instagram API with Instagram Login",
 * graph.instagram.com — ver meta-graph-client.ts) tem como aplicar essa
 * música ao publicar. Mantido separado de instagram-publish-service.ts
 * (que faz a chamada de verdade) para poder ser testado sem mocks, e de
 * instagram-account-repository.ts/instagram-post-repository.ts (que só
 * leem/gravam — nenhuma regra de negócio ali).
 *
 * IMPORTANTE (checado antes de escrever este arquivo, nunca um parâmetro
 * inventado): a Content Publishing API do produto usado aqui não expõe
 * NENHUM parâmetro de áudio/música — nem para imagem, nem carrossel, nem
 * Reels, nem vídeo de feed (confirmado em developers.facebook.com/docs/
 * instagram-platform/content-publishing/, consultada em 28/09/2026). A
 * única API de música da Meta (`audio_configuration`, endpoint
 * /{ig-user-id}/media) só existe na "Instagram API with Facebook Login" —
 * um produto diferente do usado por este projeto — e mesmo lá só vale
 * para Reels (developers.facebook.com/docs/instagram-platform/
 * content-publishing/audio-api/). Por isso `resolveMusicApplication`
 * abaixo sempre devolve `applied: false` hoje, para qualquer tipo de
 * post — não é uma limitação de implementação, é uma limitação real da
 * API. Se a Meta passar a suportar isso no produto usado aqui, ou se o
 * Alilu ganhar uma etapa própria de mixagem de áudio em vídeo (só
 * tecnicamente possível para Reels — nunca transformando carrossel de
 * imagens em vídeo, ver nota em createContainerForPost), a mudança fica
 * concentrada neste arquivo.
 */

export type MusicMode = "ACCOUNT_DEFAULT" | "NONE" | "CUSTOM";
export type MusicType = "None" | "InstagramCatalog" | "CustomAudio";
export type InstagramPostTypeForMusic = "image" | "carousel" | "reels" | "story";

/** Configuração de música padrão da conta (instagram_accounts.default_music_*). */
export interface AccountDefaultMusic {
  enabled: boolean;
  type: MusicType;
  name: string | null;
  artist: string | null;
  externalId: string | null;
  url: string | null;
  audioFileUrl: string | null;
  audioFileName: string | null;
}

/** Música própria de uma publicação (instagram_posts.music_* — só usada quando musicMode === "CUSTOM"). */
export interface PostMusicOverride {
  type: MusicType;
  name: string | null;
  artist: string | null;
  externalId: string | null;
  url: string | null;
  audioFileUrl: string | null;
  audioFileName: string | null;
}

export interface ResolvedMusic {
  /** O que a publicação de fato pede: nenhuma música, a padrão da conta, ou uma escolhida só para este post. */
  requestedType: MusicType;
  name: string | null;
  artist: string | null;
  externalId: string | null;
  url: string | null;
  audioFileUrl: string | null;
  audioFileName: string | null;
}

const NO_MUSIC: ResolvedMusic = {
  requestedType: "None",
  name: null,
  artist: null,
  externalId: null,
  url: null,
  audioFileUrl: null,
  audioFileName: null,
};

/**
 * Resolve o que uma publicação efetivamente pede, combinando o
 * `musicMode` gravado no post com a música padrão da conta (lida NA HORA
 * de publicar — nunca uma cópia congelada no momento do agendamento, ver
 * comentário da migração 0011) ou com a escolha própria do post.
 */
export function resolveRequestedMusic(
  musicMode: MusicMode,
  accountDefault: AccountDefaultMusic | null,
  postOverride: PostMusicOverride | null,
): ResolvedMusic {
  if (musicMode === "NONE") return NO_MUSIC;

  if (musicMode === "CUSTOM") {
    if (!postOverride || postOverride.type === "None") return NO_MUSIC;
    return {
      requestedType: postOverride.type,
      name: postOverride.name,
      artist: postOverride.artist,
      externalId: postOverride.externalId,
      url: postOverride.url,
      audioFileUrl: postOverride.audioFileUrl,
      audioFileName: postOverride.audioFileName,
    };
  }

  // ACCOUNT_DEFAULT
  if (!accountDefault || !accountDefault.enabled || accountDefault.type === "None") return NO_MUSIC;
  return {
    requestedType: accountDefault.type,
    name: accountDefault.name,
    artist: accountDefault.artist,
    externalId: accountDefault.externalId,
    url: accountDefault.url,
    audioFileUrl: accountDefault.audioFileUrl,
    audioFileName: accountDefault.audioFileName,
  };
}

export interface MusicApplicationResult {
  applied: boolean;
  requestedType: MusicType;
  /** Motivo fixo (nunca conteúdo do usuário) — seguro para log, ver publication-log.ts. */
  reason: string | null;
}

const NOTHING_REQUESTED: MusicApplicationResult = { applied: false, requestedType: "None", reason: null };

/**
 * Decide se a música pedida pode ser aplicada de verdade ao publicar este
 * tipo de post, dada a API atualmente usada pelo projeto. Nunca lança —
 * quem chama sempre publica normalmente e só usa `reason` para logar/
 * exibir, nunca para bloquear a publicação (PROMPT: "nunca quebrar a
 * publicação atual").
 */
export function resolveMusicApplication(
  postType: InstagramPostTypeForMusic,
  requested: ResolvedMusic,
): MusicApplicationResult {
  if (requested.requestedType === "None") return NOTHING_REQUESTED;

  const mediaLabel =
    postType === "image" ? "imagem" : postType === "carousel" ? "carrossel" : postType === "story" ? "Story" : "Reel";

  if (requested.requestedType === "InstagramCatalog") {
    return {
      applied: false,
      requestedType: "InstagramCatalog",
      reason:
        `Música do catálogo do Instagram não pode ser adicionada automaticamente neste tipo de publicação ` +
        `(${mediaLabel}) pela API atual — a "Instagram API with Instagram Login" usada por este projeto não ` +
        `oferece esse recurso (só existe na "Instagram API with Facebook Login", e mesmo lá apenas para Reels).`,
    };
  }

  // CustomAudio: tecnicamente só faria sentido para um Reel (é o único
  // formato com vídeo), e mesmo assim exigiria uma etapa de mixagem de
  // áudio no vídeo que o Alilu ainda não tem (ver nota no topo do
  // arquivo) — nunca embutido automaticamente aqui. Imagem/carrossel
  // nunca suportam áudio (são mídia estática) — isso é uma limitação do
  // próprio Instagram, não da API.
  if (postType !== "reels") {
    return {
      applied: false,
      requestedType: "CustomAudio",
      reason:
        `Uma trilha própria não pode ser aplicada a uma publicação de ${mediaLabel} — o Instagram não reproduz ` +
        "áudio em imagens/carrosséis (isso não depende da API usada).",
    };
  }
  return {
    applied: false,
    requestedType: "CustomAudio",
    reason:
      "Uma trilha própria ainda não é aplicada automaticamente a Reels — o Alilu ainda não tem uma etapa de " +
      "mixagem de áudio no vídeo antes do envio (estrutura preparada; publicação segue sem a trilha).",
  };
}
