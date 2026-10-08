export const dynamic = "force-dynamic";
import { route } from "@/lib/secret-santa/backend/route-helpers";
import * as svc from "@/lib/secret-santa/backend/service";

type P = { id: string };
export const POST = route<P>(({ userId, params }) => svc.completeGroup(userId, params.id));
