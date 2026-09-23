import Link from "next/link";
import { CalendarClock, PenLine, Send, Sparkles } from "lucide-react";
import { INSTAGRAM_PUBLISHING } from "@/data/instagram";

const primaryClass =
  "inline-flex min-h-11 items-center justify-center rounded-md bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700";
const secondaryClass =
  "inline-flex min-h-11 items-center justify-center rounded-md bg-white px-4 py-2.5 text-sm font-semibold text-zinc-900 ring-1 ring-inset ring-zinc-300 transition-colors hover:bg-zinc-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700";

/** Etapas "Crie → Personalize → Publique" (horizontal no desktop, vertical no celular). */
export function HowPublishingWorks() {
  const steps = [
    { icon: PenLine, title: "1. Crie", body: "Monte seu post, carrossel ou Reel com templates prontos." },
    { icon: Sparkles, title: "2. Personalize", body: "Adicione sua foto, textos e a legenda. Baixe grátis, sem login." },
    { icon: Send, title: "3. Publique", body: "Conecte seu Instagram e publique agora ou agende para depois." },
  ];
  return (
    <ol className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {steps.map((step) => (
        <li key={step.title} className="flex gap-3 rounded-lg border border-zinc-200 bg-white p-4 sm:flex-col sm:gap-2">
          <step.icon className="mt-0.5 h-5 w-5 shrink-0 text-teal-700" aria-hidden />
          <div>
            <p className="text-sm font-semibold text-zinc-900">{step.title}</p>
            <p className="mt-0.5 text-sm text-zinc-600">{step.body}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

/**
 * Card "Publicação automática" da listagem da área Instagram. Aparece para
 * todo mundo (inclusive sem login): a conta só é pedida ao publicar/agendar.
 */
export function AutoPublishingCard() {
  return (
    <div className="flex h-full flex-col gap-4 rounded-lg border border-teal-300 bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-teal-50 text-teal-800">
          <CalendarClock className="h-5 w-5" aria-hidden />
        </span>
        <div>
          <p className="font-semibold text-zinc-900">Publicação automática</p>
          <p className="mt-1 max-w-xl text-sm text-zinc-600">
            Conecte seu Instagram e publique ou agende posts, carrosséis e Reels direto pelo Alilu. No horário marcado, a
            publicação sai sozinha — mesmo com o site fechado.
          </p>
        </div>
      </div>
      <div className="flex flex-col gap-2 sm:shrink-0 sm:flex-row">
        <Link href={INSTAGRAM_PUBLISHING.schedulePath} className={primaryClass}>
          Agendar post
        </Link>
        <Link href={INSTAGRAM_PUBLISHING.connectPath} className={secondaryClass} prefetch={false}>
          Conectar Instagram
        </Link>
      </div>
    </div>
  );
}

/** Chamada compacta para a home: sem virar propaganda, no mesmo visual das seções. */
export function HomePublishingPromo() {
  return (
    <div className="flex flex-col gap-4 rounded-lg border border-zinc-200 bg-white p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
      <div className="flex gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-teal-50 text-teal-800">
          <Send className="h-5 w-5" aria-hidden />
        </span>
        <div>
          <h2 className="text-lg font-semibold text-zinc-900">Crie e publique no Instagram</h2>
          <p className="mt-1 max-w-xl text-sm text-zinc-600">
            Monte posts, carrosséis e Reels de graça e, quando quiser, conecte sua conta para publicar na hora ou agendar.
          </p>
        </div>
      </div>
      <div className="flex flex-col gap-2 sm:shrink-0 sm:flex-row">
        <Link href="/instagram/criar-post" className={primaryClass}>
          Criar post agora
        </Link>
        <Link href="/instagram#publicacao-automatica" className={secondaryClass}>
          Conhecer publicação automática
        </Link>
      </div>
    </div>
  );
}
