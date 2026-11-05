import { MusicLibrary } from "@/components/music/MusicLibrary";
import { privateMetadata, requireMusicPage } from "@/lib/music/page-auth";

export const metadata = privateMetadata;

export default async function MusicPage({ searchParams }: PageProps<"/musicas">) {
  const { aba } = await searchParams;
  const tab = aba === "repertorios" || aba === "ao-vivo" ? aba : "musicas";
  await requireMusicPage("/musicas?aba=" + tab);
  return <MusicLibrary key={tab} tab={tab} />;
}
