import type { Metadata } from "next";
import { auth } from "@/auth";
import { SchedulingIntro } from "@/components/instagram/SchedulingIntro";
import { CarouselProject } from "@/components/carousel/CarouselProject";

export const metadata: Metadata = { title: "Editar carrossel", robots: { index: false, follow: false } };

export default async function CarouselProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <SchedulingIntro mode="login" returnPath={`/instagram/carrossel-inteligente/${id}`} />
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:py-10">
      <CarouselProject projectId={id} />
    </div>
  );
}
