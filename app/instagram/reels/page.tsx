import type { Metadata } from "next";
import { auth } from "@/auth";
import { Breadcrumbs } from "@/components/navigation/Breadcrumbs";
import { Container } from "@/components/ui/Container";
import { ReelsComposer } from "@/components/instagram/ReelsComposer";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { getInstagramAccountForUser } from "@/lib/instagram/backend/instagram-account-repository";

export const metadata: Metadata = buildPageMetadata({
  title: "Criar Reels para Instagram Online | ALILU",
  description:
    "Crie Reels para Instagram com upload de vídeo, legenda, hashtags, prévia e publicação ou agendamento pela conta conectada.",
  path: "/instagram/reels",
});

export default async function InstagramReelsPage() {
  const session = await auth();
  const userId = session?.user?.id ?? null;
  let account: { connected: boolean; username: string | null } | null = null;
  if (userId) {
    try {
      const record = await getInstagramAccountForUser(userId);
      account = { connected: Boolean(record && record.status === "connected"), username: record?.igUsername ?? null };
    } catch {
      account = null; // banco indisponível: o próprio envio mostra o erro
    }
  }

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
          Envie um vídeo, confira a prévia, escreva a legenda e publique agora ou agende no seu Instagram. Você só entra e
          conecta a conta na hora de publicar.
        </p>
      </div>

      <ReelsComposer
        userId={userId}
        instagramConnected={account?.connected ?? null}
        igUsername={account?.username ?? null}
      />
    </Container>
  );
}
