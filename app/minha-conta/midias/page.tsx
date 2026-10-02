import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/auth";
import { Container } from "@/components/ui/Container";
import { AccountLoginGate } from "@/components/conta/AccountLoginGate";
import { MyMediaManager, type MyMediaItem } from "@/components/storage-cleanup/MyMediaManager";
import { listMediaForUser } from "@/lib/instagram/backend/media-repository";
import { listGenerationsForUser } from "@/lib/ai-video/backend/generation-repository";
import { listImportsForUser } from "@/lib/instagram-import/backend/import-repository";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Minhas mídias | Alilu", robots: { index: false, follow: false } };

/** Minha conta › Minhas mídias: tudo o que o usuário guardou no Alilu, com "Excluir mídia" (apaga também o arquivo). */
export default async function MyMediaPage() {
  const session = await auth();
  const userId = session?.user?.id;
  let items: MyMediaItem[] = [];
  if (userId) {
    const [library, videos, imports] = await Promise.all([
      listMediaForUser(userId, undefined, 300),
      listGenerationsForUser(userId, 100),
      listImportsForUser(userId, 100),
    ]);
    items = [
      ...library.map((media) => ({
        id: media.id,
        kind: "library" as const,
        mediaType: media.mediaType === "video" ? ("VIDEO" as const) : ("IMAGE" as const),
        url: media.storageUrl,
        name: media.originalFilename,
        sizeBytes: media.fileSizeBytes,
        createdAt: media.createdAt.toISOString(),
        expiresAt: null,
      })),
      ...videos
        .filter((generation) => generation.storageVideoUrl)
        .map((generation) => ({
          id: generation.id,
          kind: "ai-video" as const,
          mediaType: "VIDEO" as const,
          url: generation.storageVideoUrl!,
          name: generation.prompt.slice(0, 80),
          sizeBytes: null,
          createdAt: generation.createdAt.toISOString(),
          expiresAt: generation.expiresAt ? generation.expiresAt.toISOString() : null,
        })),
      ...imports
        .filter((item) => item.status === "COMPLETED" && item.importedFileUrl)
        .map((item) => ({
          id: item.id,
          kind: "import" as const,
          mediaType: item.mediaType ?? ("VIDEO" as const),
          url: item.importedFileUrl!,
          name: item.urlKind === "manual" ? "Upload manual" : item.normalizedUrl.replace("https://www.", ""),
          sizeBytes: item.fileSizeBytes,
          createdAt: item.createdAt.toISOString(),
          expiresAt: null,
        })),
    ];
  }
  return (
    <Container className="max-w-4xl py-10 sm:py-14">
      <nav className="mb-4 text-sm text-zinc-500">
        <Link href="/minha-conta" className="hover:underline">
          Minha conta
        </Link>{" "}
        › Minhas mídias
      </nav>
      <h1 className="text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">Minhas mídias</h1>
      <p className="mt-2 text-base text-zinc-600">
        Imagens e vídeos guardados no Alilu. Ao excluir, o arquivo é apagado de verdade do armazenamento.
      </p>
      <div className="mt-8">{userId ? <MyMediaManager initialItems={items} /> : <AccountLoginGate returnPath="/minha-conta/midias" />}</div>
    </Container>
  );
}
