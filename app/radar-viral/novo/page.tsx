import type { Metadata } from "next";
import { auth } from "@/auth";
import { SchedulingIntro } from "@/components/instagram/SchedulingIntro";
import { RadarCreateForm } from "@/components/viral-radar/RadarCreateForm";
import { findCategory, findTheme } from "@/lib/video-queue/catalog";

export const metadata: Metadata = {
  title: "Novo Radar Viral",
  robots: { index: false, follow: false },
};

interface PageProps {
  searchParams: Promise<{ categoria?: string; tema?: string }>;
}

export default async function NewViralRadarPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user?.id) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <SchedulingIntro mode="login" returnPath="/radar-viral/novo" />
      </div>
    );
  }
  const params = await searchParams;
  const category = findCategory(params.categoria)?.id ?? "games";
  const theme = findTheme(category, params.tema)?.id ?? (category === "games" ? "gta-6" : findCategory(category)!.themes[0].id);
  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <RadarCreateForm initialCategory={category} initialTheme={theme} />
    </div>
  );
}
