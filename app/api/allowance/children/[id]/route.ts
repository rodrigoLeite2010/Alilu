import { route, readBody } from "@/lib/allowance/backend/route-helpers";
import { getChildDashboard, updateChildSettings } from "@/lib/allowance/backend/allowance-service";

export const dynamic = "force-dynamic";

/** GET: painel da criança. PATCH { name?, avatar?, allowNegativeBalance?, weeklyLimit?, active? } */
export const GET = route<{ id: string }>(({ userId, params }) => getChildDashboard(userId, params.id));
export const PATCH = route<{ id: string }>(async ({ userId, params, request }) => updateChildSettings(userId, params.id, await readBody(request)));
