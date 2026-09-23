import { issueSignedToken } from "@vercel/blob";
import { handleUploadPresigned, type HandleUploadPresignedBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  ALLOWED_UPLOAD_CONTENT_TYPES,
  IMAGE_MEDIA_CONTENT_TYPES,
  MAX_MEDIA_UPLOAD_BYTES,
  MAX_VIDEO_UPLOAD_BYTES,
  VIDEO_MEDIA_CONTENT_TYPES,
  buildMediaTokenPayload,
  isPathnameAllowedForUser,
  parseMediaTokenPayload,
} from "@/lib/instagram/backend/media-service";
import { insertInstagramMedia } from "@/lib/instagram/backend/media-repository";

/** Tempo de vida do token assinado de upload — só precisa durar o tempo do navegador completar o PUT. */
const SIGNED_TOKEN_VALID_MS = 5 * 60 * 1000;

/**
 * Endpoint de "client upload" do Vercel Blob (Fase 3, ETAPA de
 * armazenamento persistente). O arquivo em si NUNCA passa pelo corpo desta
 * função — vai direto do navegador para o Blob, contornando o limite de
 * 4.5 MB de payload das Vercel Functions.
 *
 * Usa o fluxo de URLs assinadas (`handleUploadPresigned` + `issueSignedToken`,
 * ambos de `@vercel/blob`), não o `handleUpload` clássico: nosso projeto
 * está conectado ao Blob store via OIDC (`BLOB_STORE_ID` +
 * `VERCEL_OIDC_TOKEN`, injetados automaticamente pela Vercel), sem um
 * `BLOB_READ_WRITE_TOKEN` estático — e `handleUpload` exige esse token
 * estático especificamente para assinar tokens de upload do navegador
 * (OIDC não é aceito por ele). `handleUploadPresigned` é a contraparte
 * pensada exatamente para isso: funciona com OIDC ou com token estático,
 * então não precisamos criar/gerenciar nenhum segredo novo. Verificado
 * contra a documentação atual da Vercel e contra o código-fonte instalado
 * de @vercel/blob@2.8.0 (22/09/2026) antes de trocar.
 *
 * Esta rota participa de duas conversas curtas em JSON:
 *
 * 1. getSignedToken — chamada síncrona dentro da MESMA requisição do
 *    navegador logado: aqui (e só aqui) checamos a sessão via `auth()`,
 *    porque é a única chamada que carrega os cookies do usuário. Emitimos
 *    um token assinado com escopo de escrita (`operations: ['put']`)
 *    restrito ao pathname do próprio usuário.
 * 2. onUploadCompleted — um webhook do próprio Vercel Blob para esta
 *    mesma URL, DEPOIS que o arquivo já foi recebido; não tem cookies de
 *    sessão nenhuma (por isso nunca chamamos `auth()` aqui), só o
 *    `tokenPayload` que nós mesmos assinamos no passo 1. A assinatura do
 *    webhook é verificada com `BLOB_WEBHOOK_PUBLIC_KEY`.
 *
 * Aceita JPEG para posts/carrosséis e MP4/MOV para Reels. O upload segue
 * direto ao Blob; arquivo grande nunca atravessa a Vercel Function.
 */
export async function POST(request: Request): Promise<NextResponse> {
  let body: HandleUploadPresignedBody;
  try {
    body = (await request.json()) as HandleUploadPresignedBody;
  } catch {
    return NextResponse.json({ error: "Corpo da requisição inválido." }, { status: 400 });
  }

  try {
    const jsonResponse = await handleUploadPresigned({
      body,
      request,
      getSignedToken: async (pathname, clientPayload) => {
        const session = await auth();
        const userId = session?.user?.id;
        if (!userId) {
          throw new Error("Não autenticado.");
        }
        if (!isPathnameAllowedForUser(pathname, userId)) {
          throw new Error("Caminho de upload inválido.");
        }

        const tokenPayload = buildMediaTokenPayload(userId, clientPayload);
        const parsedPayload = parseMediaTokenPayload(tokenPayload);
        const isVideoUpload = VIDEO_MEDIA_CONTENT_TYPES.includes(parsedPayload?.contentType ?? "");
        const allowedContentTypes = isVideoUpload ? ALLOWED_UPLOAD_CONTENT_TYPES : IMAGE_MEDIA_CONTENT_TYPES;
        const token = await issueSignedToken({
          pathname,
          operations: ["put"],
          allowedContentTypes,
          maximumSizeInBytes: isVideoUpload ? MAX_VIDEO_UPLOAD_BYTES : MAX_MEDIA_UPLOAD_BYTES,
          validUntil: Date.now() + SIGNED_TOKEN_VALID_MS,
        });

        return {
          token,
          urlOptions: {
            allowedContentTypes,
            maximumSizeInBytes: isVideoUpload ? MAX_VIDEO_UPLOAD_BYTES : MAX_MEDIA_UPLOAD_BYTES,
            addRandomSuffix: true,
            tokenPayload,
          },
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        const parsed = parseMediaTokenPayload(tokenPayload);
        if (!parsed) {
          // Não deveria acontecer com o nosso próprio cliente — registra e
          // sai sem gravar nada, em vez de lançar (o Blob tentaria de novo
          // 5 vezes por um erro que nunca vai se resolver sozinho).
          console.error("[instagram/media/upload] tokenPayload inválido no callback de conclusão");
          return;
        }

        const filename = parsed.originalFilename?.toLowerCase() ?? "";
        const inferredContentType =
          parsed.contentType ??
          (filename.endsWith(".jpg") || filename.endsWith(".jpeg") || filename.endsWith(".png")
            ? "image/jpeg"
            : filename.endsWith(".mp4")
              ? "video/mp4"
              : filename.endsWith(".mov")
                ? "video/quicktime"
                : null);
        const mediaType = VIDEO_MEDIA_CONTENT_TYPES.includes(inferredContentType ?? "")
          ? "video"
          : IMAGE_MEDIA_CONTENT_TYPES.includes(inferredContentType ?? "")
            ? "image"
            : null;
        if (!mediaType) {
          console.error("[instagram/media/upload] contentType ausente ou inválido no callback de conclusão");
          return;
        }

        await insertInstagramMedia({
          userId: parsed.userId,
          storageUrl: blob.url,
          mediaType,
          fileSizeBytes: parsed.fileSizeBytes,
          originalFilename: parsed.originalFilename,
        });
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    console.error("[instagram/media/upload] falha ao gerar token ou processar conclusão", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Não foi possível processar o upload." },
      { status: 400 },
    );
  }
}
