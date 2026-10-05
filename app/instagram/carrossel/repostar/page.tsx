import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/auth";
import { Container } from "@/components/ui/Container";
import { AccountLoginGate } from "@/components/conta/AccountLoginGate";
import { ConnectInstagramLink } from "@/components/instagram/ConnectInstagramLink";
import { CarouselRepost } from "@/components/instagram-import/CarouselRepost";
import { getImportForUser } from "@/lib/instagram-import/backend/import-repository";
import { serializeImport } from "@/lib/instagram-import/backend/import-dto";
import { getInstagramAccountForUser } from "@/lib/instagram/backend/instagram-account-repository";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Repostar carrossel | Alilu", robots: { index: false, follow: false } };

interface PageProps {
  searchParams: Promise<{ importacao?: string }>;
}

/** Perfil de origem a partir do link colado (/{perfil}/p/{código}), quando houver. */
function profileFromUrl(url: string): string | null {
  try {
    const segments = new URL(url).pathname.split("/").filter(Boolean);
    if (segments.length >= 3 && ["p", "reel", "reels", "tv"].includes(segments[1]) && /^[A-Za-z0-9._]{1,30}$/.test(segments[0])) return segments[0];
  } catch {
    // link inválido: sem perfil
  }
  return null;
}

/** Repostar um carrossel importado do Instagram (fotos e vídeos) — publicar agora ou agendar. */
export default async function CarouselRepostPage({ searchParams }: PageProps) {
  const { importacao } = await searchParams;
  const returnPath = `/instagram/carrossel/repostar${importacao ? `?importacao=${encodeURIComponent(importacao)}` : ""}`;
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return (
      <Container className="py-10 sm:py-14">
        <AccountLoginGate returnPath={returnPath} />
      </Container>
    );
  }

  const record = importacao && /^[0-9a-f-]{36}$/i.test(importacao) ? await getImportForUser(importacao, userId) : null;
  const account = await getInstagramAccountForUser(userId);
  const usable = record && record.status === "COMPLETED" && record.importedItems.length >= 2;

  return (
    <Container className="max-w-3xl py-8 sm:py-12">
      <nav className="mb-4 text-sm text-zinc-500">
        <Link href="/videos/importar-instagram" className="hover:underline">
          Importar do Instagram
        </Link>{" "}
        › Repostar carrossel
      </nav>
      <h1 className="text-2xl font-semibold text-zinc-900">Repostar carrossel</h1>
      <p className="mt-1 text-sm text-zinc-600">
        Organize as fotos e vídeos, escreva a legenda e publique agora ou agende. Use só conteúdo seu ou com autorização — e dê o crédito ao
        autor.
      </p>
      <div className="mt-6">
        {!usable ? (
          <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Carrossel não encontrado. Importe o carrossel completo em{" "}
            <Link href="/videos/importar-instagram" className="font-medium underline">
              Importar do Instagram
            </Link>{" "}
            e toque em “Repostar carrossel”.
          </p>
        ) : !account || account.status !== "connected" ? (
          <div className="space-y-3 rounded-lg border border-zinc-200 p-4">
            <p className="text-sm text-zinc-700">Conecte sua conta profissional do Instagram para publicar ou agendar o carrossel.</p>
            <ConnectInstagramLink returnTo={returnPath} />
          </div>
        ) : (
          <CarouselRepost importItem={serializeImport(record)} sourceProfile={profileFromUrl(record.originalUrl)} igUsername={account.igUsername} />
        )}
      </div>
    </Container>
  );
}
