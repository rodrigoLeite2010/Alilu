import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/auth";
import { Container } from "@/components/ui/Container";
import { AccountLoginGate } from "@/components/conta/AccountLoginGate";
import { LinkButton } from "@/components/ui/Button";
import { YoutubeImporter } from "@/components/youtube-import/YoutubeImporter";
import { isAdminEmail } from "@/lib/admin/admin-access";
import { canUseImporter } from "@/lib/billing/backend/automation-access-service";
import { getImportSettings } from "@/lib/instagram-import/backend/import-repository";
import { listYoutubeImportsForUser } from "@/lib/youtube-import/backend/import-repository";
import { getYoutubeImportQuota, youtubeImportLimits } from "@/lib/youtube-import/backend/import-service";
import { serializeYoutubeImport } from "@/lib/youtube-import/backend/import-dto";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Importar do YouTube — consultar vídeo e editar o arquivo original | Alilu",
  description: "Cole o link de um vídeo ou Short do YouTube, veja os dados e a prévia oficial e envie o arquivo original para editar na Alilu.",
  robots: { index: false, follow: false },
};

/** Vídeos > Importar do YouTube. */
export default async function YoutubeImportPage() {
  const session = await auth();
  const userId = session?.user?.id ?? null;
  const isAdmin = isAdminEmail(session?.user?.email);
  const settings = await getImportSettings().catch(() => ({ maxImportedVideoSizeMb: 100, maxImportedDurationMinutes: 10 }));
  const quota = userId ? await getYoutubeImportQuota(userId, isAdmin).catch(() => null) : null;
  const history = userId ? await listYoutubeImportsForUser(userId).then((rows) => rows.map(serializeYoutubeImport)).catch(() => []) : [];
  const needsPlan =
    userId && !isAdmin && youtubeImportLimits().requiresPaidPlan ? !(await canUseImporter(userId).catch(() => ({ allowed: true }))).allowed : false;

  return (
    <Container className="max-w-3xl py-6 sm:py-14">
      <nav className="mb-4 text-sm text-zinc-500">
        <Link href="/videos" className="hover:underline">
          Vídeos
        </Link>{" "}
        › Importar do YouTube
      </nav>
      <h1 className="text-xl font-bold tracking-tight text-zinc-900 sm:text-3xl">Importar do YouTube</h1>
      <p className="mt-2 text-sm text-zinc-600 sm:text-base">
        Cole o link de um vídeo, Short ou live do YouTube para ver os dados e a prévia oficial. Para editar, envie o arquivo original — seu ou
        autorizado pelo titular.
      </p>
      <div className="mt-5 md:mt-8">
        {!userId ? (
          <AccountLoginGate returnPath="/videos/importar-youtube" />
        ) : needsPlan ? (
          <section className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <p className="font-medium">O importador do YouTube faz parte dos planos pagos.</p>
            <div className="mt-3">
              <LinkButton href="/planos">Ver planos</LinkButton>
            </div>
          </section>
        ) : (
          <YoutubeImporter
            userId={userId}
            initialQuota={quota}
            maxUploadMb={settings.maxImportedVideoSizeMb}
            maxDurationMinutes={settings.maxImportedDurationMinutes}
            initialHistory={history}
          />
        )}
      </div>
    </Container>
  );
}
