import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  InstagramPostValidationError,
  cancelPost,
  reschedulePost,
} from "@/lib/instagram/backend/instagram-post-service";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * PATCH: ações de gerenciamento de um post do calendário editorial que não
 * são "publicar" (isso é POST /api/instagram/posts/[id]/publish, etapa
 * anterior). Corpo: `{ action: "cancel" }` ou `{ action: "reschedule",
 * scheduledAt: string | null }` (null remove o agendamento, voltando o
 * post para DRAFT). Sempre restrito ao dono do post — os serviços
 * chamados abaixo já filtram por `userId`.
 */
export async function PATCH(request: Request, { params }: RouteParams): Promise<NextResponse> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corpo da requisição inválido." }, { status: 400 });
  }
  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Corpo da requisição inválido." }, { status: 400 });
  }
  const { action } = body as { action?: unknown };

  try {
    if (action === "cancel") {
      await cancelPost(id, userId);
      return NextResponse.json({ status: "CANCELLED" });
    }

    if (action === "reschedule") {
      const { scheduledAt } = body as { scheduledAt?: unknown };
      if (scheduledAt !== null && typeof scheduledAt !== "string") {
        return NextResponse.json(
          { error: "scheduledAt precisa ser uma data em texto (ISO 8601) ou nulo." },
          { status: 400 },
        );
      }
      await reschedulePost(id, userId, scheduledAt);
      return NextResponse.json({ status: scheduledAt ? "SCHEDULED" : "DRAFT" });
    }

    return NextResponse.json({ error: "action precisa ser 'cancel' ou 'reschedule'." }, { status: 400 });
  } catch (error) {
    console.error("[instagram/posts/id] falha ao atualizar o post", error);
    const message =
      error instanceof InstagramPostValidationError ? error.message : "Não foi possível atualizar o post.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
