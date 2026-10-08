import type { Metadata } from "next";
import { auth } from "@/auth";
import { Container } from "@/components/ui/Container";
import { SecretSantaHome } from "@/components/secret-santa/SecretSantaHome";
import { listMyGroups } from "@/lib/secret-santa/backend/service";
import { SecretSantaLoginGate } from "./_login-gate";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Amigo Secreto | Alilu", robots: { index: false, follow: false } };

/** Amigo Secreto: cada pessoa vê só os grupos dos quais participa. */
export default async function SecretSantaPage() {
  const userId = (await auth())?.user?.id;
  if (!userId) return <SecretSantaLoginGate returnPath="/amigo-secreto" />;
  const data = await listMyGroups(userId);
  return (
    <Container className="max-w-3xl py-6 sm:py-10">
      <h1 className="text-2xl font-bold text-zinc-900">Amigo Secreto</h1>
      <p className="mt-1 mb-5 text-sm text-zinc-600">Crie seu amigo secreto, faça o sorteio, compartilhe desejos e converse anonimamente.</p>
      <SecretSantaHome data={data} />
    </Container>
  );
}
