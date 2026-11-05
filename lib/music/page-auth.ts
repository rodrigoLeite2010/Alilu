import { auth } from "@/auth";
import { redirect } from "next/navigation";
import type { Metadata } from "next";

export const privateMetadata: Metadata = {
  title: "Músicas e repertórios", robots: { index: false, follow: false }, referrer: "no-referrer",
};

export async function requireMusicPage(path: string) {
  const session = await auth();
  if (!session?.user?.id) redirect("/entrar?callbackUrl=" + encodeURIComponent(path));
}
