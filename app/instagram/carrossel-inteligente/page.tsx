import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/auth";
import { SchedulingIntro } from "@/components/instagram/SchedulingIntro";
import { CarouselHome } from "@/components/carousel/CarouselHome";

export const metadata: Metadata = {
  title: "Carrossel Inteligente",
  description: "Crie carrosséis de Instagram com pesquisa, gancho, roteiro, imagens e legenda — e publique ou agende.",
  robots: { index: false, follow: false },
};

export default async function CarouselHomePage() {
  const session = await auth();
  if (!session?.user?.id) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <SchedulingIntro mode="login" returnPath="/instagram/carrossel-inteligente" />
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:py-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 sm:text-2xl">Carrossel Inteligente</h1>
          <p className="mt-1 text-sm text-zinc-600">Do tema à publicação: pesquisa, gancho, roteiro, visual e legenda — tudo no mesmo lugar.</p>
        </div>
        <Link href="/instagram/carrossel-inteligente/planos" className="text-sm font-medium text-brand-primary underline">Planos</Link>
      </div>
      <CarouselHome />
    </div>
  );
}
