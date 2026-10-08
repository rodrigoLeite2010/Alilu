export const dynamic = "force-dynamic";
import { route } from "@/lib/secret-santa/backend/route-helpers";
import * as svc from "@/lib/secret-santa/backend/service";

type P = { token: string };
export const POST = route<P>(({ userId, params }) => svc.acceptInvite(userId, params.token));
