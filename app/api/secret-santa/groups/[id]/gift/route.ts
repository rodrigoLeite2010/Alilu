export const dynamic = "force-dynamic";
import { route, readBody } from "@/lib/secret-santa/backend/route-helpers";
import * as svc from "@/lib/secret-santa/backend/service";

type P = { id: string };
export const GET = route<P>(({ userId, params }) => svc.getMyGift(userId, params.id));
export const PUT = route<P>(async ({ userId, params, request }) => svc.saveMyGift(userId, params.id, await readBody(request)));
