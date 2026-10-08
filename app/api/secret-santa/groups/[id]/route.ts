export const dynamic = "force-dynamic";
import { route, readBody } from "@/lib/secret-santa/backend/route-helpers";
import * as svc from "@/lib/secret-santa/backend/service";

type P = { id: string };
export const GET = route<P>(({ userId, params }) => svc.getGroupView(userId, params.id));
export const PATCH = route<P>(async ({ userId, params, request }) => svc.updateGroup(userId, params.id, await readBody(request)));
export const DELETE = route<P>(({ userId, params }) => svc.cancelGroup(userId, params.id));
