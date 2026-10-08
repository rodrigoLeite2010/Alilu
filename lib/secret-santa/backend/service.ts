import "server-only";
import { randomBytes } from "node:crypto";
import { computeDraw, isValidDraw, isDrawFeasible, pairKey } from "../draw";
import { DRAW_IMPOSSIBLE_MESSAGE, MIN_PARTICIPANTS, type GroupSettingsInput, type MyProgress } from "../types";
import * as repo from "./repository";

/**
 * Regras do Amigo Secreto. O usuário vem SEMPRE da sessão. Toda função confere associação ao grupo
 * (e posse, quando é do organizador) — quem não participa recebe 404, nunca informação.
 * Privacidade do sorteio é aplicada AQUI e no SQL (nunca no CSS): um participante só descobre quem ELE tirou.
 */

export class SecretSantaError extends Error {
  constructor(message: string, readonly httpStatus = 400, readonly code = "BAD_REQUEST") {
    super(message);
    this.name = "SecretSantaError";
  }
}
const notFound = () => new SecretSantaError("Grupo não encontrado.", 404, "NOT_FOUND");

type Body = Record<string, unknown>;
const text = (v: unknown, max: number): string => (typeof v === "string" ? v.trim().slice(0, max) : "");
const optText = (v: unknown, max: number): string | null => text(v, max) || null;
const token = () => randomBytes(32).toString("base64url");
const OPEN_STATUSES = ["OPEN", "READY_TO_DRAW"];
const MAX_GROUPS_PER_USER = 50;
const MAX_WISHES = 30;
const MAX_MESSAGES = 300;

function isoDate(v: unknown): string | null {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const d = new Date(`${v}T00:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== v ? null : v;
}
function cents(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n) || n < 0 || n > 100_000_000) throw new SecretSantaError("Valor inválido.", 400, "BAD_AMOUNT");
  return Math.round(n);
}
function todaySp(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(now);
}
function bool(v: unknown, fallback: boolean): boolean {
  return typeof v === "boolean" ? v : fallback;
}

// ---------------------------------------------------------------------------
// Contexto de acesso
// ---------------------------------------------------------------------------
interface Access {
  group: repo.GroupRecord;
  me: repo.ParticipantRecord;
  isOwner: boolean;
}

/** Só participante aceito (ou o dono, que é participante) entra. Qualquer outro: 404. */
async function requireMember(userId: string, groupId: string): Promise<Access> {
  if (!/^[0-9a-f-]{36}$/i.test(groupId)) throw notFound();
  const group = await repo.getGroup(groupId);
  if (!group) throw notFound();
  const me = await repo.getMyParticipant(groupId, userId);
  if (!me) throw notFound();
  return { group, me, isOwner: group.ownerUserId === userId };
}
async function requireOwner(userId: string, groupId: string): Promise<Access> {
  const access = await requireMember(userId, groupId);
  if (!access.isOwner) throw new SecretSantaError("Só quem organiza o grupo pode fazer isso.", 403, "FORBIDDEN");
  return access;
}
function assertOpen(group: repo.GroupRecord) {
  if (!OPEN_STATUSES.includes(group.status) && group.status !== "DRAFT") {
    throw new SecretSantaError(
      group.status === "DRAWN" ? "O sorteio já foi realizado. Invalide o sorteio para alterar participantes ou regras." : "Este grupo não aceita mais alterações.",
      409,
      "GROUP_LOCKED",
    );
  }
}

export function isRevealed(group: repo.GroupRecord, now = new Date()): boolean {
  if (group.revealMode === "NEVER") return false;
  if (group.status !== "DRAWN" && group.status !== "COMPLETED") return false;
  if (group.revealedAt || group.status === "COMPLETED") return true;
  if (group.revealMode === "AUTOMATIC") {
    const at = group.revealAt ?? group.eventDate;
    return at !== null && todaySp(now) >= at;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Grupos
// ---------------------------------------------------------------------------
function parseSettings(input: Body, base: repo.GroupFields): repo.GroupFields {
  const has = (k: string) => Object.prototype.hasOwnProperty.call(input, k);
  const name = has("name") ? text(input.name, 80) : base.name;
  if (!name) throw new SecretSantaError("Dê um nome ao grupo.", 400, "NAME_REQUIRED");
  const eventDate = has("eventDate") ? (input.eventDate ? isoDate(input.eventDate) : null) : base.eventDate;
  if (has("eventDate") && input.eventDate && !eventDate) throw new SecretSantaError("Data do evento inválida.", 400, "BAD_DATE");
  const joinDeadline = has("joinDeadline") ? (input.joinDeadline ? isoDate(input.joinDeadline) : null) : base.joinDeadline;
  if (has("joinDeadline") && input.joinDeadline && !joinDeadline) throw new SecretSantaError("Prazo de entrada inválido.", 400, "BAD_DATE");
  const revealAt = has("revealAt") ? (input.revealAt ? isoDate(input.revealAt) : null) : base.revealAt;
  const budgetMin = has("budgetMinCents") ? cents(input.budgetMinCents) : base.budgetMinCents;
  const budgetMax = has("budgetMaxCents") ? cents(input.budgetMaxCents) : base.budgetMaxCents;
  if (budgetMin !== null && budgetMax !== null && budgetMax < budgetMin) {
    throw new SecretSantaError("O valor máximo precisa ser maior ou igual ao mínimo.", 400, "BAD_BUDGET");
  }
  const revealMode = has("revealMode") ? String(input.revealMode) : base.revealMode;
  if (!["MANUAL", "AUTOMATIC", "NEVER"].includes(revealMode)) throw new SecretSantaError("Modo de revelação inválido.", 400, "BAD_REVEAL");
  return {
    ...base,
    name,
    description: has("description") ? optText(input.description, 500) : base.description,
    eventDate,
    joinDeadline,
    budgetMinCents: budgetMin,
    budgetMaxCents: budgetMax,
    location: has("location") ? optText(input.location, 200) : base.location,
    rulesText: has("rulesText") ? optText(input.rulesText, 1500) : base.rulesText,
    allowAnonymousMessages: bool(input.allowAnonymousMessages, base.allowAnonymousMessages),
    allowWishList: bool(input.allowWishList, base.allowWishList),
    allowGiftPreferences: bool(input.allowGiftPreferences, base.allowGiftPreferences),
    allowParticipantInvites: bool(input.allowParticipantInvites, base.allowParticipantInvites),
    allowOwnerSeeDraw: bool(input.allowOwnerSeeDraw, base.allowOwnerSeeDraw),
    allowRedraw: bool(input.allowRedraw, base.allowRedraw),
    revealMode,
    revealAt,
    avoidPrevious: bool(input.avoidPrevious, base.avoidPrevious),
  };
}

const DEFAULT_FIELDS: repo.GroupFields = {
  name: "",
  description: null,
  eventDate: null,
  joinDeadline: null,
  budgetMinCents: null,
  budgetMaxCents: null,
  currency: "BRL",
  location: null,
  rulesText: null,
  allowAnonymousMessages: true,
  allowWishList: true,
  allowGiftPreferences: true,
  allowParticipantInvites: false,
  allowOwnerSeeDraw: false,
  allowRedraw: true,
  revealMode: "MANUAL",
  revealAt: null,
  avoidPrevious: false,
  previousGroupId: null,
};

function ownerDisplayName(basics: { name: string | null; email: string | null } | null): string {
  return (basics?.name?.trim() || basics?.email?.split("@")[0] || "Organizador").slice(0, 80);
}

function parseParticipantInput(raw: unknown): { name: string; email: string | null; phone: string | null } {
  const o = (typeof raw === "object" && raw !== null ? raw : {}) as Body;
  const name = text(o.name, 80);
  if (!name) throw new SecretSantaError("Informe o nome do participante.", 400, "NAME_REQUIRED");
  const email = optText(o.email, 200)?.toLowerCase() ?? null;
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new SecretSantaError("E-mail inválido.", 400, "BAD_EMAIL");
  return { name, email, phone: optText(o.phone, 30) };
}

export async function createGroup(userId: string, body: Body) {
  if ((await repo.countOwnedGroups(userId)) >= MAX_GROUPS_PER_USER) {
    throw new SecretSantaError("Você atingiu o limite de grupos ativos.", 409, "LIMIT");
  }
  const fields = parseSettings(body, DEFAULT_FIELDS);
  const basics = await repo.getUserBasics(userId);
  const group = await repo.insertGroupWithOwner(
    userId,
    fields,
    { name: ownerDisplayName(basics), email: basics?.email ?? null },
    { group: token(), participant: token() },
  );
  // participantes iniciais (opcional): cada um com convite próprio
  const list = Array.isArray(body.participants) ? body.participants.slice(0, 99) : [];
  for (const raw of list) {
    const p = parseParticipantInput(raw);
    await repo.insertParticipant(group.id, { ...p, inviteToken: token(), status: "INVITED", userId: null });
  }
  await repo.insertAudit(group.id, userId, "GroupCreated", { participants: list.length + 1 });
  for (let i = 0; i < list.length; i += 1) await repo.insertAudit(group.id, userId, "ParticipantInvited");
  return { id: group.id };
}

export async function listMyGroups(userId: string) {
  const basics = await repo.getUserBasics(userId);
  const [groups, invites] = await Promise.all([repo.listGroupsForUser(userId), repo.listPendingInvites(userId, basics?.email ?? null)]);
  return {
    active: groups.filter((g) => ["OPEN", "READY_TO_DRAW", "DRAWN", "DRAFT"].includes(g.status)),
    completed: groups.filter((g) => ["COMPLETED", "CANCELLED"].includes(g.status)),
    invites,
  };
}

export async function updateGroup(userId: string, groupId: string, body: Body) {
  const { group } = await requireOwner(userId, groupId);
  if (group.status === "COMPLETED" || group.status === "CANCELLED") throw new SecretSantaError("Este grupo foi encerrado.", 409, "GROUP_LOCKED");
  const drawn = group.status === "DRAWN";
  // depois do sorteio, regras que mudam o sentido do sorteio/privacidade ficam travadas
  if (drawn) {
    for (const key of ["allowOwnerSeeDraw", "allowRedraw", "avoidPrevious", "revealMode"]) {
      if (key in body && body[key] !== (group as unknown as Record<string, unknown>)[key]) {
        throw new SecretSantaError("Essa regra não pode mudar depois do sorteio.", 409, "GROUP_LOCKED");
      }
    }
  }
  const base: repo.GroupFields = { ...group };
  const fields = parseSettings(body, base);
  const updated = await repo.updateGroupFields(groupId, fields);
  if (!updated) throw notFound();
  return { id: updated.id };
}

export async function cancelGroup(userId: string, groupId: string) {
  await requireOwner(userId, groupId);
  const g = await repo.setGroupStatus(groupId, ["DRAFT", "OPEN", "READY_TO_DRAW", "DRAWN"], "CANCELLED");
  if (!g) throw new SecretSantaError("Não foi possível cancelar este grupo.", 409, "GROUP_LOCKED");
  await repo.insertAudit(groupId, userId, "GroupCancelled");
  return { status: g.status };
}

export async function completeGroup(userId: string, groupId: string) {
  await requireOwner(userId, groupId);
  const g = await repo.setGroupStatus(groupId, ["DRAWN"], "COMPLETED");
  if (!g) throw new SecretSantaError("Só dá para concluir um grupo já sorteado.", 409, "GROUP_STATE");
  await repo.insertAudit(groupId, userId, "GroupCompleted");
  await repo.insertNotifications(await repo.userIdsOfAcceptedParticipants(groupId, userId), groupId, "COMPLETED", `${g.name} foi concluído`, "Veja o histórico do grupo.");
  return { status: g.status };
}

export async function revealGroup(userId: string, groupId: string) {
  const { group } = await requireOwner(userId, groupId);
  if (group.revealMode !== "MANUAL") throw new SecretSantaError("A revelação deste grupo não é manual.", 409, "REVEAL_MODE");
  const g = await repo.markRevealed(groupId);
  if (!g) throw new SecretSantaError("O sorteio ainda não foi realizado.", 409, "GROUP_STATE");
  await repo.insertAudit(groupId, userId, "DrawRevealed");
  await repo.insertNotifications(await repo.userIdsOfAcceptedParticipants(groupId, userId), groupId, "REVEAL", "A revelação do amigo secreto começou!", "Veja quem tirou quem.");
  return { revealed: true };
}

export async function duplicateGroup(userId: string, groupId: string, body: Body) {
  const { group, me } = await requireOwner(userId, groupId);
  if (!["DRAWN", "COMPLETED"].includes(group.status)) throw new SecretSantaError("Duplique um grupo depois do sorteio.", 409, "GROUP_STATE");
  if ((await repo.countOwnedGroups(userId)) >= MAX_GROUPS_PER_USER) throw new SecretSantaError("Você atingiu o limite de grupos ativos.", 409, "LIMIT");
  const copyBudget = bool(body.copyBudget, false);
  const fields = parseSettings(
    { name: text(body.name, 80) || `${group.name} (próximo)`, eventDate: body.eventDate ?? null, joinDeadline: null, revealAt: null },
    {
      ...group,
      eventDate: null,
      joinDeadline: null,
      revealAt: null,
      budgetMinCents: copyBudget ? group.budgetMinCents : null,
      budgetMaxCents: copyBudget ? group.budgetMaxCents : null,
      avoidPrevious: bool(body.avoidPrevious, true),
      previousGroupId: group.id,
    },
  );
  const basics = await repo.getUserBasics(userId);
  const created = await repo.insertGroupWithOwner(userId, fields, { name: me.name || ownerDisplayName(basics), email: basics?.email ?? null }, { group: token(), participant: token() });
  await repo.setOwnerCopiedFrom(created.id, me.id);
  const participants = await repo.listParticipants(groupId);
  for (const p of participants) {
    if (p.isOrganizer || p.status !== "ACCEPTED") continue;
    // copia pessoas; nunca o sorteio. Cada uma confirma de novo pelo convite.
    await repo.insertParticipant(created.id, {
      name: p.name,
      email: p.email,
      phone: p.phone,
      inviteToken: token(),
      status: "INVITED",
      userId: p.userId,
      copiedFromParticipantId: p.id,
    });
  }
  await repo.copyRestrictions(groupId, created.id);
  await repo.insertAudit(created.id, userId, "GroupDuplicated", { fromGroup: groupId });
  return { id: created.id };
}

// ---------------------------------------------------------------------------
// Visão do grupo (DTO filtrado por papel)
// ---------------------------------------------------------------------------
export async function getGroupView(userId: string, groupId: string) {
  const { group, me, isOwner } = await requireMember(userId, groupId);
  const [participants, announcements, ownerName] = await Promise.all([
    repo.listParticipants(groupId),
    repo.listAnnouncements(groupId),
    repo.getOwnerName(group.ownerUserId),
  ]);
  const accepted = participants.filter((p) => p.status === "ACCEPTED");
  const pending = participants.filter((p) => p.status === "INVITED");
  const drawn = group.status === "DRAWN" || group.status === "COMPLETED";

  // progresso PESSOAL: só o meu
  let progress: MyProgress = "PARTICIPANDO";
  if (drawn) {
    const mine = await repo.getMyGiverAssignment(groupId, me.id);
    if (mine) {
      progress = "AMIGO_SORTEADO";
      const gift = await repo.getGift(mine.id);
      if (gift) progress = gift.purchased ? "PRESENTE_COMPRADO" : "PRESENTE_ESCOLHIDO";
    }
  }

  const canInvite = isOwner || (group.allowParticipantInvites && OPEN_STATUSES.includes(group.status));
  const view: Record<string, unknown> = {
    group: {
      id: group.id,
      name: group.name,
      description: group.description,
      eventDate: group.eventDate,
      joinDeadline: group.joinDeadline,
      budgetMinCents: group.budgetMinCents,
      budgetMaxCents: group.budgetMaxCents,
      currency: group.currency,
      location: group.location,
      rulesText: group.rulesText,
      status: group.status,
      ownerName,
      allowAnonymousMessages: group.allowAnonymousMessages,
      allowWishList: group.allowWishList,
      allowGiftPreferences: group.allowGiftPreferences,
      allowParticipantInvites: group.allowParticipantInvites,
      allowOwnerSeeDraw: group.allowOwnerSeeDraw,
      allowRedraw: group.allowRedraw,
      revealMode: group.revealMode,
      revealAt: group.revealAt,
      avoidPrevious: group.avoidPrevious,
      drawn,
      revealed: isRevealed(group),
    },
    isOwner,
    me: { participantId: me.id, name: me.name, progress },
    counts: { total: participants.length, accepted: accepted.length, pending: pending.length },
    participants: participants.map((p) => ({
      id: p.id,
      name: p.name,
      status: p.status,
      isOrganizer: p.isOrganizer,
      isMe: p.id === me.id,
      ...(isOwner ? { email: p.email, phone: p.phone, inviteToken: p.status === "INVITED" ? p.inviteToken : null } : {}),
    })),
    inviteToken: canInvite ? group.inviteToken : null,
    announcements,
  };
  if (isOwner) {
    const restrictions = await repo.listRestrictions(groupId);
    view.restrictions = restrictions;
    view.drawPreview = await previewDrawFor(group, accepted.length, pending.length, restrictions);
    view.drawHistory = await repo.countDrawHistory(groupId);
  }
  return view;
}

// ---------------------------------------------------------------------------
// Participantes e convites
// ---------------------------------------------------------------------------
export async function addParticipant(userId: string, groupId: string, body: Body) {
  const { group, isOwner } = await requireMember(userId, groupId);
  if (!isOwner && !group.allowParticipantInvites) throw new SecretSantaError("Só quem organiza pode adicionar pessoas.", 403, "FORBIDDEN");
  assertOpen(group);
  const p = parseParticipantInput(body);
  const created = await repo.insertParticipant(groupId, { ...p, inviteToken: token(), status: "INVITED", userId: null });
  if (!created) throw new SecretSantaError("Não foi possível adicionar (grupo fechado ou lotado).", 409, "GROUP_LOCKED");
  await repo.insertAudit(groupId, userId, "ParticipantInvited");
  return { id: created.id, inviteToken: created.inviteToken };
}

export async function removeParticipant(userId: string, groupId: string, participantId: string) {
  const { group, me, isOwner } = await requireMember(userId, groupId);
  assertOpen(group);
  const target = await repo.getParticipant(participantId);
  if (!target || target.groupId !== groupId) throw notFound();
  if (!isOwner && target.id !== me.id) throw new SecretSantaError("Você não pode remover essa pessoa.", 403, "FORBIDDEN");
  if (target.isOrganizer) throw new SecretSantaError("O organizador não pode sair do próprio grupo. Cancele o grupo se for o caso.", 409, "ORGANIZER");
  const done = await repo.setParticipantStatus(participantId, groupId, "REMOVED");
  if (!done) throw new SecretSantaError("Não foi possível remover agora.", 409, "GROUP_LOCKED");
  await repo.insertAudit(groupId, userId, "ParticipantRemoved");
  return { removed: true };
}

export type InviteProblem = "INVALID" | "CLOSED" | "DEADLINE" | "REMOVED" | "USED";

async function resolveInvite(tok: string) {
  if (!tok || tok.length < 20 || tok.length > 80) return null;
  const participant = await repo.getParticipantByToken(tok);
  if (participant) {
    const group = await repo.getGroup(participant.groupId);
    return group ? { group, participant } : null;
  }
  const group = await repo.getGroupByToken(tok);
  return group ? { group, participant: null } : null;
}

function inviteProblem(group: repo.GroupRecord, participant: repo.ParticipantRecord | null, now = new Date()): InviteProblem | null {
  if (!OPEN_STATUSES.includes(group.status)) return "CLOSED";
  if (group.joinDeadline && todaySp(now) > group.joinDeadline) return "DEADLINE";
  if (participant?.status === "REMOVED") return "REMOVED";
  return null;
}

/** Pré-visualização pública do convite (sem login): só dados que o organizador quis mostrar. */
export async function getInvitePreview(tok: string, viewerUserId: string | null) {
  const found = await resolveInvite(tok);
  if (!found) return { valid: false as const, problem: "INVALID" as InviteProblem };
  const { group, participant } = found;
  const problem = inviteProblem(group, participant);
  const [ownerName, participants] = await Promise.all([repo.getOwnerName(group.ownerUserId), repo.listParticipants(group.id)]);
  const alreadyMember = viewerUserId ? Boolean(await repo.getMyParticipant(group.id, viewerUserId)) : false;
  return {
    valid: !problem,
    problem,
    alreadyMember,
    groupId: alreadyMember ? group.id : undefined,
    group: {
      name: group.name,
      ownerName,
      eventDate: group.eventDate,
      budgetMinCents: group.budgetMinCents,
      budgetMaxCents: group.budgetMaxCents,
      location: group.location,
      rulesText: group.rulesText,
      participantCount: participants.filter((p) => p.status === "ACCEPTED").length,
    },
    invitedName: participant?.name ?? null,
  };
}

export async function acceptInvite(userId: string, tok: string) {
  const found = await resolveInvite(tok);
  if (!found) throw new SecretSantaError("Convite inválido ou expirado.", 404, "INVITE_INVALID");
  const { group, participant } = found;
  const existing = await repo.getUserParticipantAnyActive(group.id, userId);
  if (existing?.status === "ACCEPTED") return { groupId: group.id, alreadyMember: true };
  const problem = inviteProblem(group, participant);
  if (problem) throw new SecretSantaError(inviteMessage(problem), 409, `INVITE_${problem}`);
  if (participant && participant.userId && participant.userId !== userId) {
    throw new SecretSantaError("Este convite já foi usado por outra conta.", 409, "INVITE_USED");
  }
  let accepted: repo.ParticipantRecord | null;
  if (participant) {
    // se a conta já tem outra vaga (ex.: veio antes pelo link do grupo), usa a que já existe
    accepted = existing ? await repo.acceptParticipant(existing.id, userId) : await repo.acceptParticipant(participant.id, userId);
  } else if (existing) {
    accepted = await repo.acceptParticipant(existing.id, userId);
  } else {
    const basics = await repo.getUserBasics(userId);
    accepted = await repo.insertParticipant(group.id, {
      name: ownerDisplayName(basics),
      email: basics?.email ?? null,
      phone: null,
      inviteToken: token(),
      status: "ACCEPTED",
      userId,
    });
  }
  if (!accepted) throw new SecretSantaError("Não foi possível entrar agora (grupo fechado ou lotado).", 409, "INVITE_CLOSED");
  await repo.insertAudit(group.id, userId, "ParticipantAccepted");
  await repo.insertNotifications([group.ownerUserId].filter((id) => id !== userId), group.id, "JOINED", `${accepted.name} entrou no grupo`, group.name);
  return { groupId: group.id, alreadyMember: false };
}

export async function declineInvite(userId: string, tok: string) {
  const found = await resolveInvite(tok);
  if (!found || !found.participant) throw new SecretSantaError("Convite inválido ou expirado.", 404, "INVITE_INVALID");
  const { participant, group } = found;
  if (participant.userId && participant.userId !== userId) throw new SecretSantaError("Este convite pertence a outra conta.", 409, "INVITE_USED");
  const done = await repo.setParticipantStatus(participant.id, group.id, "DECLINED");
  if (!done) throw new SecretSantaError("Não foi possível recusar agora.", 409, "GROUP_LOCKED");
  return { declined: true };
}

export function inviteMessage(problem: InviteProblem): string {
  switch (problem) {
    case "CLOSED":
      return "Este grupo não está mais aceitando participantes.";
    case "DEADLINE":
      return "O prazo para entrar neste amigo secreto já passou.";
    case "REMOVED":
      return "Você foi removido deste grupo.";
    case "USED":
      return "Este convite já foi usado por outra conta.";
    default:
      return "Convite inválido ou expirado.";
  }
}

// ---------------------------------------------------------------------------
// Restrições
// ---------------------------------------------------------------------------
/**
 * Cria restrições: cada pessoa de `from` não tira cada pessoa de `to`. `bothWays` também grava o inverso.
 * Casal: from=[A] to=[B] bothWays. Pais×filhos: from=pais to=filhos bothWays. Família: from=to=todos.
 */
export async function addRestrictions(userId: string, groupId: string, body: Body) {
  const { group } = await requireOwner(userId, groupId);
  assertOpen(group);
  const ids = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(0, 100) : []);
  const from = ids(body.fromIds ?? (body.participantId ? [body.participantId] : []));
  const to = ids(body.toIds ?? (body.cannotDrawParticipantId ? [body.cannotDrawParticipantId] : []));
  if (from.length === 0 || to.length === 0) throw new SecretSantaError("Escolha as pessoas da restrição.", 400, "BAD_RESTRICTION");
  const both = bool(body.bothWays, true);
  const seen = new Set<string>();
  const pairs: Array<{ from: string; to: string }> = [];
  for (const a of from) {
    for (const b of to) {
      if (a === b) continue;
      for (const [x, y] of both ? [[a, b], [b, a]] : [[a, b]]) {
        const key = pairKey(x, y);
        if (!seen.has(key)) {
          seen.add(key);
          pairs.push({ from: x, to: y });
        }
      }
    }
  }
  if (pairs.length === 0) throw new SecretSantaError("Escolha pessoas diferentes.", 400, "BAD_RESTRICTION");
  if (pairs.length > 2000) throw new SecretSantaError("Restrições demais de uma vez.", 400, "BAD_RESTRICTION");
  const added = await repo.insertRestrictions(groupId, pairs, optText(body.reason, 120));
  return { added };
}

export async function removeRestriction(userId: string, groupId: string, restrictionId: string) {
  await requireOwner(userId, groupId);
  const ok = await repo.deleteRestriction(groupId, restrictionId);
  if (!ok) throw new SecretSantaError("Restrição não encontrada ou grupo já sorteado.", 404, "NOT_FOUND");
  return { removed: true };
}

// ---------------------------------------------------------------------------
// Sorteio
// ---------------------------------------------------------------------------
async function buildForbidden(group: repo.GroupRecord, acceptedIds: string[], restrictions: repo.RestrictionRecord[]): Promise<Set<string>> {
  const accepted = new Set(acceptedIds);
  const forbidden = new Set<string>();
  for (const r of restrictions) {
    if (accepted.has(r.participantId) && accepted.has(r.cannotDrawParticipantId)) forbidden.add(pairKey(r.participantId, r.cannotDrawParticipantId));
  }
  if (group.avoidPrevious && group.previousGroupId) {
    const participants = await repo.listParticipants(group.id);
    const byOrigin = new Map<string, string>();
    for (const p of participants) if (p.status === "ACCEPTED" && p.copiedFromParticipantId) byOrigin.set(p.copiedFromParticipantId, p.id);
    for (const pair of await repo.listPreviousAssignmentPairs(group.previousGroupId, group.ownerUserId)) {
      const g = byOrigin.get(pair.giver);
      const r = byOrigin.get(pair.receiver);
      if (g && r) forbidden.add(pairKey(g, r));
    }
  }
  return forbidden;
}

async function previewDrawFor(group: repo.GroupRecord, acceptedCount: number, pendingCount: number, restrictions: repo.RestrictionRecord[]) {
  const canStatus = OPEN_STATUSES.includes(group.status) || (group.status === "DRAWN" && group.allowRedraw);
  let message: string | null = null;
  let feasible = true;
  if (!canStatus) message = group.status === "DRAWN" ? "Sorteio já realizado." : "Este grupo não permite sorteio.";
  else if (acceptedCount < MIN_PARTICIPANTS) message = `Precisa de pelo menos ${MIN_PARTICIPANTS} participantes confirmados.`;
  else {
    const accepted = (await repo.listParticipants(group.id)).filter((p) => p.status === "ACCEPTED").map((p) => p.id);
    feasible = isDrawFeasible(accepted, await buildForbidden(group, accepted, restrictions));
    if (!feasible) message = `${DRAW_IMPOSSIBLE_MESSAGE} Revise as restrições entre participantes.`;
  }
  return {
    canDraw: canStatus && acceptedCount >= MIN_PARTICIPANTS && feasible,
    acceptedCount,
    pendingCount,
    needsPendingConfirmation: pendingCount > 0,
    message,
    redraw: group.status === "DRAWN",
    summary: `${acceptedCount} confirmado${acceptedCount === 1 ? "" : "s"}${pendingCount ? `, ${pendingCount} aguardando` : ""}`,
  };
}

export async function previewDraw(userId: string, groupId: string) {
  const { group } = await requireOwner(userId, groupId);
  const participants = await repo.listParticipants(groupId);
  return previewDrawFor(group, participants.filter((p) => p.status === "ACCEPTED").length, participants.filter((p) => p.status === "INVITED").length, await repo.listRestrictions(groupId));
}

export async function performDraw(userId: string, groupId: string, body: Body = {}) {
  const { group } = await requireOwner(userId, groupId);
  const redraw = group.status === "DRAWN";
  if (redraw && !group.allowRedraw) throw new SecretSantaError("Refazer o sorteio está desativado neste grupo.", 409, "REDRAW_DISABLED");
  if (!OPEN_STATUSES.includes(group.status) && !redraw) throw new SecretSantaError("Este grupo não permite sorteio agora.", 409, "GROUP_STATE");

  const participants = await repo.listParticipants(groupId);
  const accepted = participants.filter((p) => p.status === "ACCEPTED");
  const pending = participants.filter((p) => p.status === "INVITED");
  if (accepted.length < MIN_PARTICIPANTS) {
    throw new SecretSantaError(`Precisa de pelo menos ${MIN_PARTICIPANTS} participantes confirmados.`, 409, "NOT_ENOUGH");
  }
  if (pending.length > 0 && body.confirmPending !== true) {
    throw new SecretSantaError(
      `${accepted.length} confirmados, ${pending.length} aguardando. Confirme para sortear só com quem já entrou.`,
      409,
      "PENDING_PARTICIPANTS",
    );
  }
  const ids = accepted.map((p) => p.id);
  const forbidden = await buildForbidden(group, ids, await repo.listRestrictions(groupId));
  const result = computeDraw(ids, forbidden);
  // sem resultado parcial: se inviável, NADA é gravado e nada sobre as combinações tentadas é revelado
  if (!result || !isValidDraw(ids, result, forbidden)) {
    throw new SecretSantaError(`${DRAW_IMPOSSIBLE_MESSAGE} Revise as restrições entre participantes.`, 422, "DRAW_IMPOSSIBLE");
  }
  const pairs = ids.map((g) => ({ g, r: result.get(g) as string }));
  const saved = await repo.persistDraw(groupId, userId, group.drawVersion, pairs);
  if (!saved || saved.inserted !== pairs.length) {
    throw new SecretSantaError("O grupo mudou durante o sorteio. Tente novamente.", 409, "DRAW_CONFLICT");
  }
  if (redraw) await repo.insertAudit(groupId, userId, "DrawInvalidated", { previousVersion: group.drawVersion });
  await repo.insertAudit(groupId, userId, "DrawPerformed", { participants: pairs.length, version: saved.version });
  await repo.insertNotifications(
    await repo.userIdsOfAcceptedParticipants(groupId),
    groupId,
    "DRAW",
    redraw ? "O sorteio foi refeito" : "O sorteio foi realizado!",
    "Abra o grupo para ver quem você tirou.",
  );
  return { version: saved.version, participants: pairs.length };
}

export async function invalidateDraw(userId: string, groupId: string) {
  const { group } = await requireOwner(userId, groupId);
  if (group.status !== "DRAWN") throw new SecretSantaError("Não há sorteio para invalidar.", 409, "GROUP_STATE");
  if (!group.allowRedraw) throw new SecretSantaError("Refazer o sorteio está desativado neste grupo.", 409, "REDRAW_DISABLED");
  const ok = await repo.invalidateDraw(groupId, userId);
  if (!ok) throw new SecretSantaError("Não foi possível invalidar agora.", 409, "GROUP_STATE");
  await repo.insertAudit(groupId, userId, "DrawInvalidated", { previousVersion: group.drawVersion });
  await repo.insertNotifications(await repo.userIdsOfAcceptedParticipants(groupId, userId), groupId, "DRAW_INVALIDATED", "O sorteio foi invalidado", "O organizador vai refazer o sorteio.");
  return { invalidated: true };
}

/** Lista completa: só após revelação ou, para o organizador, se allow_owner_see_draw. */
export async function getResults(userId: string, groupId: string) {
  const { group, isOwner } = await requireMember(userId, groupId);
  const revealed = isRevealed(group);
  const ownerMay = isOwner && group.allowOwnerSeeDraw && (group.status === "DRAWN" || group.status === "COMPLETED");
  if (!revealed && !ownerMay) throw new SecretSantaError("O resultado completo ainda não foi revelado.", 403, "NOT_REVEALED");
  return { pairs: await repo.listAllAssignments(groupId) };
}

// ---------------------------------------------------------------------------
// Meu amigo secreto
// ---------------------------------------------------------------------------
function wishDto(w: repo.WishRecord, includePurchased: boolean) {
  return {
    id: w.id,
    title: w.title,
    description: w.description,
    url: w.url,
    estimatedPriceCents: w.estimatedPriceCents,
    priority: w.priority,
    publicToGroup: w.publicToGroup,
    ...(includePurchased ? { purchased: w.purchased } : {}),
  };
}

/** Devolve SOMENTE a pessoa que o usuário autenticado tirou. Nunca a lista, nunca quem o tirou. */
export async function getMyAssignment(userId: string, groupId: string) {
  const { group, me } = await requireMember(userId, groupId);
  if (group.status !== "DRAWN" && group.status !== "COMPLETED") return { drawn: false as const };
  const mine = await repo.getMyGiverAssignment(groupId, me.id);
  if (!mine) return { drawn: false as const };
  const friend = await repo.getParticipant(mine.counterpartParticipantId);
  if (!friend) return { drawn: false as const };
  const [wishes, prefs, gift, unread, counts] = await Promise.all([
    group.allowWishList ? repo.listWishesOf(groupId, friend.id) : Promise.resolve([]),
    group.allowGiftPreferences ? repo.getPreferences(groupId, friend.id) : Promise.resolve(null),
    repo.getGift(mine.id),
    repo.countUnread(mine.id, true),
    repo.countMessages(mine.id),
  ]);
  return {
    drawn: true as const,
    friend: { name: friend.name },
    wishes: wishes.map((w) => wishDto(w, true)),
    preferences: prefs,
    gift,
    messages: { enabled: group.allowAnonymousMessages, unread, started: counts.total > 0 },
    budget: { minCents: group.budgetMinCents, maxCents: group.budgetMaxCents },
  };
}

// ---------------------------------------------------------------------------
// Lista de desejos e preferências (próprias)
// ---------------------------------------------------------------------------
function parseWish(body: Body) {
  const title = text(body.title, 120);
  if (!title) throw new SecretSantaError("Dê um título ao desejo.", 400, "TITLE_REQUIRED");
  let url = optText(body.url, 500);
  if (url) {
    if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
    try {
      const parsed = new URL(url);
      if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("bad");
    } catch {
      throw new SecretSantaError("Link inválido.", 400, "BAD_URL");
    }
  }
  const priority = Number(body.priority ?? 2);
  return {
    title,
    description: optText(body.description, 500),
    url,
    estimatedPriceCents: cents(body.estimatedPriceCents),
    priority: [1, 2, 3].includes(priority) ? priority : 2,
    publicToGroup: bool(body.publicToGroup, false),
  };
}

export async function getWishlist(userId: string, groupId: string) {
  const { group, me } = await requireMember(userId, groupId);
  const [mine, others, prefs] = await Promise.all([
    repo.listWishesOf(groupId, me.id),
    group.allowWishList ? repo.listPublicWishesOfOthers(groupId, me.id) : Promise.resolve([]),
    repo.getPreferences(groupId, me.id),
  ]);
  return {
    enabled: { wishes: group.allowWishList, preferences: group.allowGiftPreferences },
    // o dono do desejo nunca vê "comprado"
    mine: mine.map((w) => wishDto(w, false)),
    publicWishes: others.map((w) => ({ ...wishDto(w, false), ownerName: w.ownerName })),
    preferences: prefs,
  };
}

export async function addWish(userId: string, groupId: string, body: Body) {
  const { group, me } = await requireMember(userId, groupId);
  if (!group.allowWishList) throw new SecretSantaError("A lista de desejos está desativada neste grupo.", 403, "DISABLED");
  if (group.status === "CANCELLED") throw new SecretSantaError("Este grupo foi cancelado.", 409, "GROUP_LOCKED");
  if ((await repo.countWishes(me.id)) >= MAX_WISHES) throw new SecretSantaError("Limite de desejos atingido.", 409, "LIMIT");
  return wishDto(await repo.insertWish(groupId, me.id, parseWish(body)), false);
}

export async function updateWish(userId: string, groupId: string, wishId: string, body: Body) {
  const { group, me } = await requireMember(userId, groupId);
  if (!group.allowWishList) throw new SecretSantaError("A lista de desejos está desativada neste grupo.", 403, "DISABLED");
  const updated = await repo.updateWish(wishId, me.id, parseWish(body));
  if (!updated) throw new SecretSantaError("Desejo não encontrado.", 404, "NOT_FOUND");
  return wishDto(updated, false);
}

export async function deleteWish(userId: string, groupId: string, wishId: string) {
  const { me } = await requireMember(userId, groupId);
  const ok = await repo.deleteWish(wishId, me.id);
  if (!ok) throw new SecretSantaError("Desejo não encontrado.", 404, "NOT_FOUND");
  return { removed: true };
}

/** Quem tirou a pessoa marca "comprado"; o dono do desejo nunca recebe esse dado. */
export async function setWishPurchased(userId: string, groupId: string, wishId: string, purchased: boolean) {
  const { me } = await requireMember(userId, groupId);
  const wish = await repo.getWish(wishId, groupId);
  const mine = await repo.getMyGiverAssignment(groupId, me.id);
  if (!wish || !mine || mine.counterpartParticipantId !== wish.participantId) throw new SecretSantaError("Desejo não encontrado.", 404, "NOT_FOUND");
  await repo.setWishPurchased(wishId, purchased);
  return { purchased };
}

export async function savePreferences(userId: string, groupId: string, body: Body) {
  const { group, me } = await requireMember(userId, groupId);
  if (!group.allowGiftPreferences) throw new SecretSantaError("As preferências estão desativadas neste grupo.", 403, "DISABLED");
  return repo.savePreferences(groupId, me.id, {
    clothingSize: optText(body.clothingSize, 30),
    shoeSize: optText(body.shoeSize, 30),
    favoriteColors: optText(body.favoriteColors, 200),
    likes: optText(body.likes, 500),
    avoid: optText(body.avoid, 500),
    notes: optText(body.notes, 500),
  });
}

// ---------------------------------------------------------------------------
// Conversa anônima
// ---------------------------------------------------------------------------
type Side = "GIVER" | "RECEIVER";

/**
 * A conversa só existe entre quem tirou e quem foi tirado de uma atribuição válida e ativa.
 * DTO: { mine, body, createdAt }. Nenhum campo de identidade da outra ponta existe aqui.
 */
export async function getConversation(userId: string, groupId: string) {
  const { group, me } = await requireMember(userId, groupId);
  if (!group.allowAnonymousMessages) return { enabled: false as const };
  const giverRef = await repo.getMyGiverAssignment(groupId, me.id);
  const receiverId = await repo.getMyReceiverAssignmentId(groupId, me.id);
  const load = async (assignmentId: string | null, viewerIsGiver: boolean) => {
    if (!assignmentId) return null;
    const messages = await repo.listMessages(assignmentId);
    await repo.markMessagesRead(assignmentId, viewerIsGiver);
    return {
      messages: messages.map((m) => ({ id: m.id, mine: m.fromGiver === viewerIsGiver, body: m.body, createdAt: m.createdAt })),
      // quem recebe só responde depois que o amigo secreto escrever
      canWrite: viewerIsGiver || messages.some((m) => m.fromGiver),
    };
  };
  return {
    enabled: true as const,
    asGiver: await load(giverRef?.id ?? null, true),
    asReceiver: await load(receiverId, false),
  };
}

export async function postMessage(userId: string, groupId: string, body: Body) {
  const { group, me } = await requireMember(userId, groupId);
  if (!group.allowAnonymousMessages) throw new SecretSantaError("As mensagens anônimas estão desativadas neste grupo.", 403, "DISABLED");
  if (group.status !== "DRAWN") throw new SecretSantaError("A conversa está disponível enquanto o grupo está sorteado.", 409, "GROUP_STATE");
  const side: Side = body.as === "RECEIVER" ? "RECEIVER" : "GIVER";
  const message = text(body.body, 1000);
  if (!message) throw new SecretSantaError("Escreva uma mensagem.", 400, "EMPTY");
  let assignmentId: string | null;
  let counterpartUser: string | null = null;
  if (side === "GIVER") {
    const ref = await repo.getMyGiverAssignment(groupId, me.id);
    assignmentId = ref?.id ?? null;
    counterpartUser = ref ? await repo.userIdOfParticipant(ref.counterpartParticipantId) : null;
  } else {
    assignmentId = await repo.getMyReceiverAssignmentId(groupId, me.id);
  }
  if (!assignmentId) throw new SecretSantaError("Você não tem conversa nesta posição.", 403, "FORBIDDEN");
  const counts = await repo.countMessages(assignmentId);
  if (counts.total >= MAX_MESSAGES) throw new SecretSantaError("Limite de mensagens desta conversa atingido.", 409, "LIMIT");
  if (side === "RECEIVER" && counts.fromGiver === 0) throw new SecretSantaError("Você pode responder depois que seu amigo secreto escrever.", 403, "FORBIDDEN");
  const saved = await repo.insertMessage(assignmentId, side === "GIVER", message);
  if (side === "GIVER" && counterpartUser) {
    await repo.insertNotifications([counterpartUser], groupId, "MESSAGE", "Você recebeu uma mensagem do seu amigo secreto", null);
  }
  // resposta do sorteado: avisa o doador sem expor nada além do papel
  if (side === "RECEIVER") {
    const giverUser = await repo.giverUserIdOfAssignment(assignmentId);
    if (giverUser) await repo.insertNotifications([giverUser], groupId, "MESSAGE", "Seu amigo sorteado respondeu", null);
  }
  return { id: saved.id, mine: true, body: saved.body, createdAt: saved.createdAt };
}

// ---------------------------------------------------------------------------
// Presente escolhido (privado do doador)
// ---------------------------------------------------------------------------
export async function getMyGift(userId: string, groupId: string) {
  const { me } = await requireMember(userId, groupId);
  const mine = await repo.getMyGiverAssignment(groupId, me.id);
  if (!mine) return { gift: null };
  return { gift: await repo.getGift(mine.id) };
}

export async function saveMyGift(userId: string, groupId: string, body: Body) {
  const { me } = await requireMember(userId, groupId);
  const mine = await repo.getMyGiverAssignment(groupId, me.id);
  if (!mine) throw new SecretSantaError("Você ainda não tirou ninguém.", 409, "GROUP_STATE");
  if (body.remove === true) {
    await repo.deleteGift(mine.id);
    return { gift: null };
  }
  const name = text(body.name, 120);
  if (!name) throw new SecretSantaError("Diga qual presente você escolheu.", 400, "NAME_REQUIRED");
  const gift = await repo.saveGift(mine.id, { name, priceCents: cents(body.priceCents), notes: optText(body.notes, 500), purchased: bool(body.purchased, false) });
  return { gift };
}

// ---------------------------------------------------------------------------
// Avisos do organizador e notificações
// ---------------------------------------------------------------------------
export async function postAnnouncement(userId: string, groupId: string, body: Body) {
  await requireOwner(userId, groupId);
  const message = text(body.body, 1000);
  if (!message) throw new SecretSantaError("Escreva o aviso.", 400, "EMPTY");
  const saved = await repo.insertAnnouncement(groupId, userId, message);
  await repo.insertNotifications(await repo.userIdsOfAcceptedParticipants(groupId, userId), groupId, "ANNOUNCEMENT", "Novo aviso do organizador", null);
  return saved;
}

export async function getNotifications(userId: string) {
  return { notifications: await repo.listNotifications(userId) };
}
export async function readNotifications(userId: string) {
  await repo.markNotificationsRead(userId);
  return { ok: true };
}

export type { GroupSettingsInput };
