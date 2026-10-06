import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/auth";
import { Container } from "@/components/ui/Container";
import { AccountLoginGate } from "@/components/conta/AccountLoginGate";
import { InstagramImporter } from "@/components/instagram-import/InstagramImporter";
import { isAdminEmail } from "@/lib/admin/admin-access";
import { getInstagramImportQuota } from "@/lib/instagram-import/backend/import-service";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Importar do Instagram — Reels, vídeos e fotos públicos | Alilu",
  description: "Cole o link de um Reel, vídeo ou foto pública do Instagram e importe para editar no Alilu.",
  robots: { index: false, follow: false },
};

/** Vídeos > Importar do Instagram. */
export default async function InstagramImportPage() {
  const session = await auth();
  const userId = session?.user?.id;
  // Só o resultado (cota) vai para a tela — nunca o e-mail do administrador.
  const quota = userId ? await getInstagramImportQuota(userId, isAdminEmail(session?.user?.email)).catch(() => null) : null;
  return (
    <Container className="max-w-3xl py-6 sm:py-14">
      <nav className="mb-4 text-sm text-zinc-500">
        <Link href="/videos" className="hover:underline">
          Vídeos
        </Link>{" "}
        › Importar do Instagram
      </nav>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-xl font-bold tracking-tight text-zinc-900 sm:text-3xl">Importar do Instagram</h1>
        {userId ? (
          <Link href="/videos/importacoes-instagram" className="text-sm font-medium text-teal-800 hover:underline">
            Minhas importações
          </Link>
        ) : null}
      </div>
      <p className="mt-2 text-sm text-zinc-600 sm:text-base">Cole o link de um Reel, vídeo, foto ou conteúdo público do Instagram.</p>
      <div className="mt-5 md:mt-8">{userId ? <InstagramImporter userId={userId} initialQuota={quota} /> : <AccountLoginGate returnPath="/videos/importar-instagram" />}</div>
    </Container>
  );
}
