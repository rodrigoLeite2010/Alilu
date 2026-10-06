import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/auth";
import { Container } from "@/components/ui/Container";
import { AccountLoginGate } from "@/components/conta/AccountLoginGate";
import { AiVideoGenerator } from "@/components/ai-video/AiVideoGenerator";
import { getWalletWithWelcomeBonus, listGenerationOptions } from "@/lib/ai-video/backend/generation-service";
import { getDraft, listGenerationsForUser } from "@/lib/ai-video/backend/generation-repository";
import { serializeGenerationForUser } from "@/lib/ai-video/backend/ai-video-dto";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Animar imagem com IA — transforme uma foto em vídeo | Alilu",
  description:
    "Envie uma imagem, descreva o movimento e gere um vídeo curto com inteligência artificial, pronto para Reels, Stories e TikTok.",
  robots: { index: false, follow: false },
};

/** Vídeos > Imagem para vídeo com IA (ferramenta paga com créditos Alilu). */
export default async function ImageToVideoPage() {
  const session = await auth();
  const userId = session?.user?.id;

  return (
    <Container className="max-w-3xl py-6 sm:py-14">
      <nav className="mb-4 text-sm text-zinc-500">
        <Link href="/videos" className="hover:underline">
          Vídeos
        </Link>{" "}
        › Imagem para vídeo com IA
      </nav>
      <h1 className="text-xl font-bold tracking-tight text-zinc-900 sm:text-3xl">Animar imagem com IA</h1>
      <p className="mt-2 text-sm text-zinc-600 sm:text-base">
        Envie uma foto, descreva o movimento e receba um vídeo curto em MP4 — pronto para Reels, Stories e TikTok. Cada
        geração usa créditos Alilu; você ganha créditos de boas-vindas para testar.
      </p>
      <div className="mt-5 md:mt-8">{userId ? <GeneratorSection userId={userId} /> : <AccountLoginGate returnPath="/videos/imagem-para-video" />}</div>
    </Container>
  );
}

async function GeneratorSection({ userId }: { userId: string }) {
  const [wallet, options, generations, draft] = await Promise.all([
    getWalletWithWelcomeBonus(userId),
    listGenerationOptions(),
    listGenerationsForUser(userId),
    getDraft(userId),
  ]);
  if (options.length === 0) {
    return <p className="rounded-md border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-600">A geração de vídeos está temporariamente indisponível.</p>;
  }
  return (
    <AiVideoGenerator
      userId={userId}
      initialAvailable={wallet.available}
      options={options}
      initialGenerations={generations.map(serializeGenerationForUser)}
      draft={draft}
    />
  );
}
