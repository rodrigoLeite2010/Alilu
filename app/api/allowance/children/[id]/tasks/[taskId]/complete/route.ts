import { route, readBody } from "@/lib/allowance/backend/route-helpers";
import { completeTask } from "@/lib/allowance/backend/allowance-service";

export const dynamic = "force-dynamic";

/** POST { approve?: boolean } — marca como concluída (aguarda aprovação) ou já aprova e paga. */
export const POST = route<{ id: string; taskId: string }>(async ({ userId, params, request }) => {
  const body = await readBody(request);
  return completeTask(userId, params.id, params.taskId, { approve: body.approve === true });
}, 201);
