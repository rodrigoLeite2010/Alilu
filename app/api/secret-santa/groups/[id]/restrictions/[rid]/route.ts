export const dynamic = "force-dynamic";
import { route } from "@/lib/secret-santa/backend/route-helpers";
import * as svc from "@/lib/secret-santa/backend/service";

type P = { id: string; rid: string };
export const DELETE = route<P>(({ userId, params }) => svc.removeRestriction(userId, params.id, params.rid));
