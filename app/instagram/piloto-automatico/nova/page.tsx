import type { Metadata } from "next";
import { auth } from "@/auth";
import { listInstagramAccountsForUser } from "@/lib/instagram/backend/instagram-account-repository";
import { SchedulingIntro } from "@/components/instagram/SchedulingIntro";
import { AutomationWizard } from "@/components/instagram/content-automation/AutomationWizard";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/** Wizard de criação (seção 44) — conta, marca/modo, semana e revisão. */
export default async function NewContentAutomationPage() {
  const session = await auth();
  if (!session?.user?.id) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <SchedulingIntro mode="login" returnPath="/instagram/piloto-automatico/nova" />
      </div>
    );
  }

  const accounts = await listInstagramAccountsForUser(session.user.id);
  if (accounts.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <SchedulingIntro mode="connect" returnPath="/instagram/piloto-automatico/nova" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-xl font-semibold text-zinc-900">Nova automação</h1>
      <p className="mt-1 text-sm text-zinc-600">
        Configure uma vez o que publicar durante a semana. O Alilu gera, agenda e publica automaticamente.
      </p>
      <div className="mt-6">
        <AutomationWizard
          userId={session.user.id}
          accounts={accounts.map((account) => ({ id: account.id, igUsername: account.igUsername }))}
        />
      </div>
    </div>
  );
}
