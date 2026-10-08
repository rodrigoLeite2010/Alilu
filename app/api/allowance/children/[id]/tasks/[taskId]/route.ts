import { route, readBody } from "@/lib/allowance/backend/route-helpers";
import { updateTaskSettings } from "@/lib/allowance/backend/allowance-service";

export const dynamic = "force-dynamic";

/** PATCH { name?, active?, repeatable?, hasReward?, rewardAmount? } */
export const PATCH = route<{ id: string; taskId: string }>(async ({ userId, params, request }) =>
  updateTaskSettings(userId, params.id, params.taskId, await readBody(request)),
);
