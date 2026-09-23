import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  InstagramPostValidationError,
  cancelPost,
  deletePost,
  getPostDetails,
  reschedulePost,
  updatePost,
} from "@/lib/instagram/backend/instagram-post-service";
import { readPostExtraFields } from "@/lib/instagram/backend/post-request";

const MAX_CAPTION_LENGTH = 2200;

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** GET: detalhes de uma publicação do próprio usuário (tela de edição). Nunca devolve token. */
export async function GET(_request: Request, { params }: RouteParams): Promise<NextResponse> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  const { id } = await params;
  try {
    const post = await getPostDetails(id, userId);
    return NextResponse.json({ post });
  } catch (error) {
    if (error instanceof InstagramPostValidationError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    console.error("[instagram/posts/id] falha ao carregar a publicação");
    return NextResponse.json({ error: "Não foi possível carregar a publicação." }, { status: 500 });
  }
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
      const { scheduledAt, timezone } = body as { scheduledAt?: unknown; timezone?: unknown };
      if (scheduledAt !== null && typeof scheduledAt !== "string") {
        return NextResponse.json(
          { error: "scheduledAt precisa ser uma data em texto (ISO 8601) ou nulo." },
          { status: 400 },
        );
      }
      if (timezone !== undefined && timezone !== null && typeof timezone !== "string") {
        return NextResponse.json({ error: "timezone inválido." }, { status: 400 });
      }
      await reschedulePost(id, userId, scheduledAt, (timezone as string | null | undefined) ?? null);
      return NextResponse.json({ status: scheduledAt ? "SCHEDULED" : "DRAFT" });
    }

    if (action === "update") {
      const { caption, scheduledAt, mediaUrls } = body as {
        caption?: unknown;
        scheduledAt?: unknown;
        mediaUrls?: unknown;
      };
      if (caption !== undefined && (typeof caption !== "string" || caption.length > MAX_CAPTION_LENGTH)) {
        return NextResponse.json(
          { error: `A legenda precisa ser um texto de até ${MAX_CAPTION_LENGTH} caracteres.` },
          { status: 400 },
        );
      }
      if (scheduledAt !== undefined && scheduledAt !== null && typeof scheduledAt !== "string") {
        return NextResponse.json({ error: "scheduledAt precisa ser ISO 8601 com fuso, ou nulo." }, { status: 400 });
      }
      if (
        mediaUrls !== undefined &&
        (!Array.isArray(mediaUrls) || mediaUrls.some((url) => typeof url !== "string" || !url))
      ) {
        return NextResponse.json({ error: "mediaUrls precisa ser uma lista de URLs." }, { status: 400 });
      }
      const extra = readPostExtraFields(body as Record<string, unknown>);
      if ("error" in extra) {
        return NextResponse.json({ error: extra.error }, { status: 400 });
      }
      const result = await updatePost({
        postId: id,
        userId,
        caption: caption as string | undefined,
        scheduledAt: scheduledAt as string | null | undefined,
        mediaUrls: mediaUrls as string[] | undefined,
        timezone: extra.fields.timezone,
        templateId: extra.fields.templateId,
        templateData: extra.fields.templateData,
      });
      return NextResponse.json(result);
    }

    return NextResponse.json(
      { error: "action precisa ser 'cancel', 'reschedule' ou 'update'." },
      { status: 400 },
    );
  } catch (error) {
    console.error("[instagram/posts/id] falha ao atualizar o post", error);
    const message =
      error instanceof InstagramPostValidationError ? error.message : "Não foi possível atualizar o post.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(_request: Request, { params }: RouteParams): Promise<NextResponse> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { id } = await params;

  try {
    await deletePost(id, userId);
    return NextResponse.json({ status: "DELETED" });
  } catch (error) {
    console.error("[instagram/posts/id] falha ao excluir o post", error);
    const message =
      error instanceof InstagramPostValidationError ? error.message : "Não foi possível excluir a publicação.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
