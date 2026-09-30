import { issueSignedToken } from "@vercel/blob";
import { handleUploadPresigned, type HandleUploadPresignedBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import {
  MAX_VIDEO_INPUT_BYTES,
  VIDEO_INPUT_CONTENT_TYPES,
  isVideoUploadPathnameAllowed,
} from "@/lib/videos/config";

/** Tempo de vida do token assinado — só precisa durar o tempo do navegador completar o PUT. */
const SIGNED_TOKEN_VALID_MS = 5 * 60 * 1000;

/**
 * Endpoint de "client upload" do Vercel Blob para a categoria "Vídeos"
 * (Fase A, editor de split-screen). Mesmo padrão técnico de
 * app/api/instagram/media/upload/route.ts (handleUploadPresigned +
 * issueSignedToken — o par certo para este projeto, que usa OIDC em vez de
 * um BLOB_READ_WRITE_TOKEN estático; ver o comentário longo naquele
 * arquivo para o porquê), mas **sem checagem de sessão**: esta ferramenta
 * é pública, sem cadastro, ao contrário do upload de mídia do Instagram.
 * Por ser pública, os limites de tamanho/tipo aqui vêm de
 * lib/videos/config.ts (mais conservadores que os do Instagram) em vez de
 * depender de um usuário autenticado para conter abuso.
 *
 * O arquivo em si nunca passa pelo corpo desta função — vai direto do
 * navegador para o Blob, contornando o limite de payload das Vercel
 * Functions (o mesmo motivo por trás do upload de mídia do Instagram).
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
      getSignedToken: async (pathname) => {
        if (!isVideoUploadPathnameAllowed(pathname)) {
          throw new Error("Caminho de upload inválido.");
        }

        const token = await issueSignedToken({
          pathname,
          operations: ["put"],
          allowedContentTypes: [...VIDEO_INPUT_CONTENT_TYPES],
          maximumSizeInBytes: MAX_VIDEO_INPUT_BYTES,
          validUntil: Date.now() + SIGNED_TOKEN_VALID_MS,
        });

        return {
          token,
          urlOptions: {
            allowedContentTypes: [...VIDEO_INPUT_CONTENT_TYPES],
            maximumSizeInBytes: MAX_VIDEO_INPUT_BYTES,
            addRandomSuffix: true,
          },
        };
      },
      onUploadCompleted: async () => {
        // Nada para persistir aqui: o upload de entrada não gera nenhum
        // registro (esta categoria não tem banco de dados nesta fase — ver
        // relatório). O arquivo já fica acessível pela própria URL pública
        // do blob, que o cliente recebe na resposta de uploadPresigned() e
        // envia depois para /api/videos/split-screen. Os blobs de entrada
        // são apagados pelo próprio processamento (sucesso ou erro).
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    console.error("[videos/upload] falha ao gerar token ou processar conclusão", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Não foi possível processar o upload." },
      { status: 400 },
    );
  }
}
