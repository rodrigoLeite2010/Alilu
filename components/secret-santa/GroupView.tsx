"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarDays, MapPin, Wallet } from "lucide-react";
import { OrganizerPanel } from "./OrganizerPanel";
import { FriendPanel } from "./FriendPanel";
import { MyWishesPanel } from "./MyWishesPanel";
import { PROGRESS_LABEL, STATUS_LABEL, budgetLabel, call, cardClass, formatDateBr } from "./api";

export interface GroupViewData {
  group: {
    id: string;
    name: string;
    description: string | null;
    eventDate: string | null;
    joinDeadline: string | null;
    budgetMinCents: number | null;
    budgetMaxCents: number | null;
    location: string | null;
    rulesText: string | null;
    status: string;
    ownerName: string | null;
    allowAnonymousMessages: boolean;
    allowWishList: boolean;
    allowGiftPreferences: boolean;
    allowParticipantInvites: boolean;
    allowOwnerSeeDraw: boolean;
    allowRedraw: boolean;
    revealMode: string;
    drawn: boolean;
    revealed: boolean;
  };
  isOwner: boolean;
  me: { participantId: string; name: string; progress: string };
  counts: { total: number; accepted: number; pending: number };
  participants: Array<{ id: string; name: string; status: string; isOrganizer: boolean; isMe: boolean }>;
  inviteToken: string | null;
  announcements: Array<{ id: string; body: string; createdAt: string }>;
  restrictions?: Array<{ id: string; participantId: string; cannotDrawParticipantId: string; reason: string | null }>;
  drawPreview?: unknown;
}

type Tab = "friend" | "me" | "group" | "organize";

export function GroupView({ initial }: { initial: GroupViewData }) {
  const [view, setView] = useState<GroupViewData>(initial);
  const g = view.group;
  const hasFriend = g.drawn && g.status !== "CANCELLED";
  const [tab, setTab] = useState<Tab>(hasFriend ? "friend" : view.isOwner ? "organize" : "group");

  const refresh = useCallback(async () => {
    const r = await call<GroupViewData>("GET", `/api/secret-santa/groups/${initial.group.id}`);
    if (r.data) setView(r.data);
  }, [initial.group.id]);

  useEffect(() => {
    const timer = setInterval(() => void refresh(), 30_000);
    return () => clearInterval(timer);
  }, [refresh]);

  const tabs: Array<{ id: Tab; label: string }> = [
    ...(hasFriend ? [{ id: "friend" as const, label: "Quem eu tirei" }] : []),
    { id: "me", label: "Meus desejos" },
    { id: "group", label: "Grupo" },
    ...(view.isOwner ? [{ id: "organize" as const, label: "Organizar" }] : []),
  ];
  const budget = budgetLabel(g.budgetMinCents, g.budgetMaxCents);

  return (
    <div className="space-y-5">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold text-zinc-900">{g.name}</h1>
          <span className="rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-medium text-rose-800">{STATUS_LABEL[g.status] ?? g.status}</span>
        </div>
        {g.description ? <p className="text-sm text-zinc-600">{g.description}</p> : null}
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-zinc-600">
          {g.eventDate ? (
            <li className="flex items-center gap-1">
              <CalendarDays className="h-4 w-4" aria-hidden /> {formatDateBr(g.eventDate)}
            </li>
          ) : null}
          {g.location ? (
            <li className="flex items-center gap-1">
              <MapPin className="h-4 w-4" aria-hidden /> {g.location}
            </li>
          ) : null}
          {budget ? (
            <li className="flex items-center gap-1">
              <Wallet className="h-4 w-4" aria-hidden /> {budget}
            </li>
          ) : null}
        </ul>
        <p className="text-sm text-zinc-700">
          {view.counts.total} participante{view.counts.total === 1 ? "" : "s"}, {view.counts.accepted} confirmado{view.counts.accepted === 1 ? "" : "s"}
          {view.counts.pending ? `, ${view.counts.pending} aguardando` : ""} · Seu status:{" "}
          <strong>{PROGRESS_LABEL[view.me.progress] ?? view.me.progress}</strong>
        </p>
      </header>

      {view.announcements.length > 0 ? (
        <aside className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900" aria-label="Aviso do organizador">
          <p className="font-semibold">Aviso do organizador</p>
          <p className="whitespace-pre-wrap">{view.announcements[0].body}</p>
        </aside>
      ) : null}

      <div role="tablist" className="flex gap-1 overflow-x-auto rounded-lg bg-zinc-100 p-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            type="button"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`min-h-10 shrink-0 flex-1 whitespace-nowrap rounded-md px-3 text-sm font-medium ${tab === t.id ? "bg-white text-rose-800 shadow-sm" : "text-zinc-600"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "friend" && hasFriend ? <FriendPanel groupId={g.id} onChanged={refresh} /> : null}
      {tab === "me" ? <MyWishesPanel groupId={g.id} drawn={g.drawn} messagesEnabled={g.allowAnonymousMessages} /> : null}
      {tab === "group" ? (
        <div className="space-y-4">
          {g.rulesText ? (
            <section className={cardClass}>
              <h3 className="font-semibold text-zinc-900">Regras</h3>
              <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-700">{g.rulesText}</p>
            </section>
          ) : null}
          <section className={cardClass}>
            <h3 className="font-semibold text-zinc-900">Participantes</h3>
            <ul className="mt-2 divide-y divide-zinc-100 text-sm">
              {view.participants.map((p) => (
                <li key={p.id} className="flex items-center justify-between py-1.5">
                  <span>
                    {p.name}
                    {p.isMe ? " (você)" : ""}
                    {p.isOrganizer ? " · organizador" : ""}
                  </span>
                  <span className="text-xs text-zinc-500">{p.status === "ACCEPTED" ? "Confirmado" : "Aguardando"}</span>
                </li>
              ))}
            </ul>
          </section>
          {g.revealed ? <RevealedResults groupId={g.id} /> : null}
          {view.announcements.length > 1 ? (
            <section className={cardClass}>
              <h3 className="font-semibold text-zinc-900">Avisos anteriores</h3>
              <ul className="mt-2 space-y-2 text-sm text-zinc-700">
                {view.announcements.slice(1).map((a) => (
                  <li key={a.id}>{a.body}</li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      ) : null}
      {tab === "organize" && view.isOwner ? <OrganizerPanel view={view} onChanged={refresh} /> : null}
    </div>
  );
}

function RevealedResults({ groupId }: { groupId: string }) {
  const [pairs, setPairs] = useState<Array<{ giverName: string; receiverName: string }> | null>(null);
  useEffect(() => {
    let alive = true;
    void call<{ pairs: Array<{ giverName: string; receiverName: string }> }>("GET", `/api/secret-santa/groups/${groupId}/reveal`).then((r) => {
      if (alive && r.data) setPairs(r.data.pairs);
    });
    return () => {
      alive = false;
    };
  }, [groupId]);
  if (!pairs) return null;
  return (
    <section className={cardClass}>
      <h3 className="font-semibold text-zinc-900">🎉 Revelação: quem tirou quem</h3>
      <ul className="mt-2 divide-y divide-zinc-100 text-sm">
        {pairs.map((p) => (
          <li key={p.giverName} className="py-1.5">
            {p.giverName} → {p.receiverName}
          </li>
        ))}
      </ul>
    </section>
  );
}
