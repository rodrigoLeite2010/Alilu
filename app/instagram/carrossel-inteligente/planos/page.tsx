import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/auth";
import { CarouselPlans } from "@/components/carousel/CarouselPlans";

export const metadata: Metadata = {
  title: "Planos do Carrossel Inteligente",
  description: "Starter, Pro, Turbo e Agência: escolha quantos carrosséis criar por mês. 10% de desconto para clientes Alilu.",
  alternates: { canonical: "/instagram/carrossel-inteligente/planos" },
};

export default async function CarouselPlansPage() {
  const session = await auth();
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:py-10">
      <Link href="/instagram/carrossel-inteligente" className="text-sm font-medium text-brand-primary underline">← Carrossel Inteligente</Link>
      <h1 className="mt-3 text-xl font-semibold text-zinc-900 sm:text-2xl">Planos do Carrossel Inteligente</h1>
      <p className="mb-6 mt-1 max-w-2xl text-sm text-zinc-600">Assinatura separada do Piloto Automático. Cada carrossel concluído conta uma vez na cota do mês. Seu primeiro é grátis.</p>
      <CarouselPlans loggedIn={Boolean(session?.user?.id)} userName={session?.user?.name ?? ""} userEmail={session?.user?.email ?? ""} />
    </div>
  );
}
