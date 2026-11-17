import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/auth";
import { SchedulingIntro } from "@/components/instagram/SchedulingIntro";
import { listQueuesOverview } from "@/lib/video-queue/backend/queue-service";
import { DEFAULT_VIDEO_QUEUE_CATEGORY, VIDEO_QUEUE_CATEGORIES, findCategory } from "@/lib/video-queue/catalog";
import { VIDEO_QUEUE_STATUS_LABEL } from "@/lib/video-queue/types";
import { formatInTimeZone } from "@/lib/instagram/schedule-time";

export const metadata: Metadata = {
  title: "Filas de vídeos",
  robots: { index: false, follow: false },
};

interface PageProps {
  searchParams: Promise<{ categoria?: string; tema?: string }>;
}

/** Categoria (Games) → tema (GTA 6…) → filas do usuário com os contadores. */
export default async function VideoQueuesPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user?.id) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <SchedulingIntro mode="login" returnPath="/instagram/filas" />
      </div>
    );
  }
  const params = await searchParams;
  const category = findCategory(params.categoria) ?? findCategory(DEFAULT_VIDEO_QUEUE_CATEGORY)!;
  const themeFilter = category.themes.find((theme) => theme.id === params.tema)?.id ?? null;
  const overview = (await listQueuesOverview(session.user.id)).filter(
    ({ queue }) => queue.category === category.id && (!themeFilter || queue.theme === themeFilter),
  );

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-xl font-semibold text-zinc-900">Filas de vídeos</h1>
      <p className="mt-1 max-w-2xl text-sm text-zinc-600">
        Cole vários links, escolha as contas e os horários: o Alilu importa os vídeos autorizados em fila e publica um por
        horário, automaticamente, usando o mesmo agendador das suas publicações.
      </p>

      <nav className="mt-6 flex flex-wrap gap-2" aria-label="Categorias">
        {VIDEO_QUEUE_CATEGORIES.map((item) => (
          <Link
            key={item.id}
            href={`/instagram/filas?categoria=${item.id}`}
            className={`rounded-full px-4 py-2 text-sm font-semibold ring-1 ring-inset ${item.id === category.id ? "bg-zinc-900 text-white ring-zinc-900" : "bg-white text-zinc-800 ring-zinc-300"}`}
          >
            {item.name}
          </Link>
        ))}
      </nav>

      <section className="mt-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Temas de {category.name}</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {category.themes.map((theme) => (
            <div key={theme.id} className={`rounded-lg border p-4 ${theme.id === themeFilter ? "border-teal-500 bg-teal-50/40" : "border-zinc-200 bg-white"}`}>
              <Link href={`/instagram/filas?categoria=${category.id}&tema=${theme.id}`} className="font-semibold text-zinc-900 hover:underline">
                {theme.name}
              </Link>
              <p className="mt-1 text-xs text-zinc-600">{theme.description}</p>
              <Link
                href={`/instagram/filas/nova?categoria=${category.id}&tema=${theme.id}`}
                className="mt-3 inline-flex min-h-10 items-center rounded-md bg-zinc-900 px-3 py-2 text-xs font-semibold text-white hover:bg-zinc-800"
              >
                Nova fila de {theme.name}
              </Link>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Minhas filas</h2>
        {overview.length === 0 ? (
          <p className="mt-3 rounded-lg border border-dashed border-zinc-300 p-6 text-sm text-zinc-600">Nenhuma fila ainda. Escolha um tema acima para começar.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {overview.map(({ queue, counts }) => (
              <li key={queue.id} className="rounded-lg border border-zinc-200 bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Link href={`/instagram/filas/${queue.id}`} className="font-semibold text-zinc-900 hover:underline">
                    {queue.name}
                  </Link>
                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700">{VIDEO_QUEUE_STATUS_LABEL[queue.status]}</span>
                </div>
                <p className="mt-1 text-xs text-zinc-600">
                  {counts.total} links · {counts.imported} importados · {counts.pending} pendentes · {counts.scheduled} agendados · {counts.published} publicados
                  {counts.errors > 0 ? ` · ${counts.errors} com erro` : ""}
                </p>
                {counts.nextPublicationAt ? (
                  <p className="mt-1 text-xs text-zinc-500">Próxima publicação: {formatInTimeZone(counts.nextPublicationAt.toISOString(), queue.schedule.timezone)}</p>
                ) : null}
                {queue.status === "PAUSED" && queue.pauseReason ? <p className="mt-1 text-xs text-amber-700">{queue.pauseReason}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
