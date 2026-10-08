import { route, readBody } from "@/lib/allowance/backend/route-helpers";
import { withdrawSavings } from "@/lib/allowance/backend/allowance-service";

export const dynamic = "force-dynamic";

/** POST { amount, date?, description?, goalId? } — retirar do cofrinho. */
export const POST = route<{ id: string }>(async ({ userId, params, request }) => withdrawSavings(userId, params.id, await readBody(request)), 201);
