export const dynamic = "force-dynamic";
import { publicRoute } from "@/lib/secret-santa/backend/route-helpers";
import * as svc from "@/lib/secret-santa/backend/service";

type P = { token: string };
// Pré-visualização pública: não exige login e só devolve o que o convite pode mostrar.
export const GET = publicRoute<P>(({ userId, params }) => svc.getInvitePreview(params.token, userId));
