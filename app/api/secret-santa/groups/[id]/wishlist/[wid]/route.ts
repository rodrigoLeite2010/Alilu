export const dynamic = "force-dynamic";
import { route, readBody } from "@/lib/secret-santa/backend/route-helpers";
import * as svc from "@/lib/secret-santa/backend/service";

type P = { id: string; wid: string };
export const PATCH = route<P>(async ({ userId, params, request }) => {
  const body = await readBody(request);
  // "comprado": só quem tirou a pessoa (o serviço confere a atribuição)
  if (typeof body.purchased === "boolean" && Object.keys(body).length === 1) return svc.setWishPurchased(userId, params.id, params.wid, body.purchased);
  return svc.updateWish(userId, params.id, params.wid, body);
});
export const DELETE = route<P>(({ userId, params }) => svc.deleteWish(userId, params.id, params.wid));
