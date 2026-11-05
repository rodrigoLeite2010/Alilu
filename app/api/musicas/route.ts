import { requireUserId } from "@/lib/auth/session";
import { library, musicAction, readSong } from "@/lib/music/store";
import { MusicError, record, requireValue, uuid } from "@/lib/music/validation";

async function handle(request: Request, method: "GET" | "POST") {
  const reply = (data: unknown, status = 200) => Response.json(data, {
    status, headers: { "Cache-Control": "private, no-store" },
  });
  const auth = await requireUserId();
  if ("response" in auth) return auth.response;
  try {
    const url = new URL(request.url);
    if (method === "GET") {
      const song = url.searchParams.get("song");
      return reply(song ? await readSong(auth.userId, uuid(song)) : await library(auth.userId));
    }
    requireValue(!request.headers.get("origin") || request.headers.get("origin") === url.origin, "Origem inválida.", 403);
    requireValue(request.headers.get("content-type")?.startsWith("application/json"), "Formato inválido.", 415);
    const reader = request.body?.getReader();
    requireValue(reader);
    let size = 0;
    const decoder = new TextDecoder();
    let body = "";
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        requireValue(size <= 300_000, "Dados grandes demais.", 413);
        body += decoder.decode(value, { stream: true });
      }
    } finally {
      await reader.cancel();
    }
    return reply(await musicAction(auth.userId, record(JSON.parse(body + decoder.decode()))));
  } catch (error) {
    if (error instanceof MusicError) return reply({ error: error.message }, error.status);
    if (error instanceof SyntaxError) return reply({ error: "JSON inválido." }, 400);
    console.error("music API", error instanceof Error ? error.name : "Unknown error");
    return reply({ error: "O módulo está indisponível no momento. Tente novamente." }, 500);
  }
}

export const GET = (request: Request) => handle(request, "GET");
export const POST = (request: Request) => handle(request, "POST");
