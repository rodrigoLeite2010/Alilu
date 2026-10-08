import Link from "next/link";
import { Gift } from "lucide-react";
import { Container } from "@/components/ui/Container";

/** Card público na home: leva para o módulo (a área em si exige login). */
export function SecretSantaHomeCard() {
  return (
    <Container className="pt-8">
      <section className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-rose-200 bg-rose-50/60 p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-rose-800">
            <Gift className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <h2 className="text-lg font-bold text-zinc-900">Amigo Secreto</h2>
            <p className="text-sm text-zinc-600">Crie seu amigo secreto, faça o sorteio, compartilhe desejos e converse anonimamente.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 text-sm font-semibold">
          <Link href="/amigo-secreto/novo" className="inline-flex min-h-11 items-center rounded-md bg-[var(--brand-primary)] px-4 text-white">
            + Criar amigo secreto
          </Link>
          <Link href="/amigo-secreto" className="inline-flex min-h-11 items-center rounded-md bg-white px-4 text-rose-800 ring-1 ring-inset ring-rose-200">
            Meus grupos
          </Link>
          <Link href="/amigo-secreto" className="inline-flex min-h-11 items-center rounded-md bg-white px-4 text-rose-800 ring-1 ring-inset ring-rose-200">
            Convites
          </Link>
        </div>
      </section>
    </Container>
  );
}
