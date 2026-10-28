import "server-only";
import { auth } from "@/auth";
import { getAdminSession } from "@/lib/admin/admin-access";
import { PropertyError, UUID } from "./model";
import { quota } from "./repository";
import { getDb } from "@/lib/db/client";
export function checkOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const url = new URL(request.url);
  // Next can reconstruct an internal URL; Host preserves the browser-facing host.
  const host = request.headers.get("host") ?? url.host;
  const protocol =
    request.headers.get("x-forwarded-proto")?.split(",")[0].trim() ??
    url.protocol.slice(0, -1);
  let expected = "";
  try {
    if (["http", "https"].includes(protocol))
      expected = new URL(`${protocol}://${host}`).origin;
  } catch {
    /* Invalid host is rejected below. */
  }
  if (!origin || !expected || origin !== expected)
    throw new PropertyError("Origem inválida.", 403);
}
export async function identity(request: Request, admin = false) {
  checkOrigin(request);
  const user = admin
    ? (await getAdminSession())?.userId
    : (await auth())?.user?.id;
  if (!user)
    throw new PropertyError(
      admin ? "Acesso restrito." : "Entre na sua conta.",
      admin ? 403 : 401,
    );
  const [account] =
    await getDb()`select id from users where id=${user} and disabled_at is null`;
  if (!account) throw new PropertyError("Conta indisponível.", 403);
  await quota(`mutation:${user}`, 60);
  return user;
}
export function validId(id: string) {
  if (!UUID.test(id)) throw new PropertyError("Identificador inválido.", 404);
  return id;
}
export async function jsonBody(request: Request) {
  const buffer = await boundedBody(request, 64 * 1024);
  try {
    const parsed=JSON.parse(buffer.toString("utf8"));
    if(!parsed||typeof parsed!=="object"||Array.isArray(parsed))throw new PropertyError("Envie um objeto JSON.");
    return parsed;
  } catch {
    throw new PropertyError("JSON inválido.");
  }
}
export async function boundedBody(request: Request, max: number) {
  if (Number(request.headers.get("content-length")) > max)
    throw new PropertyError("Arquivo ou formulário acima do limite.", 413);
  const reader = request.body?.getReader();
  if (!reader) throw new PropertyError("Envie os dados.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel();
      throw new PropertyError("Arquivo ou formulário acima do limite.", 413);
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}
export function api(handler: (request: Request) => Promise<Response>) {
  return async (request: Request) => {
    try {
      const response = await handler(request);
      response.headers.set("Cache-Control", "no-store");
      return response;
    } catch (error) {
      let message = "Não foi possível concluir. Tente novamente.";
      let status = 500;
      if (error instanceof PropertyError) {
        message = error.message;
        status = error.status;
      } else if (
        error instanceof Error &&
        error.message.includes("property: ")
      ) {
        message = error.message.split("property: ")[1].split("\n")[0];
        status = 409;
      } else if ((error as { code?: string })?.code === "23505") {
        message = "Este anúncio já foi cadastrado.";
        status = 409;
      } else
        console.error("imoveis_request_failed", {
          name: error instanceof Error ? error.name : "unknown",
          code: (error as { code?: string })?.code,
        });
      return Response.json(
        { error: message },
        { status, headers: { "Cache-Control": "no-store" } },
      );
    }
  };
}
