import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { Container } from "@/components/ui/Container";
import { GroupView, type GroupViewData } from "@/components/secret-santa/GroupView";
import { SecretSantaError, getGroupView } from "@/lib/secret-santa/backend/service";
import { SecretSantaLoginGate } from "../_login-gate";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Amigo Secreto | Alilu", robots: { index: false, follow: false } };

export default async function SecretSantaGroupPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = (await auth())?.user?.id;
  if (!userId) return <SecretSantaLoginGate returnPath={`/amigo-secreto/${id}`} />;
  let view: GroupViewData | null = null;
  try {
    view = (await getGroupView(userId, id)) as unknown as GroupViewData;
  } catch (error) {
    if (!(error instanceof SecretSantaError)) throw error;
  }
  // quem não participa do grupo recebe 404 (não revela que o grupo existe)
  if (!view) notFound();
  return (
    <Container className="max-w-3xl py-6 sm:py-10">
      <GroupView initial={view} />
    </Container>
  );
}
