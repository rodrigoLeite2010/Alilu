import type { Metadata } from "next";
import { auth } from "@/auth";
import { isAdminEmail } from "@/lib/admin/admin-email";
import Link from "next/link";
import { VideoQueueCreateForm } from "@/components/video-queue/VideoQueueCreateForm";
import { DEFAULT_VIDEO_QUEUE_CATEGORY, DEFAULT_VIDEO_QUEUE_THEME, defaultCaptionTemplate, findTheme } from "@/lib/video-queue/catalog";

export const metadata: Metadata = {
  title: "Nova fila de vídeos",
  robots: { index: false, follow: false },
};

interface PageProps {
  searchParams: Promise<{ categoria?: string; tema?: string }>;
}

export default async function NewVideoQueuePage({ searchParams }: PageProps) {
  const session = await auth();
  const params = await searchParams;
  const valid = findTheme(params.categoria, params.tema);
  const category = valid ? params.categoria! : DEFAULT_VIDEO_QUEUE_CATEGORY;
  const theme = valid ? params.tema! : DEFAULT_VIDEO_QUEUE_THEME;
  if (!session?.user?.id) {
    const returnPath = `/instagram/filas/nova?categoria=${category}&tema=${theme}`;
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <h1 className="text-xl font-semibold text-zinc-900">Nova fila de vídeos</h1>
        <Link
          href={`/entrar?callbackUrl=${encodeURIComponent(returnPath)}`}
          className="mt-4 inline-flex min-h-11 items-center rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white"
        >
          Entrar para colar links
        </Link>
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <VideoQueueCreateForm initialCategory={category} initialTheme={theme} initialCaptionTemplate={defaultCaptionTemplate(category, theme)} isAdmin={isAdminEmail(session.user.email)} />
    </div>
  );
}
