import { route, readBody } from "@/lib/allowance/backend/route-helpers";
import { createGoal } from "@/lib/allowance/backend/allowance-service";

export const dynamic = "force-dynamic";

/** POST { name, targetAmount, targetDate?, icon? } */
export const POST = route<{ id: string }>(async ({ userId, params, request }) => createGoal(userId, params.id, await readBody(request)), 201);
