import { route, readBody } from "@/lib/allowance/backend/route-helpers";
import { registerExpense } from "@/lib/allowance/backend/allowance-service";

export const dynamic = "force-dynamic";

/** POST { amount, date?, description?, categoryId? } — gasto (409 se o saldo não cobre). */
export const POST = route<{ id: string }>(async ({ userId, params, request }) => registerExpense(userId, params.id, await readBody(request)), 201);
