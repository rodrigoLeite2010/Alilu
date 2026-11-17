import type { Metadata } from "next";
import { auth } from "@/auth";
import { SchedulingIntro } from "@/components/instagram/SchedulingIntro";
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
  if (!session?.user?.id) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <SchedulingIntro mode="login" returnPath="/instagram/filas/nova" />
      </div>
    );
  }
  const valid = findTheme(params.categoria, params.tema);
  const category = valid ? params.categoria! : DEFAULT_VIDEO_QUEUE_CATEGORY;
  const theme = valid ? params.tema! : DEFAULT_VIDEO_QUEUE_THEME;
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <VideoQueueCreateForm initialCategory={category} initialTheme={theme} initialCaptionTemplate={defaultCaptionTemplate(category, theme)} />
    </div>
  );
}
