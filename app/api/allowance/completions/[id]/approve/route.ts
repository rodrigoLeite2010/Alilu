import { route } from "@/lib/allowance/backend/route-helpers";
import { approveCompletion } from "@/lib/allowance/backend/allowance-service";

export const dynamic = "force-dynamic";

/** POST — o responsável aprova; só aqui a recompensa vira dinheiro (uma única vez). */
export const POST = route<{ id: string }>(({ userId, params }) => approveCompletion(userId, params.id));
