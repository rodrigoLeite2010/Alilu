import Link from "next/link";
import { notFound } from "next/navigation";
import { getAdminSession } from "@/lib/admin/admin-access";
import { getDb } from "@/lib/db/client";
import { UUID } from "@/lib/imoveis/model";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Histórico do imóvel",
  robots: { index: false, follow: false },
};
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  if (!(await getAdminSession())) notFound();
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const raw = Number((await searchParams).page),
    page = Number.isFinite(raw)
      ? Math.min(10000, Math.max(1, Math.floor(raw) || 1))
      : 1;
  const events =
    await getDb()`select id,actor_id,action,snapshot,created_at::text from property_history where property_id=${id} order by id desc limit 50 offset ${(page - 1) * 50}`;
  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <Link href="/admin/imoveis" className="text-brand-primary underline">
        ← Moderação de imóveis
      </Link>
      <h1 className="my-5 text-2xl font-bold">Histórico de alterações</h1>
      <p className="mb-5 text-sm text-zinc-500">
        Anúncio {id}. Dados privados não são registrados neste histórico.
      </p>
      <div className="space-y-4">
        {events.map((e) => (
          <details
            key={String(e.id)}
            className="rounded-xl border border-zinc-200 bg-white p-4"
          >
            <summary className="cursor-pointer font-semibold">
              {String(e.action)} ·{" "}
              {new Date(String(e.created_at)).toLocaleString("pt-BR", {
                timeZone: "America/Sao_Paulo",
              })}
            </summary>
            <p className="my-3 text-xs text-zinc-500">
              Responsável: {String(e.actor_id ?? "Sistema")}
            </p>
            <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words text-xs">
              {JSON.stringify(e.snapshot, null, 2)}
            </pre>
          </details>
        ))}
      </div>
      <nav className="mt-6 flex justify-center gap-5">
        {page > 1 && <Link href={`?page=${page - 1}`}>← Anterior</Link>}
        {events.length === 50 && (
          <Link href={`?page=${page + 1}`}>Próxima →</Link>
        )}
      </nav>
    </main>
  );
}
