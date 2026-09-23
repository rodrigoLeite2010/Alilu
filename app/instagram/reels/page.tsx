import type { Metadata } from "next";
import { auth } from "@/auth";
import { Breadcrumbs } from "@/components/navigation/Breadcrumbs";
import { Container } from "@/components/ui/Container";
import { ReelsComposer } from "@/components/instagram/ReelsComposer";
import { buildPageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = buildPageMetadata({
  title: "Criar Reels para Instagram Online | ALILU",
  description:
    "Crie Reels para Instagram com upload de vídeo, legenda, hashtags, prévia e publicação ou agendamento pela conta conectada.",
  path: "/instagram/reels",
});

export default async function InstagramReelsPage() {
  const session = await auth();

  return (
    <Container className="py-8 sm:py-10">
      <Breadcrumbs
        items={[
          { name: "Início", path: "/" },
          { name: "Instagram", path: "/instagram" },
          { name: "Criar Reels", path: "/instagram/reels" },
        ]}
      />

      <div className="mb-6 max-w-2xl">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">
          Criar Reels
        </h1>
        <p className="mt-2 text-base text-zinc-600">
          Envie um vídeo, confira a prévia, escreva a legenda e publique ou agende pela sua conta conectada.
        </p>
      </div>

      <ReelsComposer userId={session?.user?.id ?? null} />
    </Container>
  );
}
