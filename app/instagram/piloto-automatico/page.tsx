import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/auth";
import { getAutomationDashboard, listAutomations } from "@/lib/content-automation/backend/automation-service";
import { canUseAutomation, getBillingSummary } from "@/lib/billing/backend/automation-access-service";
import { formatPriceBrl } from "@/lib/billing/plans";
import { serializeAccessResult } from "@/lib/billing/backend/billing-dto";
import { LinkButton } from "@/components/ui/Button";
import { SchedulingIntro } from "@/components/instagram/SchedulingIntro";
import { AutomationsOverview, type AutomationListItemDto } from "@/components/instagram/content-automation/AutomationsOverview";
import { AutomationBillingBanner } from "@/components/instagram/content-automation/AutomationBillingBanner";

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

  const [automations, access, dashboard, summary] = await Promise.all([
    listAutomations(session.user.id),
    canUseAutomation(session.user.id),
    getAutomationDashboard(session.user.id),
    getBillingSummary(session.user.id),
  ]);
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
            Suas automações de conteúdo semanal — Posts, Carrosséis, Stories e Reels, com geração, aprovação e publicação no Instagram.
          </p>
        </div>
        <LinkButton href="/instagram/piloto-automatico/nova">Criar automação</LinkButton>
      </div>

      <AutomationBillingBanner
        initialAccess={serializeAccessResult(access)}
        planName={summary.plan?.name ?? null}
        planPriceLabel={summary.plan ? formatPriceBrl(summary.plan.priceCents) : null}
      />
      {summary.notices.length > 0 ? (
        <div className="-mt-3 mb-6 space-y-2">
          {summary.notices.map((notice) => (
            <p
              key={notice.code}
              className={`rounded-lg border px-4 py-3 text-sm ${
                notice.level === "blocked"
                  ? "border-red-200 bg-red-50 text-red-900"
                  : notice.level === "warning"
                    ? "border-amber-200 bg-amber-50 text-amber-900"
                    : "border-zinc-200 bg-zinc-50 text-zinc-700"
              }`}
            >
              {notice.message}{" "}
              {notice.level !== "info" ? (
                <Link href="/planos" className="font-medium underline">
                  Ver planos
                </Link>
              ) : null}
            </p>
          ))}
        </div>
      ) : null}

      <AutomationsOverview
        initialAutomations={dto}
        dashboard={{
          next: dashboard.next
            ? {
                automationName: dashboard.next.automationName,
                contentType: dashboard.next.contentType,
                publishTime: dashboard.next.publishTime,
                date: dashboard.next.date,
                isToday: dashboard.next.isToday,
              }
            : null,
          today: dashboard.today,
        }}
      />
    </div>
  );
}
