import type { Metadata } from "next";
import { auth } from "@/auth";
import { isAdminEmail } from "@/lib/admin/admin-email";
import { SchedulingIntro } from "@/components/instagram/SchedulingIntro";
import { RadarPanel } from "@/components/instagram-radar/RadarPanel";

export const metadata: Metadata = {
  title: "Radar Instagram",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ criado?: string }>;
}

export default async function InstagramRadarPanelPage({ params, searchParams }: PageProps) {
  const session = await auth();
  const { id } = await params;
  if (!session?.user?.id) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <SchedulingIntro mode="login" returnPath={`/instagram/radar/${id}`} />
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <RadarPanel radarId={id} userId={session.user.id} justCreated={(await searchParams).criado === "1"} isAdmin={isAdminEmail(session.user.email)} />
    </div>
  );
}
