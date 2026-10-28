import { createHmac } from "node:crypto";
import { auth } from "@/auth";
import { getDb } from "@/lib/db/client";
import {
  api,
  checkOrigin,
  identity,
  jsonBody,
  validId,
} from "@/lib/imoveis/http";
import {
  activeContact,
  ownProperties,
  ownProperty,
  quota,
  saveProperty,
  transition,
} from "@/lib/imoveis/repository";
import { uploadImage, removeImage } from "@/lib/imoveis/images";
import { PropertyError, type Settings } from "@/lib/imoveis/model";
import { SITE_URL } from "@/lib/seo/site";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;
function parts(request: Request) {
  return new URL(request.url).pathname
    .replace(/^\/api\/imoveis\/?/, "")
    .split("/")
    .filter(Boolean);
}
function visitor(request: Request) {
  const secret = process.env.INSTAGRAM_TOKEN_ENCRYPTION_KEY;
  if (!secret)
    throw new PropertyError("Contato temporariamente indisponível.", 503);
  return createHmac("sha256", secret)
    .update(
      `${new Date().toISOString().slice(0, 10)}:${request.headers.get("x-forwarded-for")?.split(",")[0] ?? "local"}`,
    )
    .digest("hex");
}
export const GET = api(async (request) => {
  const path = parts(request),
    user = (await auth())?.user?.id;
  if (!user) throw new PropertyError("Entre na sua conta.", 401);
  if (path[0] === "meus-anuncios")
    return Response.json({ items: await ownProperties(user) });
  if (path.length === 1)
    return Response.json(await ownProperty(user, validId(path[0])));
  throw new PropertyError("Rota não encontrada.", 404);
});
export const POST = api(async (request) => {
  const path = parts(request),
    db = getDb();
  if (path.length === 2 && ["view", "contact"].includes(path[1])) {
    checkOrigin(request);
    const id = validId(path[0]),
      key = visitor(request);
    await quota(`public:${key}`, 60);
    const contact = await activeContact(id);
    const event =
      await db`insert into property_rate_limits(key) values(${`${path[1]}:${id}:${key}`}) on conflict do nothing returning key`;
    if (event.length) {
      if (path[1] === "view")
        await db`update properties set views=views+1 where id=${id} and status='published'`;
      else
        await db`update properties set contacts=contacts+1 where id=${id} and status='published'`;
    }
    if (path[1] === "view") return Response.json({ ok: true });
    const message = `Olá! Vi seu imóvel anunciado na Alilu e gostaria de saber mais informações. Segue o link: ${SITE_URL}/imoveis/${contact.slug}.`;
    return Response.json({
      url: `https://wa.me/${contact.phone}?text=${encodeURIComponent(message)}`,
    });
  }
  const user = await identity(request);
  if (path.length === 0) {
    await quota(`create:${user}`, 10, 3600);
    return Response.json(
      { id: await saveProperty(user, await jsonBody(request)) },
      { status: 201 },
    );
  }
  if (path[0] === "photos" && path.length === 1) {
    await quota(`upload:${user}`, 100, 3600);
    return Response.json(await uploadImage(request, user), { status: 201 });
  }
  const id = validId(path[0]);
  if (path[1] === "status") {
    const body = await jsonBody(request);
    await transition(user, id, String(body.status));
    return Response.json({ ok: true });
  }
  if (path[1] === "favorite") {
    const body = await jsonBody(request);
    if (body.saved === false)
      await db`delete from property_favorites where user_id=${user} and property_id=${id}`;
    else
      await db`insert into property_favorites(user_id,property_id) select ${user},id from properties where id=${id} and status='published' on conflict do nothing`;
    return Response.json({ ok: true });
  }
  if (path[1] === "report") {
    await quota(`report:${user}`, 5, 3600);
    const body = await jsonBody(request);
    const reason = typeof body.reason === "string" ? body.reason.trim() : "";
    if (reason.length < 10 || reason.length > 1000)
      throw new PropertyError("Descreva a denúncia em 10 a 1.000 caracteres.");
    await db`insert into property_reports(user_id,property_id,reason) select ${user},id,${reason} from properties where id=${id} and status in ('published','sold','rented') on conflict(user_id,property_id) do update set reason=excluded.reason,resolved=false`;
    return Response.json({ ok: true });
  }
  throw new PropertyError("Rota não encontrada.", 404);
});
export const PATCH = api(async (request) => {
  const user = await identity(request),
    path = parts(request);
  if (path.length !== 1) throw new PropertyError("Rota não encontrada.", 404);
  return Response.json({
    id: await saveProperty(user, await jsonBody(request), validId(path[0])),
  });
});
export const DELETE = api(async (request) => {
  const user = await identity(request),
    path = parts(request);
  if (path[0] === "photos" && path.length === 2)
    await removeImage(user, validId(path[1]));
  else if (path.length === 1)
    await transition(user, validId(path[0]), "removed");
  else throw new PropertyError("Rota não encontrada.", 404);
  return Response.json({ ok: true });
});
export const PUT = api(async (request) => {
  const user = await identity(request, true),
    path = parts(request),
    body = await jsonBody(request),
    db = getDb();
  if (path[0] !== "admin") throw new PropertyError("Rota não encontrada.", 404);
  if (path[1] === "settings") {
    const config: Settings = {
      maxListings: Number(body.maxListings),
      maxPhotos: Number(body.maxPhotos),
      storageMB: Number(body.storageMB),
      types: body.types,
      features: body.features,
    };
    if (
      !Number.isInteger(config.maxListings) ||
      config.maxListings < 1 ||
      config.maxListings > 200 ||
      !Number.isInteger(config.maxPhotos) ||
      config.maxPhotos < 1 ||
      config.maxPhotos > 20 ||
      !Number.isInteger(config.storageMB) ||
      config.storageMB < 10 ||
      config.storageMB > 10000
    )
      throw new PropertyError(
        "Limites inválidos. São permitidas até 20 fotos por anúncio.",
      );
    for (const list of [config.types, config.features])
      if (
        !Array.isArray(list) ||
        !list.length ||
        list.length > 40 ||
        list.some((v) => typeof v !== "string" || !v.trim() || v.length > 60) ||
        new Set(list).size !== list.length
      )
        throw new PropertyError("Confira os tipos e características.");
    await db`update property_settings set config=${JSON.stringify(config)}::jsonb where id=1`;
  } else if (path[1] === "suspend") {
    const target = validId(String(body.userId));
    await db`insert into property_advertisers(user_id,suspended) values(${target},${body.suspended === true}) on conflict(user_id) do update set suspended=excluded.suspended`;
  } else if (path[1] === "report")
    await db`update property_reports set resolved=true where id=${validId(String(body.id))}`;
  else {
    const reason = String(body.reason ?? "")
      .trim()
      .slice(0, 500);
    if (!Number.isInteger(body.revision) || body.revision < 1)
      throw new PropertyError("Atualize o anúncio antes de moderar.");
    if (["rejected", "removed"].includes(body.status) && reason.length < 3)
      throw new PropertyError("Informe o motivo da moderação.");
    await transition(
      user,
      validId(path[1]),
      String(body.status),
      true,
      reason,
      body.revision,
    );
  }
  return Response.json({ ok: true });
});
