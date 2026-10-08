export const dynamic = "force-dynamic";
import { route } from "@/lib/secret-santa/backend/route-helpers";
import * as svc from "@/lib/secret-santa/backend/service";

export const GET = route(({ userId }) => svc.getNotifications(userId));
export const POST = route(({ userId }) => svc.readNotifications(userId));
