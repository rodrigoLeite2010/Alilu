import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { FacebookPagePicker } from "@/components/instagram/FacebookPagePicker";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/** Depois do login na Meta: o usuário escolhe em quais Páginas o Alilu publica. */
export default async function FacebookPagesSelectionPage({ searchParams }: { searchParams: Promise<{ attempt?: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/entrar?callbackUrl=%2Finstagram%2Fpainel");
  const { attempt } = await searchParams;
  if (!attempt) redirect("/instagram/painel?status=erro&mensagem=tentativa-oauth-expirada");
  return (
    <main className="mx-auto max-w-xl px-4 py-12">
      <h1 className="text-xl font-semibold">Escolha a Página do Facebook</h1>
      <p className="mt-2 text-sm text-zinc-600">
        O Alilu vai publicar somente nas Páginas que você marcar abaixo — nunca no seu perfil pessoal. Nada é salvo até você confirmar.
      </p>
      <FacebookPagePicker attemptId={attempt} />
    </main>
  );
}
