import type { Metadata } from "next";
import { auth } from "@/auth";
import { SchedulingIntro } from "@/components/instagram/SchedulingIntro";
import { RadarPanel } from "@/components/viral-radar/RadarPanel";

export const metadata: Metadata = {
  title: "Radar Viral",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ criado?: string }>;
}

export default async function ViralRadarPanelPage({ params, searchParams }: PageProps) {
  const session = await auth();
  const { id } = await params;
  if (!session?.user?.id) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <SchedulingIntro mode="login" returnPath={`/radar-viral/${id}`} />
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <RadarPanel radarId={id} justCreated={(await searchParams).criado === "1"} />
    </div>
  );
}
