import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/auth";
import { SchedulingIntro } from "@/components/instagram/SchedulingIntro";
import { listRadarsOverview } from "@/lib/viral-radar/backend/radar-service";
import { findTheme } from "@/lib/video-queue/catalog";
import { RADAR_STATUS_LABEL } from "@/lib/viral-radar/types";
import { isMissingSchemaError, MIGRATION_PENDING_MESSAGE } from "@/lib/db/schema-errors";

export const metadata: Metadata = {
  title: "Radar Viral",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const when = (date: Date | null) => (date ? date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }) : "—");

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-3">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-zinc-900">{value}</p>
    </div>
  );
}

/** Radar Viral: indicadores gerais + radares do usuário (cada um com fila e contas próprias). */
export default async function ViralRadarPage() {
  const session = await auth();
  if (!session?.user?.id) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <SchedulingIntro mode="login" returnPath="/radar-viral" />
      </div>
    );
  }
  let overview: Awaited<ReturnType<typeof listRadarsOverview>>;
  try {
    overview = await listRadarsOverview(session.user.id);
  } catch (error) {
    console.error(JSON.stringify({ scope: "viral-radar", event: "page.failed", code: isMissingSchemaError(error) ? "MIGRATION_PENDING" : "UNEXPECTED", message: (error as Error)?.message?.slice(0, 200) }));
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <h1 className="text-xl font-semibold text-zinc-900">Radar Viral</h1>
        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          {isMissingSchemaError(error) ? MIGRATION_PENDING_MESSAGE : "Não foi possível carregar o Radar Viral agora. Tente novamente em instantes."}
        </p>
      </div>
    );
  }
  const { rows, totals } = overview;
  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">Radar Viral</h1>
          <p className="mt-1 max-w-2xl text-sm text-zinc-600">
            Descobre conteúdos em alta por APIs oficiais, calcula o Viral Score, separa o que pode ser publicado (próprio ou licenciado) e reabastece a sua fila de publicação automaticamente.
          </p>
        </div>
        <Link href="/radar-viral/novo" className="inline-flex min-h-11 items-center rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white">
          Novo radar
        </Link>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Radares ativos" value={totals.activeRadars} />
        <Stat label="Descobertos hoje" value={totals.discoveredToday} />
        <Stat label="Classificados" value={totals.classified} />
        <Stat label="Autorizados" value={totals.authorized} />
        <Stat label="Importados" value={totals.imported} />
        <Stat label="Prontos" value={totals.ready} />
        <Stat label="Agendados" value={totals.scheduled} />
        <Stat label="Publicados" value={totals.published} />
        <Stat label="Com erro" value={totals.errors} />
        <Stat label="Próxima execução" value={when(totals.nextRunAt)} />
        <Stat label="Próxima publicação" value={when(totals.nextPublicationAt)} />
      </div>

      <section className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Meus radares</h2>
        {rows.length === 0 ? (
          <div className="mt-3 rounded-lg border border-dashed border-zinc-300 p-6 text-sm text-zinc-600">
            Nenhum radar ainda.{" "}
            <Link className="font-medium text-teal-700 underline" href="/radar-viral/novo?categoria=games&tema=gta-6">
              Criar o Radar GTA 6 Brasil
            </Link>
          </div>
        ) : (
          <ul className="mt-3 space-y-3">
            {rows.map(({ radar, counters }) => (
              <li key={radar.id} className="rounded-lg border border-zinc-200 bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Link href={`/radar-viral/${radar.id}`} className="font-semibold text-zinc-900 hover:underline">
                    {radar.name}
                  </Link>
                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700">{RADAR_STATUS_LABEL[radar.status]}</span>
                </div>
                <p className="mt-1 text-xs text-zinc-600">
                  {findTheme(radar.category, radar.theme)?.name ?? radar.theme} · {counters.discoveredToday} descobertos hoje · {counters.awaiting} aguardando autorização · {counters.queued} na fila · {counters.published} publicados
                  {counters.errors ? ` · ${counters.errors} com erro` : ""}
                </p>
                <p className="mt-1 text-xs text-zinc-500">Próxima execução: {when(radar.nextRunAt)}</p>
                {radar.lastStatusMessage ? <p className="mt-1 text-xs text-zinc-500">{radar.lastStatusMessage}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
