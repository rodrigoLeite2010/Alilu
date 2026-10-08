export const dynamic = "force-dynamic";
import { route } from "@/lib/secret-santa/backend/route-helpers";
import * as svc from "@/lib/secret-santa/backend/service";

type P = { id: string };
export const GET = route<P>(({ userId, params }) => svc.getResults(userId, params.id));
export const POST = route<P>(({ userId, params }) => svc.revealGroup(userId, params.id));
