import type { Metadata } from "next";
import { auth } from "@/auth";
import { SchedulingIntro } from "@/components/instagram/SchedulingIntro";
import { VideoQueuePanel } from "@/components/video-queue/VideoQueuePanel";

export const metadata: Metadata = {
  title: "Fila de vídeos",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ criada?: string }>;
}

export default async function VideoQueuePanelPage({ params, searchParams }: PageProps) {
  const session = await auth();
  const { id } = await params;
  if (!session?.user?.id) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <SchedulingIntro mode="login" returnPath={`/instagram/filas/${id}`} />
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <VideoQueuePanel queueId={id} userId={session.user.id} justCreated={(await searchParams).criada === "1"} />
    </div>
  );
}
