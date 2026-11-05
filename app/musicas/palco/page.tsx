import { Stage } from "@/components/music/Stage";
import { privateMetadata, requireMusicPage } from "@/lib/music/page-auth";

export const metadata = privateMetadata;

export default async function StagePage({ searchParams }: PageProps<"/musicas/palco">) {
  const params = await searchParams;
  const code = typeof params.convite === "string" && /^[A-Za-z0-9_-]{12}$/.test(params.convite) ? params.convite : "";
  const id = typeof params.sessao === "string" ? params.sessao.slice(0, 36) : "";
  const set = typeof params.repertorio === "string" ? params.repertorio.slice(0, 36) : "";
  const revision = typeof params.revisao === "string" ? Number(params.revisao) || 0 : 0;
  const query = new URLSearchParams();
  if (code) query.set("convite", code);
  if (id) query.set("sessao", id);
  if (set) query.set("repertorio", set);
  if (revision) query.set("revisao", String(revision));
  await requireMusicPage("/musicas/palco?" + query);
  return <Stage code={code} sessionId={id} setId={set} revision={revision} />;
}
