const YOUTUBE_VIDEO_ID = "nQErXTIYTbM";
const YOUTUBE_VIDEO_TITLE = "Qual a probabilidade de ganhar na Lotofácil?";
const YOUTUBE_VIDEO_AUTHOR = "Matemática no Papel";

/**
 * Vídeo do YouTube pedido no Prompt 1 (item que ficou fora do MVP) — um
 * vídeo de terceiros explicando a probabilidade da Lotofácil, indicado
 * pelo usuário. Usa youtube-nocookie.com (modo de privacidade avançada do
 * próprio YouTube: não grava cookie de rastreamento antes de a pessoa dar
 * play) e carrega com `loading="lazy"`, sem nenhum script adicional.
 */
export function LotofacilVideo() {
  return (
    <div>
      <div className="aspect-video overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100">
        <iframe
          className="h-full w-full"
          src={`https://www.youtube-nocookie.com/embed/${YOUTUBE_VIDEO_ID}`}
          title={YOUTUBE_VIDEO_TITLE}
          loading="lazy"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      </div>
      <p className="mt-2 text-xs text-zinc-500">
        Vídeo: “{YOUTUBE_VIDEO_TITLE}”, por {YOUTUBE_VIDEO_AUTHOR} (YouTube).
      </p>
    </div>
  );
}
