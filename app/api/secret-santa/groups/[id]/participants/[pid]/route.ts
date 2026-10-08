export const dynamic = "force-dynamic";
import { route } from "@/lib/secret-santa/backend/route-helpers";
import * as svc from "@/lib/secret-santa/backend/service";

type P = { id: string; pid: string };
export const DELETE = route<P>(({ userId, params }) => svc.removeParticipant(userId, params.id, params.pid));
