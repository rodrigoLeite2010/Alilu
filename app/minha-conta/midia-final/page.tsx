import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/auth";
import { Container } from "@/components/ui/Container";
import { AccountLoginGate } from "@/components/conta/AccountLoginGate";
import { EndMediaSettingsManager } from "@/components/brand-end-media/EndMediaSettingsManager";
import { getEndMediaSummary } from "@/lib/brand-end-media/backend/end-media-service";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Mídia final padrão | Alilu", robots: { index: false, follow: false } };

/** Minha conta › Mídia final padrão: o encerramento que entra no fim de carrosséis, Reels e Split Screen. */
export default async function EndMediaSettingsPage() {
  const userId = (await auth())?.user?.id;
  const summary = userId ? await getEndMediaSummary(userId) : null;
  return (
    <Container className="max-w-3xl py-10 sm:py-14">
      <nav className="mb-4 text-sm text-zinc-500">
        <Link href="/minha-conta" className="hover:underline">
          Minha conta
        </Link>{" "}
        › Mídia final padrão
      </nav>
      <h1 className="text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">Mídia final padrão</h1>
      <p className="mt-2 text-base text-zinc-600">
        Configure uma vez o encerramento da sua marca (ex.: “Siga a nossa página”). Ele entra automaticamente no final dos
        carrosséis, Reels e vídeos do Split Screen — você pode desligar em cada publicação.
      </p>
      <div className="mt-8">
        {summary && userId ? <EndMediaSettingsManager userId={userId} initialSummary={summary} /> : <AccountLoginGate returnPath="/minha-conta/midia-final" />}
      </div>
    </Container>
  );
}
