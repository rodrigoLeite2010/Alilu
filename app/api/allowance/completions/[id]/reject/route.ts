import { route } from "@/lib/allowance/backend/route-helpers";
import { rejectCompletion } from "@/lib/allowance/backend/allowance-service";

export const dynamic = "force-dynamic";

/** POST — o responsável recusa a conclusão (nada é pago). */
export const POST = route<{ id: string }>(async ({ userId, params }) => {
  await rejectCompletion(userId, params.id);
  return { rejected: true };
});
