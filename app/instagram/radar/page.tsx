import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/auth";
import { SchedulingIntro } from "@/components/instagram/SchedulingIntro";
import { listRadarsOverview } from "@/lib/instagram-radar/backend/radar-service";
import { radarConfigFromQueue } from "@/lib/instagram-radar/radar-config";
import { describeDailyTimes, intervalLabel } from "@/lib/instagram-radar/schedule";
import { formatInTimeZone } from "@/lib/instagram/schedule-time";
import { VIDEO_QUEUE_STATUS_LABEL } from "@/lib/video-queue/types";
import { isMissingSchemaError } from "@/lib/db/schema-errors";

export const metadata: Metadata = {
  title: "Radar Instagram",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

/** Instagram › Radar Instagram: radares do usuário, cada um com a SUA conta de destino. */
export default async function InstagramRadarListPage() {
  const session = await auth();
  if (!session?.user?.id) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <SchedulingIntro mode="login" returnPath="/instagram/radar" />
      </div>
    );
  }
  let overview: Awaited<ReturnType<typeof listRadarsOverview>> = [];
  let migrationPending = false;
  try {
    overview = await listRadarsOverview(session.user.id);
  } catch (error) {
    if (!isMissingSchemaError(error)) throw error;
    migrationPending = true;
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <p className="text-xs font-medium uppercase tracking-wide text-teal-800">Instagram</p>
      <h1 className="text-xl font-semibold text-zinc-900">Radar Instagram</h1>
      <p className="mt-1 max-w-2xl text-sm text-zinc-600">
        Cole dezenas de links de vídeos, escolha a conta e quantas publicações por dia (1 a 10). O Alilu importa os vídeos autorizados, organiza a fila e
        publica sozinho na conta escolhida — mesmo com o navegador fechado. Nunca em outra conta, nunca no Facebook.
      </p>
      <Link href="/instagram/radar/novo" className="mt-4 inline-flex min-h-11 items-center rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white">
        Criar radar
      </Link>

      {migrationPending ? (
        <p className="mt-6 rounded-md bg-amber-50 p-3 text-sm text-amber-900">
          O banco ainda não tem as colunas do Radar Instagram. Rode <code>npm run db:migrate</code> (migração 0059_instagram_radar.sql) e recarregue.
        </p>
      ) : overview.length === 0 ? (
        <p className="mt-6 text-sm text-zinc-600">Você ainda não tem radares.</p>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="text-xs text-zinc-500">
              <tr>
                <th className="py-2 pr-3 font-medium">Radar</th>
                <th className="py-2 pr-3 font-medium">Conta</th>
                <th className="py-2 pr-3 font-medium">Status</th>
                <th className="py-2 pr-3 font-medium">Frequência</th>
                <th className="py-2 pr-3 text-right font-medium">Links</th>
                <th className="py-2 pr-3 text-right font-medium">Importados</th>
                <th className="py-2 pr-3 text-right font-medium">Aguardando</th>
                <th className="py-2 pr-3 text-right font-medium">Prontos</th>
                <th className="py-2 pr-3 text-right font-medium">Agendados</th>
                <th className="py-2 pr-3 text-right font-medium">Publicados</th>
                <th className="py-2 pr-3 text-right font-medium">Erros</th>
                <th className="py-2 font-medium">Próxima publicação</th>
              </tr>
            </thead>
            <tbody>
              {overview.map(({ queue, counts, account }) => {
                const schedule = radarConfigFromQueue(queue);
                return (
                  <tr key={queue.id} className="border-t border-zinc-100 align-top">
                    <td className="py-2 pr-3">
                      <Link href={`/instagram/radar/${queue.id}`} className="font-medium text-teal-800 hover:underline">
                        {queue.name}
                      </Link>
                    </td>
                    <td className="py-2 pr-3">
                      @{account?.username ?? "?"}
                      {account && account.status !== "connected" ? <span className="block text-xs text-amber-700">desconectada</span> : null}
                    </td>
                    <td className="py-2 pr-3">{VIDEO_QUEUE_STATUS_LABEL[queue.status]}</td>
                    <td className="py-2 pr-3 text-xs text-zinc-600">
                      {schedule.postsPerDay}/dia · {intervalLabel(schedule.intervalMinutes).toLowerCase()}
                      <span className="block">{describeDailyTimes(schedule)}</span>
                    </td>
                    <td className="py-2 pr-3 text-right">{counts.total}</td>
                    <td className="py-2 pr-3 text-right">{counts.imported}</td>
                    <td className="py-2 pr-3 text-right">{counts.pending}</td>
                    <td className="py-2 pr-3 text-right">{counts.ready}</td>
                    <td className="py-2 pr-3 text-right">{counts.scheduled}</td>
                    <td className="py-2 pr-3 text-right">{counts.published}</td>
                    <td className="py-2 pr-3 text-right">{counts.errors}</td>
                    <td className="py-2 text-xs">{counts.nextPublicationAt ? formatInTimeZone(counts.nextPublicationAt.toISOString(), schedule.timezone) : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
