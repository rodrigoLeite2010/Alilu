import Link from "next/link";
import { PiggyBank } from "lucide-react";
import { Container } from "@/components/ui/Container";

export function MesadaLoginGate({ returnPath }: { returnPath: string }) {
  return (
    <Container className="max-w-lg py-14">
      <section className="rounded-lg border border-teal-200 bg-teal-50/50 p-6 text-center sm:p-8">
        <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-white text-teal-800">
          <PiggyBank className="h-5 w-5" aria-hidden />
        </span>
        <h1 className="mt-3 text-xl font-semibold text-zinc-900">Entre para usar a Mesada</h1>
        <p className="mt-2 text-sm text-zinc-600">Organize a mesada dos seus filhos, com cofrinho, metas e recompensas. Os dados são privados: só você vê.</p>
        <Link
          href={`/entrar?callbackUrl=${encodeURIComponent(returnPath)}`}
          className="mt-5 inline-flex rounded-md bg-[var(--brand-primary)] px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90"
        >
          Entrar
        </Link>
      </section>
    </Container>
  );
}
