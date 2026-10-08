import { route, readBody } from "@/lib/allowance/backend/route-helpers";
import { setAllowance } from "@/lib/allowance/backend/allowance-service";

export const dynamic = "force-dynamic";

/** PUT { monthlyAmount, paymentDay, carryOverBalance?, name?, active? } — cria/atualiza a mesada mensal. */
export const PUT = route<{ id: string }>(async ({ userId, params, request }) => setAllowance(userId, params.id, await readBody(request)));
