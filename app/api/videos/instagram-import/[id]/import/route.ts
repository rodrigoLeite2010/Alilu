import { NextResponse } from "next/server";
import { importResolvedMedia } from "@/lib/instagram-import/backend/import-service";
import { serializeImport } from "@/lib/instagram-import/backend/import-dto";
import { errorResponse, readJson, requireUserId } from "@/lib/instagram-import/backend/route-helpers";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** POST { itemIndex? }: "Importar para o Alilu" — baixa, valida e guarda no storage do Alilu. */
export async function POST(request: Request, { params }: RouteParams): Promise<NextResponse> {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const { id } = await params;
  const body = (await readJson(request)) ?? {};
  try {
    const record = await importResolvedMedia(userId, id, { itemIndex: body.itemIndex });
    return NextResponse.json({ import: serializeImport(record) });
  } catch (error) {
    return errorResponse(error, "import.crash");
  }
}
