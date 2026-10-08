import { route, readBody } from "@/lib/allowance/backend/route-helpers";
import { updateGoalStatus } from "@/lib/allowance/backend/allowance-service";

export const dynamic = "force-dynamic";

/** PATCH { name?, targetAmount?, status? } */
export const PATCH = route<{ id: string; goalId: string }>(async ({ userId, params, request }) =>
  updateGoalStatus(userId, params.id, params.goalId, await readBody(request)),
);
