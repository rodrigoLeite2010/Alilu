import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/auth";
import { Container } from "@/components/ui/Container";
import { AccountLoginGate } from "@/components/conta/AccountLoginGate";
import { ImportHistory } from "@/components/instagram-import/ImportHistory";
import { listImportsForUser } from "@/lib/instagram-import/backend/import-repository";
import { serializeImport } from "@/lib/instagram-import/backend/import-dto";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Importações do Instagram | Alilu", robots: { index: false, follow: false } };

/** Vídeos > Importações do Instagram (histórico). */
export default async function InstagramImportsHistoryPage() {
  const session = await auth();
  const userId = session?.user?.id;
  const imports = userId ? (await listImportsForUser(userId)).map(serializeImport) : [];
  return (
    <Container className="max-w-3xl py-6 sm:py-14">
      <nav className="mb-4 text-sm text-zinc-500">
        <Link href="/videos" className="hover:underline">
          Vídeos
        </Link>{" "}
        ›{" "}
        <Link href="/videos/importar-instagram" className="hover:underline">
          Importar do Instagram
        </Link>{" "}
        › Importações
      </nav>
      <h1 className="text-xl font-bold tracking-tight text-zinc-900 sm:text-3xl">Importações do Instagram</h1>
      <div className="mt-5 md:mt-8">{userId ? <ImportHistory initialImports={imports} /> : <AccountLoginGate returnPath="/videos/importacoes-instagram" />}</div>
    </Container>
  );
}
