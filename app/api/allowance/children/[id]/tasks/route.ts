import { route, readBody } from "@/lib/allowance/backend/route-helpers";
import { createTask, listTasksFor } from "@/lib/allowance/backend/allowance-service";

export const dynamic = "force-dynamic";

/** GET: tarefas. POST { name, description?, hasReward, rewardAmount?, repeatable? } */
export const GET = route<{ id: string }>(({ userId, params }) => listTasksFor(userId, params.id));
export const POST = route<{ id: string }>(async ({ userId, params, request }) => createTask(userId, params.id, await readBody(request)), 201);
