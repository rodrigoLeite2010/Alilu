"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { STATUS, money, type Property } from "@/lib/imoveis/model";
import { estateRequest } from "./client";
export function OwnerPanel({ items }: { items: Property[] }) {
  const [busy, setBusy] = useState(""),
    [error, setError] = useState(""),
    [remove, setRemove] = useState("");
  const router = useRouter();
  async function action(id: string, status: string) {
    setBusy(id);
    setError("");
    try {
      await estateRequest(`/${id}/status`, "POST", { status });
      setRemove("");
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  return (
    <>
      <div className="mb-7 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Meus anúncios</h1>
          <p className="mt-2 text-zinc-500">
            Gerencie seus imóveis e acompanhe o interesse.
          </p>
        </div>
        <Link href="/imoveis/anunciar" className="estate-button">
          + Novo anúncio
        </Link>
      </div>
      {error && (
        <p role="alert" className="mb-5 text-red-700">
          {error}
        </p>
      )}
      {!items.length && (
        <div className="estate-panel py-16 text-center">
          <p className="mb-5 text-lg">Seu primeiro imóvel pode estar aqui.</p>
          <Link href="/imoveis/anunciar" className="estate-button">
            Criar meu anúncio grátis
          </Link>
        </div>
      )}
      <div className="space-y-4">
        {items.map((p) => (
          <article key={p.id} className="estate-panel">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <span className="rounded-full bg-brand-primary-soft px-3 py-1 text-xs font-semibold text-brand-primary">
                  {STATUS[p.status]}
                </span>
                <h2 className="mt-3 text-lg font-semibold">{p.data.title}</h2>
                <p className="mt-1 text-sm text-zinc-500">
                  {p.data.city} / {p.data.state} · {money(p.data.price)}
                </p>
                {p.reason && (
                  <p className="mt-2 text-sm text-amber-800">
                    Moderação: {p.reason}
                  </p>
                )}
              </div>
              <p className="text-sm text-zinc-500">
                {p.views ?? 0} acessos · {p.contacts ?? 0} cliques no contato
              </p>
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                className="estate-button secondary"
                href={`/imoveis/editar/${p.id}`}
              >
                Editar
              </Link>
              {["published", "sold", "rented"].includes(p.status) && (
                <Link
                  className="estate-button secondary"
                  href={`/imoveis/${p.slug}`}
                >
                  Ver página
                </Link>
              )}
              {p.status === "published" && (
                <button
                  disabled={busy === p.id}
                  className="estate-button secondary"
                  onClick={() => void action(p.id, "paused")}
                >
                  Pausar
                </button>
              )}
              {p.status === "draft" && (
                <Link
                  className="estate-button secondary"
                  href={`/imoveis/editar/${p.id}`}
                >
                  Completar e enviar para análise
                </Link>
              )}
              {["paused", "sold", "rented"].includes(p.status) && (
                <button
                  disabled={busy === p.id}
                  className="estate-button secondary"
                  onClick={() => void action(p.id, "pending")}
                >
                  Reativar para análise
                </button>
              )}
              {["published", "paused"].includes(p.status) && (
                <>
                  <button
                    disabled={busy === p.id}
                    className="estate-button secondary"
                    onClick={() => void action(p.id, "sold")}
                  >
                    Marcar vendido
                  </button>
                  <button
                    disabled={busy === p.id}
                    className="estate-button secondary"
                    onClick={() => void action(p.id, "rented")}
                  >
                    Marcar alugado
                  </button>
                </>
              )}
              <button
                disabled={busy === p.id}
                className="text-sm text-red-700 underline"
                onClick={() => setRemove(p.id)}
              >
                Excluir
              </button>
            </div>
            {remove === p.id && (
              <div
                role="alert"
                className="mt-4 rounded-xl bg-red-50 p-4 text-sm"
              >
                <p className="mb-3">
                  Excluir este anúncio e os dados de contato? As fotos entrarão
                  na fila de exclusão.
                </p>
                <button
                  disabled={!!busy}
                  className="estate-button"
                  onClick={() => void action(p.id, "removed")}
                >
                  Confirmar exclusão
                </button>
                <button
                  className="ml-4 underline"
                  onClick={() => setRemove("")}
                >
                  Cancelar
                </button>
              </div>
            )}
          </article>
        ))}
      </div>
      <p className="mt-5 text-xs text-zinc-500">
        Acessos e cliques são contagens aproximadas, limitadas a um evento por
        visitante, imóvel e dia. Não identificamos os interessados.
      </p>
    </>
  );
}
