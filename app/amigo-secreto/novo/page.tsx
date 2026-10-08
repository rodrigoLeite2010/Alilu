import type { Metadata } from "next";
import { auth } from "@/auth";
import { Container } from "@/components/ui/Container";
import { NewGroupWizard } from "@/components/secret-santa/NewGroupWizard";
import { SecretSantaLoginGate } from "../_login-gate";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Criar amigo secreto | Alilu", robots: { index: false, follow: false } };

export default async function NewSecretSantaPage() {
  const userId = (await auth())?.user?.id;
  if (!userId) return <SecretSantaLoginGate returnPath="/amigo-secreto/novo" />;
  return (
    <Container className="max-w-2xl py-6 sm:py-10">
      <h1 className="mb-5 text-2xl font-bold text-zinc-900">Criar amigo secreto</h1>
      <NewGroupWizard />
    </Container>
  );
}
