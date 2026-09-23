import type { Metadata } from "next";
import { auth } from "@/auth";
import { listAutomations } from "@/lib/content-automation/backend/automation-service";
import { LinkButton } from "@/components/ui/Button";
import { SchedulingIntro } from "@/components/instagram/SchedulingIntro";
import { AutomationsOverview, type AutomationListItemDto } from "@/components/instagram/content-automation/AutomationsOverview";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/**
 * Piloto Automático de Conteúdo — dashboard (seção 28) + "Minhas
 * automações" (seção 29) em uma única tela: automações ativas, próxima
 * publicação e a lista completa com ações (pausar/ativar/duplicar/
 * excluir/editar/histórico).
 */
export default async function ContentAutomationDashboardPage() {
  const session = await auth();
  if (!session?.user?.id) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <SchedulingIntro mode="login" returnPath="/instagram/piloto-automatico" />
      </div>
    );
  }

  const automations = await listAutomations(session.user.id);
  const dto: AutomationListItemDto[] = automations.map((item) => ({
    id: item.id,
    name: item.name,
    status: item.status,
    timezone: item.timezone,
    autoPublish: item.autoPublish,
    requireApproval: item.requireApproval,
    activeDaysCount: item.activeDaysCount,
    lastRunAt: item.lastRunAt ? item.lastRunAt.toISOString() : null,
    nextRunAt: item.nextRunAt ? item.nextRunAt.toISOString() : null,
  }));

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">Piloto Automático</h1>
          <p className="mt-1 text-sm text-zinc-600">
            Suas automações de conteúdo semanal — geração, aprovação e publicação no Instagram.
          </p>
        </div>
        <LinkButton href="/instagram/piloto-automatico/nova">Criar automação</LinkButton>
      </div>

      <AutomationsOverview initialAutomations={dto} />
    </div>
  );
}
