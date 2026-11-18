import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/auth";
import { isAdminEmail } from "@/lib/admin/admin-email";
import { RadarCreateForm } from "@/components/instagram-radar/RadarCreateForm";

export const metadata: Metadata = {
  title: "Novo Radar Instagram",
  robots: { index: false, follow: false },
};

export default async function NewInstagramRadarPage() {
  const session = await auth();
  if (!session?.user?.id) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <h1 className="text-xl font-semibold text-zinc-900">Novo Radar Instagram</h1>
        <Link
          href={`/entrar?callbackUrl=${encodeURIComponent("/instagram/radar/novo")}`}
          className="mt-4 inline-flex min-h-11 items-center rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white"
        >
          Entrar para criar um radar
        </Link>
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <RadarCreateForm isAdmin={isAdminEmail(session.user.email)} />
    </div>
  );
}
