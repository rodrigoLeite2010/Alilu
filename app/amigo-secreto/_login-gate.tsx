import Link from "next/link";
import { Gift } from "lucide-react";
import { Container } from "@/components/ui/Container";

export function SecretSantaLoginGate({ returnPath, title = "Entre para usar o Amigo Secreto", text }: { returnPath: string; title?: string; text?: string }) {
  return (
    <Container className="max-w-lg py-14">
      <section className="rounded-lg border border-rose-200 bg-rose-50/50 p-6 text-center sm:p-8">
        <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-white text-rose-800">
          <Gift className="h-5 w-5" aria-hidden />
        </span>
        <h1 className="mt-3 text-xl font-semibold text-zinc-900">{title}</h1>
        <p className="mt-2 text-sm text-zinc-600">{text ?? "Crie seu amigo secreto, faça o sorteio, compartilhe desejos e converse anonimamente. O sorteio é secreto: só você vê quem tirou."}</p>
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
