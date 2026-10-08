export const dynamic = "force-dynamic";
import { route, readBody } from "@/lib/secret-santa/backend/route-helpers";
import * as svc from "@/lib/secret-santa/backend/service";

export const GET = route(({ userId }) => svc.listMyGroups(userId));
export const POST = route(async ({ userId, request }) => svc.createGroup(userId, await readBody(request)), 201);
