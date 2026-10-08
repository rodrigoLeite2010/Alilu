import { route, readBody } from "@/lib/allowance/backend/route-helpers";
import { updateCategory } from "@/lib/allowance/backend/allowance-service";

export const dynamic = "force-dynamic";

/** PATCH { name?, icon?, active?, sortOrder? } — só categorias próprias; nunca exclui (desativa). */
export const PATCH = route<{ id: string }>(async ({ userId, params, request }) => updateCategory(userId, params.id, await readBody(request)));
