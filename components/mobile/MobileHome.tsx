"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { useHeaderAuth } from "@/components/layout/useHeaderAuth";
import { MobileActionGrid } from "@/components/mobile/MobileActionGrid";
import { MobileBottomSheet } from "@/components/mobile/MobileBottomSheet";
import { MobileLinkList } from "@/components/mobile/MobileLinkList";
import { MobileCardList, MobileStatusCard } from "@/components/mobile/MobileCardList";
import type { MobileStatus } from "@/components/mobile/MobileStatusBadge";
import { formatWhen } from "@/components/mobile/format";
import { homeActionLinks, moreToolsLinks, videoLinks } from "@/components/mobile/mobile-links";
import { useIsMobile } from "@/components/mobile/useIsMobile";
import { useMobileBilling } from "@/components/mobile/useMobileBilling";
import { MobileBillingAlert, MobilePlanCard, MobilePlanTeaser, topBillingNotice } from "@/components/mobile/MobilePlanCard";
import {
  useMobileHomeData,
  type MobileAutomationItem,
  type MobilePostItem,
} from "@/components/mobile/useMobileHomeData";

const AUTOMATION_PATH = "/instagram/piloto-automatico";
const PUBLICATIONS_PATH = "/instagram/painel/calendario";

const postTypeLabel: Record<MobilePostItem["postType"], string> = {
  image: "Post",
  carousel: "Carrossel",
  reels: "Reel",
  story: "Story",
};

const postStatus: Record<MobilePostItem["status"], MobileStatus | null> = {
  PUBLISHED: "published",
  SCHEDULED: "scheduled",
  PROCESSING: "processing",
  FAILED: "error",
  NEEDS_REVIEW: "review",
  DRAFT: "draft",
  CANCELLED: null,
};

function postTitle(post: MobilePostItem) {
  const caption = post.caption.trim().replace(/\s+/g, " ");
  const label = postTypeLabel[post.postType];
  if (!caption) return label;
  return `${label} · ${caption.length > 32 ? `${caption.slice(0, 32)}…` : caption}`;
}

function postWhen(post: MobilePostItem) {
  const iso = post.status === "PUBLISHED" ? (post.publishedAt ?? post.createdAt) : (post.scheduledAtUtc ?? post.createdAt);
  return formatWhen(iso, post.timezone);
}

/** Próxima execução entre as automações ativas (a mais cedo). */
function nextAutomation(automations: MobileAutomationItem[]) {
  return automations
    .filter((item) => item.status === "ACTIVE" && item.nextRunAt)
    .sort((a, b) => new Date(a.nextRunAt as string).getTime() - new Date(b.nextRunAt as string).getTime())[0];
}

function AutomationCard({
  loading,
  automations,
}: {
  loading: boolean;
  automations: MobileAutomationItem[] | null;
}) {
  const live = automations?.filter((item) => item.status !== "ARCHIVED") ?? null;
  const hasActive = live?.some((item) => item.status === "ACTIVE") ?? false;
  const next = live ? nextAutomation(live) : undefined;

  let summary: string;
  if (loading) summary = "Carregando…";
  else if (!live) summary = "Publique todo dia sem esforço.";
  else if (live.length === 0) summary = "Nenhuma automação ainda.";
  else summary = hasActive ? "Ativo" : "Pausado";

  return (
    <section aria-labelledby="mobile-home-auto" className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
      <h2 id="mobile-home-auto" className="text-lg font-semibold text-zinc-900">
        Postagens automáticas
      </h2>
      <p className="mt-1 text-sm text-zinc-700">{summary}</p>
      {next?.nextRunAt ? (
        <p className="text-sm text-zinc-600">Próxima: {formatWhen(next.nextRunAt, next.timezone)}</p>
      ) : null}
      <Link
        href={AUTOMATION_PATH}
        className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-md bg-white px-4 py-2.5 text-base font-semibold text-brand-primary ring-1 ring-inset ring-brand-primary/25 transition-colors active:bg-brand-primary-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent"
      >
        {live && live.length === 0 ? "Criar automação" : "Ver automações"}
      </Link>
    </section>
  );
}

function ActivitySection({ posts, loading }: { posts: MobilePostItem[] | null; loading: boolean }) {
  const items = (posts ?? []).filter((post) => postStatus[post.status] !== null).slice(0, 3);

  return (
    <section aria-labelledby="mobile-home-activity">
      <h2 id="mobile-home-activity" className="mb-3 text-lg font-semibold text-zinc-900">
        Últimas atividades
      </h2>
      {loading ? (
        <div aria-hidden className="grid gap-3">
          <div className="h-16 animate-pulse rounded-xl bg-zinc-100" />
          <div className="h-16 animate-pulse rounded-xl bg-zinc-100" />
        </div>
      ) : items.length > 0 ? (
        <MobileCardList label="Últimas atividades">
          {items.map((post) => (
            <MobileStatusCard
              key={post.id}
              title={postTitle(post)}
              status={postStatus[post.status] as MobileStatus}
              meta={postWhen(post)}
              href={PUBLICATIONS_PATH}
              actionLabel="Ver"
            />
          ))}
        </MobileCardList>
      ) : (
        <div className="rounded-xl border border-dashed border-zinc-300 bg-white p-4 text-center">
          <p className="text-sm text-zinc-700">Nenhuma atividade ainda.</p>
          <Link
            href="/instagram/criar-post"
            className="mt-3 inline-flex min-h-11 items-center justify-center rounded-md bg-brand-primary px-4 py-2.5 text-base font-semibold text-white transition-colors active:bg-brand-primary-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent"
          >
            Criar primeiro post
          </Link>
        </div>
      )}
    </section>
  );
}

/**
 * Home do celular (< 768px): saudação, 4 ações principais, resumo do
 * piloto automático, últimas atividades e "Mais ferramentas". No desktop
 * fica oculta por CSS (`md:hidden`) e não busca nenhum dado. Usa as mesmas
 * APIs do painel do Instagram — ver useMobileHomeData.
 */
export function MobileHome() {
  const auth = useHeaderAuth();
  const isMobile = useIsMobile();
  const signedIn = auth.status === "signed-in";
  const { loading, automations, posts } = useMobileHomeData(isMobile && signedIn);
  const billing = useMobileBilling(isMobile && signedIn);
  const billingNotice = topBillingNotice(billing.summary);
  const [moreOpen, setMoreOpen] = useState(false);
  const closeMore = useCallback(() => setMoreOpen(false), []);

  const firstName = auth.status === "signed-in" ? (auth.user.name?.trim() || auth.user.email).split(" ")[0] : null;

  return (
    <div className="space-y-6 px-4 pt-6 pb-8 md:hidden">
      <div>
        <p className="text-2xl font-bold tracking-tight text-brand-primary-dark">{firstName ? `Olá, ${firstName}` : "Olá!"}</p>
        <p className="mt-1 text-base text-zinc-700">O que você quer fazer?</p>
      </div>

      {billingNotice ? <MobileBillingAlert notice={billingNotice} /> : null}

      <MobileActionGrid items={homeActionLinks} />

      <section aria-labelledby="mobile-home-videos">
        <h2 id="mobile-home-videos" className="mb-3 text-lg font-semibold text-zinc-900">
          Vídeos
        </h2>
        <MobileLinkList items={videoLinks} label="Ferramentas de vídeo" />
      </section>

      {signedIn ? (
        <>
          <AutomationCard loading={loading} automations={automations} />
          <MobilePlanCard loading={billing.loading} summary={billing.summary} credits={billing.credits} />
          <ActivitySection posts={posts} loading={loading} />
        </>
      ) : auth.status === "signed-out" ? (
        <>
        <MobilePlanTeaser />
        <section className="rounded-xl border border-brand-primary/15 bg-brand-primary-soft p-4">
          <h2 className="text-lg font-semibold text-brand-primary-dark">Entre para publicar e agendar</h2>
          <p className="mt-1 text-sm text-zinc-700">Criar e baixar é grátis. A conta só é pedida para publicar ou agendar.</p>
          <Link
            href="/entrar"
            className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-md bg-brand-primary px-4 py-2.5 text-base font-semibold text-white transition-colors active:bg-brand-primary-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent"
          >
            Entrar
          </Link>
        </section>
        </>
      ) : null}

      <button
        type="button"
        onClick={() => setMoreOpen(true)}
        aria-haspopup="dialog"
        className="flex min-h-12 w-full items-center justify-between rounded-xl border border-zinc-200 bg-white px-4 text-base font-semibold text-zinc-900 shadow-sm transition-colors active:bg-zinc-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent"
      >
        Mais ferramentas
        <Icon name="chevron-right" className="h-5 w-5 text-zinc-500" />
      </button>

      <MobileBottomSheet open={moreOpen} onClose={closeMore} title="Mais ferramentas">
        <ul className="grid gap-1">
          {moreToolsLinks.map((link) => (
            <li key={`${link.href}-${link.label}`}>
              <Link
                href={link.href}
                onClick={closeMore}
                className="flex min-h-12 items-center gap-3 rounded-lg px-2 py-2 text-base text-zinc-800 transition-colors active:bg-brand-primary-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-zinc-100 text-zinc-600">
                  <Icon name={link.icon} className="h-5 w-5" />
                </span>
                <span className="min-w-0 truncate">{link.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </MobileBottomSheet>
    </div>
  );
}
