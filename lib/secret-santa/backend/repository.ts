import "server-only";
import { getDb } from "@/lib/db/client";
import { MAX_PARTICIPANTS } from "../types";

/**
 * SQL do Amigo Secreto. Regras:
 * - leituras de sorteio SEMPRE por participante autenticado (quem tirou / quem foi tirado), nunca a lista completa
 *   (exceção única: listAllAssignments, usada só após revelação ou pelo organizador com allow_owner_see_draw);
 * - o driver HTTP do Neon não tem BEGIN/COMMIT: cada operação composta é UM comando SQL (CTEs) — tudo ou nada.
 */

type Row = Record<string, unknown>;
const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));
const dateStr = (v: unknown): string | null => {
  if (!v) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).slice(0, 10);
};
const iso = (v: unknown): string | null => {
  if (!v) return null;
  return v instanceof Date ? v.toISOString() : new Date(String(v)).toISOString();
};

// ---------------------------------------------------------------------------
// Grupos
// ---------------------------------------------------------------------------
export interface GroupRecord {
  id: string;
  ownerUserId: string;
  name: string;
  description: string | null;
  eventDate: string | null;
  joinDeadline: string | null;
  budgetMinCents: number | null;
  budgetMaxCents: number | null;
  currency: string;
  location: string | null;
  rulesText: string | null;
  status: string;
  allowAnonymousMessages: boolean;
  allowWishList: boolean;
  allowGiftPreferences: boolean;
  allowParticipantInvites: boolean;
  allowOwnerSeeDraw: boolean;
  allowRedraw: boolean;
  revealMode: string;
  revealAt: string | null;
  avoidPrevious: boolean;
  previousGroupId: string | null;
  inviteToken: string;
  drawVersion: number;
  drawnAt: string | null;
  revealedAt: string | null;
  completedAt: string | null;
}

function mapGroup(r: Row): GroupRecord {
  return {
    id: r.id as string,
    ownerUserId: r.owner_user_id as string,
    name: r.name as string,
    description: (r.description as string | null) ?? null,
    eventDate: dateStr(r.event_date),
    joinDeadline: dateStr(r.join_deadline),
    budgetMinCents: num(r.budget_min_cents),
    budgetMaxCents: num(r.budget_max_cents),
    currency: r.currency as string,
    location: (r.location as string | null) ?? null,
    rulesText: (r.rules_text as string | null) ?? null,
    status: r.status as string,
    allowAnonymousMessages: Boolean(r.allow_anonymous_messages),
    allowWishList: Boolean(r.allow_wish_list),
    allowGiftPreferences: Boolean(r.allow_gift_preferences),
    allowParticipantInvites: Boolean(r.allow_participant_invites),
    allowOwnerSeeDraw: Boolean(r.allow_owner_see_draw),
    allowRedraw: Boolean(r.allow_redraw),
    revealMode: r.reveal_mode as string,
    revealAt: dateStr(r.reveal_at),
    avoidPrevious: Boolean(r.avoid_previous),
    previousGroupId: (r.previous_group_id as string | null) ?? null,
    inviteToken: r.invite_token as string,
    drawVersion: Number(r.draw_version),
    drawnAt: iso(r.drawn_at),
    revealedAt: iso(r.revealed_at),
    completedAt: iso(r.completed_at),
  };
}

export type GroupFields = Omit<GroupRecord, "id" | "ownerUserId" | "status" | "inviteToken" | "drawVersion" | "drawnAt" | "revealedAt" | "completedAt">;

export interface ParticipantRecord {
  id: string;
  groupId: string;
  userId: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  inviteToken: string;
  status: string;
  isOrganizer: boolean;
  copiedFromParticipantId: string | null;
}

function mapParticipant(r: Row): ParticipantRecord {
  return {
    id: r.id as string,
    groupId: r.group_id as string,
    userId: (r.user_id as string | null) ?? null,
    name: r.name as string,
    email: (r.email as string | null) ?? null,
    phone: (r.phone as string | null) ?? null,
    inviteToken: r.invite_token as string,
    status: r.status as string,
    isOrganizer: Boolean(r.is_organizer),
    copiedFromParticipantId: (r.copied_from_participant_id as string | null) ?? null,
  };
}

/** Cria o grupo e a participação do organizador num único comando. */
export async function insertGroupWithOwner(
  ownerUserId: string,
  fields: GroupFields,
  owner: { name: string; email: string | null },
  tokens: { group: string; participant: string },
): Promise<GroupRecord> {
  const rows = await getDb()`
    with g as (
      insert into secret_santa_groups (owner_user_id, name, description, event_date, join_deadline, budget_min_cents, budget_max_cents,
        currency, location, rules_text, allow_anonymous_messages, allow_wish_list, allow_gift_preferences, allow_participant_invites,
        allow_owner_see_draw, allow_redraw, reveal_mode, reveal_at, avoid_previous, previous_group_id, invite_token)
      values (${ownerUserId}, ${fields.name}, ${fields.description}, ${fields.eventDate}, ${fields.joinDeadline}, ${fields.budgetMinCents},
        ${fields.budgetMaxCents}, ${fields.currency}, ${fields.location}, ${fields.rulesText}, ${fields.allowAnonymousMessages},
        ${fields.allowWishList}, ${fields.allowGiftPreferences}, ${fields.allowParticipantInvites}, ${fields.allowOwnerSeeDraw},
        ${fields.allowRedraw}, ${fields.revealMode}, ${fields.revealAt}, ${fields.avoidPrevious}, ${fields.previousGroupId}, ${tokens.group})
      returning *
    ), p as (
      insert into secret_santa_participants (group_id, user_id, name, email, invite_token, status, is_organizer, joined_at, confirmed_at)
      select id, ${ownerUserId}, ${owner.name}, ${owner.email}, ${tokens.participant}, 'ACCEPTED', true, now(), now() from g
      returning id
    )
    select g.*, (select count(*) from p) as _p from g
  `;
  return mapGroup(rows[0]);
}

export async function getGroup(groupId: string): Promise<GroupRecord | null> {
  const rows = await getDb()`select * from secret_santa_groups where id = ${groupId}`;
  return rows[0] ? mapGroup(rows[0]) : null;
}

export async function getGroupByToken(token: string): Promise<GroupRecord | null> {
  const rows = await getDb()`select * from secret_santa_groups where invite_token = ${token}`;
  return rows[0] ? mapGroup(rows[0]) : null;
}

export async function updateGroupFields(groupId: string, f: GroupFields): Promise<GroupRecord | null> {
  const rows = await getDb()`
    update secret_santa_groups set name = ${f.name}, description = ${f.description}, event_date = ${f.eventDate},
      join_deadline = ${f.joinDeadline}, budget_min_cents = ${f.budgetMinCents}, budget_max_cents = ${f.budgetMaxCents},
      location = ${f.location}, rules_text = ${f.rulesText}, allow_anonymous_messages = ${f.allowAnonymousMessages},
      allow_wish_list = ${f.allowWishList}, allow_gift_preferences = ${f.allowGiftPreferences},
      allow_participant_invites = ${f.allowParticipantInvites}, allow_owner_see_draw = ${f.allowOwnerSeeDraw},
      allow_redraw = ${f.allowRedraw}, reveal_mode = ${f.revealMode}, reveal_at = ${f.revealAt},
      avoid_previous = ${f.avoidPrevious}, previous_group_id = ${f.previousGroupId}, updated_at = now()
    where id = ${groupId} returning *`;
  return rows[0] ? mapGroup(rows[0]) : null;
}

export async function setGroupStatus(groupId: string, from: string[], to: string): Promise<GroupRecord | null> {
  const rows = await getDb()`
    update secret_santa_groups set status = ${to}, updated_at = now(),
      completed_at = case when ${to} = 'COMPLETED' then now() else completed_at end
    where id = ${groupId} and status in (select jsonb_array_elements_text(${JSON.stringify(from)}::jsonb)) returning *`;
  return rows[0] ? mapGroup(rows[0]) : null;
}

export async function markRevealed(groupId: string): Promise<GroupRecord | null> {
  const rows = await getDb()`
    update secret_santa_groups set revealed_at = coalesce(revealed_at, now()), updated_at = now()
    where id = ${groupId} and status in ('DRAWN', 'COMPLETED') returning *`;
  return rows[0] ? mapGroup(rows[0]) : null;
}

export interface GroupListItem {
  id: string;
  name: string;
  eventDate: string | null;
  status: string;
  isOwner: boolean;
  participantCount: number;
  acceptedCount: number;
}

export async function listGroupsForUser(userId: string): Promise<GroupListItem[]> {
  const rows = await getDb()`
    select g.id, g.name, g.event_date, g.status, (g.owner_user_id = ${userId}) as is_owner,
      (select count(*) from secret_santa_participants x where x.group_id = g.id and x.status in ('INVITED', 'ACCEPTED')) as participant_count,
      (select count(*) from secret_santa_participants x where x.group_id = g.id and x.status = 'ACCEPTED') as accepted_count
    from secret_santa_groups g
    join secret_santa_participants p on p.group_id = g.id and p.user_id = ${userId} and p.status = 'ACCEPTED'
    order by g.created_at desc limit 100`;
  return rows.map((r) => ({
    id: r.id as string,
    name: r.name as string,
    eventDate: dateStr(r.event_date),
    status: r.status as string,
    isOwner: Boolean(r.is_owner),
    participantCount: Number(r.participant_count),
    acceptedCount: Number(r.accepted_count),
  }));
}

export interface PendingInvite {
  token: string;
  groupName: string;
  eventDate: string | null;
  ownerName: string | null;
}

/** Convites pendentes do usuário: vinculados à conta (grupo duplicado) ou ao e-mail dele. */
export async function listPendingInvites(userId: string, email: string | null): Promise<PendingInvite[]> {
  const rows = await getDb()`
    select p.invite_token, g.name, g.event_date,
      (select u.name from users u where u.id = g.owner_user_id) as owner_name
    from secret_santa_participants p
    join secret_santa_groups g on g.id = p.group_id
    where p.status = 'INVITED' and g.status in ('OPEN', 'READY_TO_DRAW')
      and (p.user_id = ${userId} or (p.user_id is null and ${email}::text is not null and lower(p.email) = lower(${email}::text)))
    order by p.created_at desc limit 50`;
  return rows.map((r) => ({
    token: r.invite_token as string,
    groupName: r.name as string,
    eventDate: dateStr(r.event_date),
    ownerName: (r.owner_name as string | null) ?? null,
  }));
}

export async function getUserBasics(userId: string): Promise<{ name: string | null; email: string | null } | null> {
  const rows = await getDb()`select name, email from users where id = ${userId}`;
  return rows[0] ? { name: (rows[0].name as string | null) ?? null, email: (rows[0].email as string | null) ?? null } : null;
}

export async function getOwnerName(ownerUserId: string): Promise<string | null> {
  const rows = await getDb()`select coalesce(name, split_part(email, '@', 1)) as n from users where id = ${ownerUserId}`;
  return (rows[0]?.n as string | undefined) ?? null;
}

// ---------------------------------------------------------------------------
// Participantes
// ---------------------------------------------------------------------------
export async function listParticipants(groupId: string): Promise<ParticipantRecord[]> {
  const rows = await getDb()`
    select * from secret_santa_participants where group_id = ${groupId} and status <> 'REMOVED' order by is_organizer desc, created_at, id`;
  return rows.map(mapParticipant);
}

export async function getParticipant(participantId: string): Promise<ParticipantRecord | null> {
  const rows = await getDb()`select * from secret_santa_participants where id = ${participantId}`;
  return rows[0] ? mapParticipant(rows[0]) : null;
}

export async function getParticipantByToken(token: string): Promise<ParticipantRecord | null> {
  const rows = await getDb()`select * from secret_santa_participants where invite_token = ${token}`;
  return rows[0] ? mapParticipant(rows[0]) : null;
}

/** Participação ATIVA do usuário no grupo (aceita). */
export async function getMyParticipant(groupId: string, userId: string): Promise<ParticipantRecord | null> {
  const rows = await getDb()`
    select * from secret_santa_participants where group_id = ${groupId} and user_id = ${userId} and status = 'ACCEPTED'`;
  return rows[0] ? mapParticipant(rows[0]) : null;
}

export async function getUserParticipantAnyActive(groupId: string, userId: string): Promise<ParticipantRecord | null> {
  const rows = await getDb()`
    select * from secret_santa_participants where group_id = ${groupId} and user_id = ${userId} and status in ('INVITED', 'ACCEPTED')`;
  return rows[0] ? mapParticipant(rows[0]) : null;
}

export interface NewParticipant {
  name: string;
  email: string | null;
  phone: string | null;
  inviteToken: string;
  status: "INVITED" | "ACCEPTED";
  userId: string | null;
  copiedFromParticipantId?: string | null;
}

/** Insere só se o grupo ainda aceita participantes (aberto) e há vaga. */
export async function insertParticipant(groupId: string, p: NewParticipant): Promise<ParticipantRecord | null> {
  const rows = await getDb()`
    insert into secret_santa_participants (group_id, user_id, name, email, phone, invite_token, status, copied_from_participant_id, joined_at, confirmed_at)
    select g.id, ${p.userId}, ${p.name}, ${p.email}, ${p.phone}, ${p.inviteToken}, ${p.status}, ${p.copiedFromParticipantId ?? null},
      case when ${p.status} = 'ACCEPTED' then now() end, case when ${p.status} = 'ACCEPTED' then now() end
    from secret_santa_groups g
    where g.id = ${groupId} and g.status in ('OPEN', 'READY_TO_DRAW', 'DRAFT')
      and (select count(*) from secret_santa_participants x where x.group_id = g.id and x.status in ('INVITED', 'ACCEPTED')) < ${MAX_PARTICIPANTS}
    returning *`;
  return rows[0] ? mapParticipant(rows[0]) : null;
}

/** Aceita o convite (vincula a conta). Só com grupo aberto e convite livre ou da mesma conta. */
export async function acceptParticipant(participantId: string, userId: string): Promise<ParticipantRecord | null> {
  const rows = await getDb()`
    update secret_santa_participants p set user_id = ${userId}, status = 'ACCEPTED', joined_at = coalesce(p.joined_at, now()),
      confirmed_at = now(), updated_at = now()
    where p.id = ${participantId} and p.status in ('INVITED', 'DECLINED') and (p.user_id is null or p.user_id = ${userId})
      and exists (select 1 from secret_santa_groups g where g.id = p.group_id and g.status in ('OPEN', 'READY_TO_DRAW'))
    returning *`;
  return rows[0] ? mapParticipant(rows[0]) : null;
}

export async function setParticipantStatus(participantId: string, groupId: string, to: "DECLINED" | "REMOVED"): Promise<ParticipantRecord | null> {
  const rows = await getDb()`
    update secret_santa_participants p set status = ${to}, updated_at = now()
    where p.id = ${participantId} and p.group_id = ${groupId} and p.is_organizer = false and p.status in ('INVITED', 'ACCEPTED')
      and exists (select 1 from secret_santa_groups g where g.id = p.group_id and g.status in ('OPEN', 'READY_TO_DRAW', 'DRAFT'))
    returning *`;
  return rows[0] ? mapParticipant(rows[0]) : null;
}

// ---------------------------------------------------------------------------
// Restrições
// ---------------------------------------------------------------------------
export interface RestrictionRecord {
  id: string;
  participantId: string;
  cannotDrawParticipantId: string;
  reason: string | null;
}

export async function listRestrictions(groupId: string): Promise<RestrictionRecord[]> {
  const rows = await getDb()`
    select id, participant_id, cannot_draw_participant_id, reason from secret_santa_restrictions where group_id = ${groupId} order by created_at, id`;
  return rows.map((r) => ({
    id: r.id as string,
    participantId: r.participant_id as string,
    cannotDrawParticipantId: r.cannot_draw_participant_id as string,
    reason: (r.reason as string | null) ?? null,
  }));
}

/** Insere em lote (jsonb) só pares de participantes do grupo, com grupo ainda não sorteado. */
export async function insertRestrictions(groupId: string, pairs: Array<{ from: string; to: string }>, reason: string | null): Promise<number> {
  if (pairs.length === 0) return 0;
  const json = JSON.stringify(pairs);
  const rows = await getDb()`
    with ins as (
      insert into secret_santa_restrictions (group_id, participant_id, cannot_draw_participant_id, reason)
      select ${groupId}, t."from", t."to", ${reason}
      from jsonb_to_recordset(${json}::jsonb) as t("from" uuid, "to" uuid)
      where t."from" <> t."to"
        and exists (select 1 from secret_santa_groups g where g.id = ${groupId} and g.status in ('OPEN', 'READY_TO_DRAW', 'DRAFT'))
        and exists (select 1 from secret_santa_participants a where a.id = t."from" and a.group_id = ${groupId} and a.status <> 'REMOVED')
        and exists (select 1 from secret_santa_participants b where b.id = t."to" and b.group_id = ${groupId} and b.status <> 'REMOVED')
      on conflict (participant_id, cannot_draw_participant_id) do nothing
      returning 1
    ) select count(*)::int as n from ins`;
  return Number(rows[0].n);
}

export async function deleteRestriction(groupId: string, restrictionId: string): Promise<boolean> {
  const rows = await getDb()`
    delete from secret_santa_restrictions r where r.id = ${restrictionId} and r.group_id = ${groupId}
      and exists (select 1 from secret_santa_groups g where g.id = ${groupId} and g.status in ('OPEN', 'READY_TO_DRAW', 'DRAFT'))
    returning 1`;
  return rows.length > 0;
}

// ---------------------------------------------------------------------------
// Sorteio
// ---------------------------------------------------------------------------
/** Pares do sorteio ativo de OUTRO grupo do mesmo organizador (para "não repetir o ano passado"). */
export async function listPreviousAssignmentPairs(previousGroupId: string, ownerUserId: string): Promise<Array<{ giver: string; receiver: string }>> {
  const rows = await getDb()`
    select a.giver_participant_id as g, a.receiver_participant_id as r
    from secret_santa_assignments a join secret_santa_groups pg on pg.id = a.group_id
    where a.group_id = ${previousGroupId} and pg.owner_user_id = ${ownerUserId} and a.invalidated_at is null and a.draw_version = pg.draw_version`;
  return rows.map((r) => ({ giver: r.g as string, receiver: r.r as string }));
}

/**
 * Grava o sorteio inteiro (e invalida a versão anterior) em UM comando: ou tudo ou nada.
 * Guardas dentro do próprio comando: dono, estado, versão esperada (otimista) e conjunto exato de aceitos.
 */
export async function persistDraw(
  groupId: string,
  ownerUserId: string,
  expectedVersion: number,
  pairs: Array<{ g: string; r: string }>,
): Promise<{ version: number; inserted: number } | null> {
  const json = JSON.stringify(pairs);
  const n = pairs.length;
  const rows = await getDb()`
    with grp as (
      select g.id from secret_santa_groups g
      where g.id = ${groupId} and g.owner_user_id = ${ownerUserId} and g.draw_version = ${expectedVersion}
        and (g.status in ('OPEN', 'READY_TO_DRAW') or (g.status = 'DRAWN' and g.allow_redraw))
        and (select count(*) from secret_santa_participants p where p.group_id = g.id and p.status = 'ACCEPTED') = ${n}
        and not exists (
          select 1 from jsonb_to_recordset(${json}::jsonb) as t(g uuid, r uuid)
          where not exists (select 1 from secret_santa_participants p where p.id = t.g and p.group_id = ${groupId} and p.status = 'ACCEPTED')
             or not exists (select 1 from secret_santa_participants p where p.id = t.r and p.group_id = ${groupId} and p.status = 'ACCEPTED'))
      for update
    ), upd as (
      update secret_santa_groups set status = 'DRAWN', draw_version = draw_version + 1, drawn_at = now(), revealed_at = null, updated_at = now()
      where id in (select id from grp) returning draw_version
    ), inv as (
      update secret_santa_assignments set invalidated_at = now()
      where group_id = ${groupId} and invalidated_at is null and exists (select 1 from grp) returning 1
    ), ins as (
      insert into secret_santa_assignments (group_id, giver_participant_id, receiver_participant_id, draw_version)
      select ${groupId}, t.g, t.r, (select draw_version from upd)
      from jsonb_to_recordset(${json}::jsonb) as t(g uuid, r uuid)
      where exists (select 1 from upd)
      returning 1
    )
    select (select draw_version from upd) as version, (select count(*) from ins)::int as inserted, (select count(*) from inv)::int as invalidated`;
  const row = rows[0];
  if (!row || row.version === null || row.version === undefined) return null;
  return { version: Number(row.version), inserted: Number(row.inserted) };
}

/** Invalida o sorteio ativo e reabre o grupo (um comando só). */
export async function invalidateDraw(groupId: string, ownerUserId: string): Promise<boolean> {
  const rows = await getDb()`
    with grp as (
      select id from secret_santa_groups where id = ${groupId} and owner_user_id = ${ownerUserId} and status = 'DRAWN' and allow_redraw for update
    ), upd as (
      update secret_santa_groups set status = 'OPEN', revealed_at = null, drawn_at = null, updated_at = now() where id in (select id from grp) returning id
    ), inv as (
      update secret_santa_assignments set invalidated_at = now() where group_id = ${groupId} and invalidated_at is null and exists (select 1 from upd) returning 1
    )
    select (select count(*) from upd)::int as n, (select count(*) from inv)::int as m`;
  return Number(rows[0]?.n) > 0;
}

export interface AssignmentRef {
  id: string;
  counterpartParticipantId: string;
}

/** O que EU tirei (apenas a atribuição em que sou o doador). */
export async function getMyGiverAssignment(groupId: string, participantId: string): Promise<AssignmentRef | null> {
  const rows = await getDb()`
    select a.id, a.receiver_participant_id as other from secret_santa_assignments a join secret_santa_groups g on g.id = a.group_id
    where a.group_id = ${groupId} and a.giver_participant_id = ${participantId} and a.invalidated_at is null and a.draw_version = g.draw_version
      and g.status in ('DRAWN', 'COMPLETED')`;
  return rows[0] ? { id: rows[0].id as string, counterpartParticipantId: rows[0].other as string } : null;
}

/** Só o id da atribuição em que eu sou o sorteado. NUNCA devolve quem me tirou. */
export async function getMyReceiverAssignmentId(groupId: string, participantId: string): Promise<string | null> {
  const rows = await getDb()`
    select a.id from secret_santa_assignments a join secret_santa_groups g on g.id = a.group_id
    where a.group_id = ${groupId} and a.receiver_participant_id = ${participantId} and a.invalidated_at is null and a.draw_version = g.draw_version
      and g.status in ('DRAWN', 'COMPLETED')`;
  return (rows[0]?.id as string | undefined) ?? null;
}

/** Exposição completa — só chamar depois de checar revelação ou allow_owner_see_draw. */
export async function listAllAssignments(groupId: string): Promise<Array<{ giverName: string; receiverName: string }>> {
  const rows = await getDb()`
    select gp.name as giver_name, rp.name as receiver_name
    from secret_santa_assignments a
    join secret_santa_groups g on g.id = a.group_id
    join secret_santa_participants gp on gp.id = a.giver_participant_id
    join secret_santa_participants rp on rp.id = a.receiver_participant_id
    where a.group_id = ${groupId} and a.invalidated_at is null and a.draw_version = g.draw_version
    order by gp.name`;
  return rows.map((r) => ({ giverName: r.giver_name as string, receiverName: r.receiver_name as string }));
}

export async function countDrawHistory(groupId: string): Promise<Array<{ version: number; active: boolean; participants: number }>> {
  const rows = await getDb()`
    select draw_version, bool_and(invalidated_at is null) as active, count(*)::int as n
    from secret_santa_assignments where group_id = ${groupId} group by draw_version order by draw_version`;
  return rows.map((r) => ({ version: Number(r.draw_version), active: Boolean(r.active), participants: Number(r.n) }));
}

export async function userIdOfParticipant(participantId: string): Promise<string | null> {
  const rows = await getDb()`select user_id from secret_santa_participants where id = ${participantId}`;
  return (rows[0]?.user_id as string | undefined) ?? null;
}

export async function userIdsOfAcceptedParticipants(groupId: string, exceptUserId?: string): Promise<string[]> {
  const rows = await getDb()`
    select user_id from secret_santa_participants where group_id = ${groupId} and status = 'ACCEPTED' and user_id is not null
      and (${exceptUserId ?? null}::uuid is null or user_id <> ${exceptUserId ?? null}::uuid)`;
  return rows.map((r) => r.user_id as string);
}

// ---------------------------------------------------------------------------
// Desejos e preferências
// ---------------------------------------------------------------------------
export interface WishRecord {
  id: string;
  participantId: string;
  title: string;
  description: string | null;
  url: string | null;
  estimatedPriceCents: number | null;
  priority: number;
  purchased: boolean;
  publicToGroup: boolean;
}

function mapWish(r: Row): WishRecord {
  return {
    id: r.id as string,
    participantId: r.participant_id as string,
    title: r.title as string,
    description: (r.description as string | null) ?? null,
    url: (r.url as string | null) ?? null,
    estimatedPriceCents: num(r.estimated_price_cents),
    priority: Number(r.priority),
    purchased: Boolean(r.purchased),
    publicToGroup: Boolean(r.public_to_group),
  };
}

export async function listWishesOf(groupId: string, participantId: string): Promise<WishRecord[]> {
  const rows = await getDb()`
    select * from secret_santa_wishes where group_id = ${groupId} and participant_id = ${participantId} order by priority, created_at, id`;
  return rows.map(mapWish);
}

export async function listPublicWishesOfOthers(groupId: string, participantId: string): Promise<Array<WishRecord & { ownerName: string }>> {
  const rows = await getDb()`
    select w.*, p.name as owner_name from secret_santa_wishes w join secret_santa_participants p on p.id = w.participant_id
    where w.group_id = ${groupId} and w.public_to_group and w.participant_id <> ${participantId} and p.status = 'ACCEPTED'
    order by p.name, w.priority, w.created_at limit 300`;
  return rows.map((r) => ({ ...mapWish(r), ownerName: r.owner_name as string }));
}

export async function countWishes(participantId: string): Promise<number> {
  const rows = await getDb()`select count(*)::int as n from secret_santa_wishes where participant_id = ${participantId}`;
  return Number(rows[0].n);
}

export async function insertWish(
  groupId: string,
  participantId: string,
  w: { title: string; description: string | null; url: string | null; estimatedPriceCents: number | null; priority: number; publicToGroup: boolean },
): Promise<WishRecord> {
  const rows = await getDb()`
    insert into secret_santa_wishes (group_id, participant_id, title, description, url, estimated_price_cents, priority, public_to_group)
    values (${groupId}, ${participantId}, ${w.title}, ${w.description}, ${w.url}, ${w.estimatedPriceCents}, ${w.priority}, ${w.publicToGroup}) returning *`;
  return mapWish(rows[0]);
}

export async function updateWish(
  wishId: string,
  participantId: string,
  w: { title: string; description: string | null; url: string | null; estimatedPriceCents: number | null; priority: number; publicToGroup: boolean },
): Promise<WishRecord | null> {
  const rows = await getDb()`
    update secret_santa_wishes set title = ${w.title}, description = ${w.description}, url = ${w.url}, estimated_price_cents = ${w.estimatedPriceCents},
      priority = ${w.priority}, public_to_group = ${w.publicToGroup}, updated_at = now()
    where id = ${wishId} and participant_id = ${participantId} returning *`;
  return rows[0] ? mapWish(rows[0]) : null;
}

export async function deleteWish(wishId: string, participantId: string): Promise<boolean> {
  const rows = await getDb()`delete from secret_santa_wishes where id = ${wishId} and participant_id = ${participantId} returning 1`;
  return rows.length > 0;
}

export async function getWish(wishId: string, groupId: string): Promise<WishRecord | null> {
  const rows = await getDb()`select * from secret_santa_wishes where id = ${wishId} and group_id = ${groupId}`;
  return rows[0] ? mapWish(rows[0]) : null;
}

export async function setWishPurchased(wishId: string, purchased: boolean): Promise<void> {
  await getDb()`update secret_santa_wishes set purchased = ${purchased}, purchased_at = case when ${purchased} then now() end where id = ${wishId}`;
}

export interface PreferencesRecord {
  clothingSize: string | null;
  shoeSize: string | null;
  favoriteColors: string | null;
  likes: string | null;
  avoid: string | null;
  notes: string | null;
}

function mapPrefs(r: Row): PreferencesRecord {
  const s = (k: string) => (r[k] as string | null) ?? null;
  return {
    clothingSize: s("clothing_size"),
    shoeSize: s("shoe_size"),
    favoriteColors: s("favorite_colors"),
    likes: s("likes"),
    avoid: s("avoid"),
    notes: s("notes"),
  };
}

export async function getPreferences(groupId: string, participantId: string): Promise<PreferencesRecord | null> {
  const rows = await getDb()`select * from secret_santa_gift_preferences where group_id = ${groupId} and participant_id = ${participantId}`;
  return rows[0] ? mapPrefs(rows[0]) : null;
}

export async function savePreferences(groupId: string, participantId: string, p: PreferencesRecord): Promise<PreferencesRecord> {
  const rows = await getDb()`
    insert into secret_santa_gift_preferences (group_id, participant_id, clothing_size, shoe_size, favorite_colors, likes, avoid, notes)
    values (${groupId}, ${participantId}, ${p.clothingSize}, ${p.shoeSize}, ${p.favoriteColors}, ${p.likes}, ${p.avoid}, ${p.notes})
    on conflict (group_id, participant_id) do update set clothing_size = excluded.clothing_size, shoe_size = excluded.shoe_size,
      favorite_colors = excluded.favorite_colors, likes = excluded.likes, avoid = excluded.avoid, notes = excluded.notes, updated_at = now()
    returning *`;
  return mapPrefs(rows[0]);
}

// ---------------------------------------------------------------------------
// Conversa anônima e presente
// ---------------------------------------------------------------------------
export interface MessageRecord {
  id: string;
  fromGiver: boolean;
  body: string;
  createdAt: string;
}

export async function listMessages(assignmentId: string): Promise<MessageRecord[]> {
  const rows = await getDb()`
    select id, from_giver, body, created_at from secret_santa_messages where assignment_id = ${assignmentId} order by created_at, id limit 300`;
  return rows.map((r) => ({ id: r.id as string, fromGiver: Boolean(r.from_giver), body: r.body as string, createdAt: iso(r.created_at) as string }));
}

/** Marca como lidas as mensagens da OUTRA ponta (viewerIsGiver → lê as que vieram do sorteado). */
export async function markMessagesRead(assignmentId: string, viewerIsGiver: boolean): Promise<void> {
  await getDb()`update secret_santa_messages set read_at = now() where assignment_id = ${assignmentId} and from_giver = ${!viewerIsGiver} and read_at is null`;
}

export async function countMessages(assignmentId: string): Promise<{ total: number; fromGiver: number }> {
  const rows = await getDb()`
    select count(*)::int as total, count(*) filter (where from_giver)::int as from_giver from secret_santa_messages where assignment_id = ${assignmentId}`;
  return { total: Number(rows[0].total), fromGiver: Number(rows[0].from_giver) };
}

export async function countUnread(assignmentId: string, viewerIsGiver: boolean): Promise<number> {
  const rows = await getDb()`
    select count(*)::int as n from secret_santa_messages where assignment_id = ${assignmentId} and from_giver = ${!viewerIsGiver} and read_at is null`;
  return Number(rows[0].n);
}

export async function insertMessage(assignmentId: string, fromGiver: boolean, body: string): Promise<MessageRecord> {
  const rows = await getDb()`
    insert into secret_santa_messages (assignment_id, from_giver, body) values (${assignmentId}, ${fromGiver}, ${body})
    returning id, from_giver, body, created_at`;
  const r = rows[0];
  return { id: r.id as string, fromGiver: Boolean(r.from_giver), body: r.body as string, createdAt: iso(r.created_at) as string };
}

export interface GiftRecord {
  name: string;
  priceCents: number | null;
  notes: string | null;
  purchased: boolean;
}

export async function getGift(assignmentId: string): Promise<GiftRecord | null> {
  const rows = await getDb()`select name, price_cents, notes, purchased from secret_santa_gifts where assignment_id = ${assignmentId}`;
  const r = rows[0];
  return r ? { name: r.name as string, priceCents: num(r.price_cents), notes: (r.notes as string | null) ?? null, purchased: Boolean(r.purchased) } : null;
}

export async function saveGift(assignmentId: string, g: GiftRecord): Promise<GiftRecord> {
  const rows = await getDb()`
    insert into secret_santa_gifts (assignment_id, name, price_cents, notes, purchased, purchased_at)
    values (${assignmentId}, ${g.name}, ${g.priceCents}, ${g.notes}, ${g.purchased}, case when ${g.purchased} then now() end)
    on conflict (assignment_id) do update set name = excluded.name, price_cents = excluded.price_cents, notes = excluded.notes,
      purchased = excluded.purchased, purchased_at = case when excluded.purchased then coalesce(secret_santa_gifts.purchased_at, now()) end, updated_at = now()
    returning name, price_cents, notes, purchased`;
  const r = rows[0];
  return { name: r.name as string, priceCents: num(r.price_cents), notes: (r.notes as string | null) ?? null, purchased: Boolean(r.purchased) };
}

export async function deleteGift(assignmentId: string): Promise<void> {
  await getDb()`delete from secret_santa_gifts where assignment_id = ${assignmentId}`;
}

// ---------------------------------------------------------------------------
// Avisos, notificações, auditoria
// ---------------------------------------------------------------------------
export interface AnnouncementRecord {
  id: string;
  body: string;
  createdAt: string;
}

export async function listAnnouncements(groupId: string): Promise<AnnouncementRecord[]> {
  const rows = await getDb()`
    select id, body, created_at from secret_santa_announcements where group_id = ${groupId} order by created_at desc limit 30`;
  return rows.map((r) => ({ id: r.id as string, body: r.body as string, createdAt: iso(r.created_at) as string }));
}

export async function insertAnnouncement(groupId: string, authorUserId: string, body: string): Promise<AnnouncementRecord> {
  const rows = await getDb()`
    insert into secret_santa_announcements (group_id, author_user_id, body) values (${groupId}, ${authorUserId}, ${body}) returning id, body, created_at`;
  return { id: rows[0].id as string, body: rows[0].body as string, createdAt: iso(rows[0].created_at) as string };
}

export interface NotificationRecord {
  id: string;
  groupId: string | null;
  type: string;
  title: string;
  body: string | null;
  read: boolean;
  createdAt: string;
}

export async function insertNotifications(userIds: string[], groupId: string | null, type: string, title: string, body: string | null): Promise<void> {
  if (userIds.length === 0) return;
  const json = JSON.stringify(Array.from(new Set(userIds)));
  await getDb()`
    insert into secret_santa_notifications (user_id, group_id, type, title, body)
    select u::uuid, ${groupId}, ${type}, ${title}, ${body} from jsonb_array_elements_text(${json}::jsonb) as u`;
}

export async function listNotifications(userId: string): Promise<NotificationRecord[]> {
  const rows = await getDb()`
    select id, group_id, type, title, body, read_at, created_at from secret_santa_notifications where user_id = ${userId} order by created_at desc limit 40`;
  return rows.map((r) => ({
    id: r.id as string,
    groupId: (r.group_id as string | null) ?? null,
    type: r.type as string,
    title: r.title as string,
    body: (r.body as string | null) ?? null,
    read: r.read_at !== null,
    createdAt: iso(r.created_at) as string,
  }));
}

export async function markNotificationsRead(userId: string): Promise<void> {
  await getDb()`update secret_santa_notifications set read_at = now() where user_id = ${userId} and read_at is null`;
}

export async function insertAudit(groupId: string | null, actorUserId: string | null, event: string, meta: Record<string, unknown> = {}): Promise<void> {
  try {
    await getDb()`insert into secret_santa_audit_events (group_id, actor_user_id, event, meta) values (${groupId}, ${actorUserId}, ${event}, ${JSON.stringify(meta)}::jsonb)`;
  } catch {
    // auditoria nunca derruba a operação
  }
}

export async function countOwnedGroups(userId: string): Promise<number> {
  const rows = await getDb()`select count(*)::int as n from secret_santa_groups where owner_user_id = ${userId} and status <> 'CANCELLED'`;
  return Number(rows[0].n);
}

export async function copyRestrictions(fromGroupId: string, toGroupId: string): Promise<void> {
  await getDb()`
    insert into secret_santa_restrictions (group_id, participant_id, cannot_draw_participant_id, reason)
    select ${toGroupId}, np1.id, np2.id, r.reason
    from secret_santa_restrictions r
    join secret_santa_participants np1 on np1.copied_from_participant_id = r.participant_id and np1.group_id = ${toGroupId}
    join secret_santa_participants np2 on np2.copied_from_participant_id = r.cannot_draw_participant_id and np2.group_id = ${toGroupId}
    where r.group_id = ${fromGroupId}
    on conflict do nothing`;
}

export async function setOwnerCopiedFrom(groupId: string, fromParticipantId: string): Promise<void> {
  await getDb()`update secret_santa_participants set copied_from_participant_id = ${fromParticipantId} where group_id = ${groupId} and is_organizer`;
}

export async function giverUserIdOfAssignment(assignmentId: string): Promise<string | null> {
  const rows = await getDb()`
    select p.user_id from secret_santa_assignments a join secret_santa_participants p on p.id = a.giver_participant_id where a.id = ${assignmentId}`;
  return (rows[0]?.user_id as string | undefined) ?? null;
}
