import Link from "next/link";
import { CalendarClock, CheckCircle2 } from "lucide-react";
import { INSTAGRAM_PUBLISHING } from "@/data/instagram";

const statusSamples = [
  { label: "Rascunho", className: "bg-zinc-100 text-zinc-700" },
  { label: "Agendado", className: "bg-blue-50 text-blue-700" },
  { label: "Publicando", className: "bg-amber-50 text-amber-800" },
  { label: "Publicado", className: "bg-teal-50 text-teal-800" },
  { label: "Erro", className: "bg-red-50 text-red-700" },
];

/**
 * Apresentação do calendário/agendamento para quem ainda não entrou (ou
 * ainda não conectou o Instagram) — em vez de só "Você precisa entrar".
 * `mode`: "login" (sem sessão) ou "connect" (logado, sem Instagram).
 */
export function SchedulingIntro({ mode, returnPath }: { mode: "login" | "connect"; returnPath: string }) {
  const oauth = `/api/instagram/oauth/start?returnTo=${encodeURIComponent(returnPath)}`;
  const connectHref = mode === "login" ? `/entrar?callbackUrl=${encodeURIComponent(oauth)}` : oauth;

  return (
    <section className="rounded-lg border border-teal-200 bg-teal-50/50 p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-white text-teal-800">
          <CalendarClock className="h-5 w-5" aria-hidden />
        </span>
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 sm:text-2xl">Organize e agende suas publicações</h1>
          <p className="mt-1 max-w-xl text-sm text-zinc-600">
            Conecte seu Instagram para programar posts, carrosséis e Reels. No dia e horário escolhidos, o Alilu publica
            sozinho — mesmo com o site fechado.
          </p>
        </div>
      </div>

      <ul className="mt-5 grid grid-cols-1 gap-2 text-sm text-zinc-700 sm:grid-cols-3">
        {[
          "Veja no calendário tudo o que está agendado.",
          "Edite, reagende ou cancele antes de publicar.",
          "Acompanhe o status de cada publicação.",
        ].map((item) => (
          <li key={item} className="flex gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-teal-700" aria-hidden />
            {item}
          </li>
        ))}
      </ul>

      <div className="mt-4 flex flex-wrap gap-1.5" aria-label="Status acompanhados">
        {statusSamples.map((status) => (
          <span key={status.label} className={`rounded-full px-2 py-0.5 text-xs font-medium ${status.className}`}>
            {status.label}
          </span>
        ))}
      </div>

      <div className="mt-5 flex flex-col gap-2 sm:flex-row">
        <Link
          href={connectHref}
          prefetch={false}
          className="inline-flex min-h-11 items-center justify-center rounded-md bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-zinc-800"
        >
          {mode === "login" ? "Entrar e conectar Instagram" : "Conectar Instagram"}
        </Link>
        <Link
          href="/instagram/criar-post"
          className="inline-flex min-h-11 items-center justify-center rounded-md bg-white px-4 py-2.5 text-sm font-semibold text-zinc-900 ring-1 ring-inset ring-zinc-300 transition-colors hover:bg-zinc-50"
        >
          Criar um post primeiro
        </Link>
      </div>
      <p className="mt-3 text-xs text-zinc-500">
        Requer conta profissional do Instagram. Publicamos: {INSTAGRAM_PUBLISHING.supported.map((item) => item.label.toLowerCase()).join(", ")}.
      </p>
    </section>
  );
}
