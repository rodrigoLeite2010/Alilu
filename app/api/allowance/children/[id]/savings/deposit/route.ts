import { route, readBody } from "@/lib/allowance/backend/route-helpers";
import { depositSavings } from "@/lib/allowance/backend/allowance-service";

export const dynamic = "force-dynamic";

/** POST { amount, date?, description?, goalId? } — guardar no cofrinho. */
export const POST = route<{ id: string }>(async ({ userId, params, request }) => depositSavings(userId, params.id, await readBody(request)), 201);
