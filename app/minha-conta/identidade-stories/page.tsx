import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/auth";
import { Container } from "@/components/ui/Container";
import { AccountLoginGate } from "@/components/conta/AccountLoginGate";
import { StoryBrandManager } from "@/components/instagram/content-automation/StoryBrandManager";
import { getStoryBrandDto } from "@/lib/content-automation/backend/smart-story-brand-service";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Identidade dos Stories | Alilu", robots: { index: false, follow: false } };

/** Minha conta › Identidade dos Stories: logo, @, site, cor e mascote dos Stories inteligentes. */
export default async function StoryIdentityPage() {
  const userId = (await auth())?.user?.id;
  const profile = userId ? await getStoryBrandDto(userId) : null;
  return (
    <Container className="max-w-3xl py-10 sm:py-14">
      <nav className="mb-4 text-sm text-zinc-500">
        <Link href="/minha-conta" className="hover:underline">
          Minha conta
        </Link>{" "}
        › Identidade dos Stories
      </nav>
      <h1 className="text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">Identidade dos Stories</h1>
      <p className="mt-2 text-base text-zinc-600">
        Defina como a sua marca aparece nos Stories inteligentes: logo, @, site, cor e mascote. Tudo é opcional — o que você
        não preencher simplesmente não aparece.
      </p>
      <div className="mt-8">
        {profile && userId ? <StoryBrandManager userId={userId} initial={profile} /> : <AccountLoginGate returnPath="/minha-conta/identidade-stories" />}
      </div>
    </Container>
  );
}
