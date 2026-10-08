"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Gift, Plus } from "lucide-react";
import { LinkButton } from "@/components/ui/Button";
import { STATUS_LABEL, call, cardClass, formatDateBr } from "./api";

interface GroupItem {
  id: string;
  name: string;
  eventDate: string | null;
  status: string;
  isOwner: boolean;
  participantCount: number;
  acceptedCount: number;
}
interface Invite {
  token: string;
  groupName: string;
  eventDate: string | null;
  ownerName: string | null;
}
export interface HomeData {
  active: GroupItem[];
  completed: GroupItem[];
  invites: Invite[];
}
interface Notice {
  id: string;
  groupId: string | null;
  title: string;
  read: boolean;
}

type Tab = "active" | "completed" | "invites";

function GroupCard({ g }: { g: GroupItem }) {
  return (
    <li>
      <Link href={`/amigo-secreto/${g.id}`} className={`${cardClass} block hover:border-rose-300`}>
        <div className="flex items-start justify-between gap-3">
          <p className="font-semibold text-zinc-900">{g.name}</p>
          <span className="shrink-0 rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-medium text-rose-800">{STATUS_LABEL[g.status] ?? g.status}</span>
        </div>
        <p className="mt-1 text-sm text-zinc-600">
          {g.eventDate ? `${formatDateBr(g.eventDate)} · ` : ""}
          {g.acceptedCount} participante{g.acceptedCount === 1 ? "" : "s"}
          {g.participantCount > g.acceptedCount ? ` (${g.participantCount - g.acceptedCount} aguardando)` : ""}
          {g.isOwner ? " · você organiza" : ""}
        </p>
      </Link>
    </li>
  );
}

export function SecretSantaHome({ data }: { data: HomeData }) {
  const [tab, setTab] = useState<Tab>(data.active.length === 0 && data.invites.length > 0 ? "invites" : "active");
  const [notices, setNotices] = useState<Notice[]>([]);

  useEffect(() => {
    let alive = true;
    void call<{ notifications: Notice[] }>("GET", "/api/secret-santa/notifications").then((r) => {
      if (alive && r.data) setNotices(r.data.notifications.filter((n) => !n.read).slice(0, 5));
    });
    return () => {
      alive = false;
    };
  }, []);

  const tabs: Array<{ id: Tab; label: string; count: number }> = [
    { id: "active", label: "Meus grupos", count: data.active.length },
    { id: "completed", label: "Concluídos", count: data.completed.length },
    { id: "invites", label: "Convites", count: data.invites.length },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <LinkButton href="/amigo-secreto/novo">
          <Plus className="h-4 w-4" aria-hidden /> Criar amigo secreto
        </LinkButton>
      </div>

      {notices.length > 0 ? (
        <section aria-label="Avisos" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <ul className="space-y-1">
            {notices.map((n) => (
              <li key={n.id}>
                {n.groupId ? (
                  <Link href={`/amigo-secreto/${n.groupId}`} className="underline">
                    {n.title}
                  </Link>
                ) : (
                  n.title
                )}
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="mt-2 text-xs font-semibold underline"
            onClick={async () => {
              await call("POST", "/api/secret-santa/notifications");
              setNotices([]);
            }}
          >
            Marcar como lidos
          </button>
        </section>
      ) : null}

      <div role="tablist" className="flex gap-1 rounded-lg bg-zinc-100 p-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`min-h-10 flex-1 rounded-md px-2 text-sm font-medium ${tab === t.id ? "bg-white text-rose-800 shadow-sm" : "text-zinc-600"}`}
          >
            {t.label}
            {t.count ? ` (${t.count})` : ""}
          </button>
        ))}
      </div>

      {tab === "active" ? (
        data.active.length === 0 ? (
          <Empty text="Você ainda não participa de nenhum amigo secreto." />
        ) : (
          <ul className="space-y-3">{data.active.map((g) => <GroupCard key={g.id} g={g} />)}</ul>
        )
      ) : null}
      {tab === "completed" ? (
        data.completed.length === 0 ? (
          <Empty text="Os grupos concluídos aparecem aqui, com o histórico." />
        ) : (
          <ul className="space-y-3">{data.completed.map((g) => <GroupCard key={g.id} g={g} />)}</ul>
        )
      ) : null}
      {tab === "invites" ? (
        data.invites.length === 0 ? (
          <Empty text="Nenhum convite pendente." />
        ) : (
          <ul className="space-y-3">
            {data.invites.map((i) => (
              <li key={i.token}>
                <Link href={`/amigo-secreto/convite/${i.token}`} className={`${cardClass} block hover:border-rose-300`}>
                  <p className="font-semibold text-zinc-900">{i.groupName}</p>
                  <p className="text-sm text-zinc-600">
                    {i.ownerName ? `Convite de ${i.ownerName}` : "Convite"}
                    {i.eventDate ? ` · ${formatDateBr(i.eventDate)}` : ""} — toque para participar
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )
      ) : null}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-dashed border-zinc-300 p-8 text-center">
      <Gift className="mx-auto h-8 w-8 text-rose-700" aria-hidden />
      <p className="mt-2 text-sm text-zinc-600">{text}</p>
    </div>
  );
}
