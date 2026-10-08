import { route, readBody } from "@/lib/allowance/backend/route-helpers";
import { createChild, listChildrenOverview } from "@/lib/allowance/backend/allowance-service";

export const dynamic = "force-dynamic";

/** GET: crianças do usuário logado, com saldo/cofrinho calculados. POST { name, avatar?, birthDate? } */
export const GET = route(({ userId }) => listChildrenOverview(userId));
export const POST = route(async ({ userId, request }) => createChild(userId, await readBody(request)), 201);
