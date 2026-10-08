import { route, readBody } from "@/lib/allowance/backend/route-helpers";
import { registerIncome } from "@/lib/allowance/backend/allowance-service";

export const dynamic = "force-dynamic";

/** POST { amount, date?, description?, categoryId? } — entrada extra. */
export const POST = route<{ id: string }>(async ({ userId, params, request }) => registerIncome(userId, params.id, await readBody(request)), 201);
