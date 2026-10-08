// Amigo Secreto contra um Postgres REAL em memória (PGlite): sorteio, restrições, privacidade e chat anônimo.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb, type TestDb } from "../helpers/pglite-db";

let db: TestDb;
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/client", () => ({ getDb: () => db.sql, assertDatabaseConfigured: () => undefined }));

const svc = await import("@/lib/secret-santa/backend/service");
const repo = await import("@/lib/secret-santa/backend/repository");
const { computeDraw, isValidDraw, isDrawFeasible, pairKey } = await import("@/lib/secret-santa/draw");

type View = Awaited<ReturnType<typeof svc.getGroupView>> & Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

let users: string[] = [];
const NAMES = ["Ana", "Bruno", "Carla", "Diego", "Elisa", "Fabio"];

beforeEach(async () => {
  db = await createTestDb();
  users = [];
  for (const n of NAMES) {
    const [u] = await db.sql`insert into users (email, name) values (${`${n.toLowerCase()}@example.com`}, ${n}) returning id`;
    users.push(u.id as string);
  }
});
afterEach(async () => {
  await db.close();
});

/** Cria o grupo com o usuário 0 como organizador e os demais (1..n-1) entrando pelo convite pessoal. */
async function setupGroup(n = 4, body: Record<string, unknown> = {}) {
  const { id } = await svc.createGroup(users[0], {
    name: "Família",
    budgetMinCents: 5000,
    budgetMaxCents: 10000,
    participants: NAMES.slice(1, n).map((name) => ({ name })),
    ...body,
  });
  const view = (await svc.getGroupView(users[0], id)) as View;
  const byName = new Map<string, { id: string; token: string }>();
  for (const p of view.participants as Array<{ id: string; name: string; inviteToken: string | null }>) byName.set(p.name, { id: p.id, token: p.inviteToken ?? "" });
  for (let i = 1; i < n; i += 1) await svc.acceptInvite(users[i], byName.get(NAMES[i])!.token);
  const pid = (i: number) => byName.get(NAMES[i])?.id ?? ((view.participants as Array<{ id: string; isMe: boolean }>).find((p) => p.isMe)!.id);
  return { id, pid, view };
}

async function who(groupId: string, userIdx: number): Promise<string | null> {
  const r = (await svc.getMyAssignment(users[userIdx], groupId)) as { drawn: boolean; friend?: { name: string } };
  return r.drawn ? r.friend!.name : null;
}

describe("grupo, participantes e convites", () => {
  it("1) cria grupo e organizador vira participante aceito", async () => {
    const { id } = await svc.createGroup(users[0], { name: "Natal", budgetMaxCents: 8000 });
    const view = (await svc.getGroupView(users[0], id)) as View;
    expect(view.isOwner).toBe(true);
    expect(view.participants).toHaveLength(1);
    expect(view.participants[0]).toMatchObject({ name: "Ana", status: "ACCEPTED", isOrganizer: true });
    await expect(svc.createGroup(users[0], { name: " " })).rejects.toMatchObject({ httpStatus: 400 });
    await expect(svc.createGroup(users[0], { name: "x", budgetMinCents: 9000, budgetMaxCents: 1000 })).rejects.toMatchObject({ code: "BAD_BUDGET" });
  });

  it("2) adiciona participantes e 3) aceita convite vinculando a conta", async () => {
    const { id } = await svc.createGroup(users[0], { name: "Natal" });
    const added = await svc.addParticipant(users[0], id, { name: "Bruno", email: "bruno@example.com" });
    expect(added.inviteToken.length).toBeGreaterThan(30);
    const res = await svc.acceptInvite(users[1], added.inviteToken);
    expect(res).toMatchObject({ groupId: id, alreadyMember: false });
    const view = (await svc.getGroupView(users[1], id)) as View;
    expect(view.me.name).toBe("Bruno");
    expect(view.counts).toMatchObject({ total: 2, accepted: 2, pending: 0 });
    // convite usado por outra conta
    await expect(svc.acceptInvite(users[2], added.inviteToken)).rejects.toMatchObject({ code: "INVITE_USED" });
    // idempotente para a mesma conta
    expect(await svc.acceptInvite(users[1], added.inviteToken)).toMatchObject({ alreadyMember: true });
  });

  it("link genérico do grupo cria a participação do próprio usuário", async () => {
    const { id } = await svc.createGroup(users[0], { name: "Natal" });
    const token = ((await svc.getGroupView(users[0], id)) as View).inviteToken as string;
    await svc.acceptInvite(users[2], token);
    const view = (await svc.getGroupView(users[2], id)) as View;
    expect(view.me.name).toBe("Carla");
  });

  it("4) quem não participa não acessa nada do grupo", async () => {
    const { id } = await setupGroup(3);
    for (const call of [
      () => svc.getGroupView(users[5], id),
      () => svc.getMyAssignment(users[5], id),
      () => svc.getConversation(users[5], id),
      () => svc.getWishlist(users[5], id),
      () => svc.getMyGift(users[5], id),
      () => svc.getResults(users[5], id),
      () => svc.performDraw(users[5], id),
      () => svc.addParticipant(users[5], id, { name: "X" }),
    ]) {
      await expect(call()).rejects.toMatchObject({ httpStatus: 404 });
    }
  });

  it("participante comum não faz ações de organizador", async () => {
    const { id } = await setupGroup(4);
    await expect(svc.performDraw(users[1], id)).rejects.toMatchObject({ httpStatus: 403 });
    await expect(svc.updateGroup(users[1], id, { name: "Hack" })).rejects.toMatchObject({ httpStatus: 403 });
    await expect(svc.addRestrictions(users[1], id, { fromIds: [], toIds: [] })).rejects.toMatchObject({ httpStatus: 403 });
    await expect(svc.postAnnouncement(users[1], id, { body: "oi" })).rejects.toMatchObject({ httpStatus: 403 });
    await expect(svc.addParticipant(users[1], id, { name: "Y" })).rejects.toMatchObject({ httpStatus: 403 });
  });

  it("convite expirado (prazo), inválido e grupo fechado", async () => {
    const { id } = await svc.createGroup(users[0], { name: "Natal", joinDeadline: "2020-01-01" });
    const t1 = (await svc.addParticipant(users[0], id, { name: "Bruno" })).inviteToken;
    await expect(svc.acceptInvite(users[1], t1)).rejects.toMatchObject({ code: "INVITE_DEADLINE" });
    const preview = await svc.getInvitePreview(t1, null);
    expect(preview).toMatchObject({ valid: false, problem: "DEADLINE" });

    expect(await svc.getInvitePreview("token-que-nao-existe-de-jeito-nenhum", null)).toMatchObject({ valid: false, problem: "INVALID" });
    await expect(svc.acceptInvite(users[1], "token-que-nao-existe-de-jeito-nenhum")).rejects.toMatchObject({ httpStatus: 404 });

    const g2 = await setupGroup(4);
    const late = (await svc.addParticipant(users[0], g2.id, { name: "Atrasado" })).inviteToken;
    await svc.performDraw(users[0], g2.id, { confirmPending: true });
    await expect(svc.acceptInvite(users[4], late)).rejects.toMatchObject({ code: "INVITE_CLOSED" });
    await svc.cancelGroup(users[0], g2.id);
    expect(await svc.getInvitePreview(late, null)).toMatchObject({ valid: false, problem: "CLOSED" });
  });

  it("pré-visualização pública não exige login e só traz dados do convite", async () => {
    const { id } = await svc.createGroup(users[0], { name: "Natal", rulesText: "sem presentes caros", budgetMaxCents: 10000 });
    const token = ((await svc.getGroupView(users[0], id)) as View).inviteToken as string;
    const preview = (await svc.getInvitePreview(token, null)) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
    expect(preview.valid).toBe(true);
    expect(preview.group).toMatchObject({ name: "Natal", ownerName: "Ana", budgetMaxCents: 10000 });
    expect(JSON.stringify(preview)).not.toMatch(/example\.com|token/i);
  });
});

describe("sorteio", () => {
  it("5) ninguém tira a si mesmo, 6) todos tiram exatamente um, 7) todos são tirados exatamente uma vez", async () => {
    for (let round = 0; round < 15; round += 1) {
      const ids = ["a", "b", "c", "d", "e", "f"];
      const draw = computeDraw(ids, new Set())!;
      expect(draw.size).toBe(6);
      expect(ids.every((g) => draw.get(g) !== g)).toBe(true);
      expect(new Set(draw.values()).size).toBe(6);
      expect(isValidDraw(ids, draw, new Set())).toBe(true);
    }
    const { id } = await setupGroup(5);
    await svc.performDraw(users[0], id);
    const drawn = new Set<string>();
    for (let i = 0; i < 5; i += 1) {
      const friend = await who(id, i);
      expect(friend).not.toBeNull();
      expect(friend).not.toBe(NAMES[i]);
      drawn.add(friend!);
    }
    expect(drawn.size).toBe(5);
  });

  it("8) restrições A↛B e B↛A são respeitadas (muitas repetições, 4 pessoas)", async () => {
    const ids = ["A", "B", "C", "D"];
    const forbidden = new Set([pairKey("A", "B"), pairKey("B", "A")]);
    for (let i = 0; i < 200; i += 1) {
      const d = computeDraw(ids, forbidden)!;
      expect(d.get("A")).not.toBe("B");
      expect(d.get("B")).not.toBe("A");
      expect(isValidDraw(ids, d, forbidden)).toBe(true);
    }
  });

  it("restrições no banco (casal, mão dupla) valem no sorteio real", async () => {
    const { id, pid } = await setupGroup(4);
    const r = await svc.addRestrictions(users[0], id, { fromIds: [pid(1)], toIds: [pid(2)], bothWays: true });
    expect(r.added).toBe(2);
    for (let i = 0; i < 6; i += 1) {
      await svc.performDraw(users[0], id);
      expect(await who(id, 1)).not.toBe("Carla");
      expect(await who(id, 2)).not.toBe("Bruno");
    }
  });

  it("9) cenário impossível não grava nada (sem sorteio parcial) e a mensagem não revela combinações", async () => {
    const { id, pid } = await setupGroup(3);
    // Ana não pode tirar Bruno nem Carla → ninguém sobra para ela
    await svc.addRestrictions(users[0], id, { fromIds: [pid(0)], toIds: [pid(1), pid(2)], bothWays: false });
    const preview = await svc.previewDraw(users[0], id);
    expect(preview.canDraw).toBe(false);
    await expect(svc.performDraw(users[0], id)).rejects.toMatchObject({
      code: "DRAW_IMPOSSIBLE",
      message: expect.stringContaining("Não foi possível realizar o sorteio com as restrições atuais."),
    });
    const [{ n }] = await db.sql`select count(*)::int as n from secret_santa_assignments`;
    expect(n).toBe(0);
    expect(((await svc.getGroupView(users[0], id)) as View).group.status).toBe("OPEN");
    expect(isDrawFeasible(["A", "B", "C"], new Set([pairKey("A", "B"), pairKey("A", "C")]))).toBe(false);
  });

  it("mínimo de 3 confirmados e participantes pendentes exigem confirmação", async () => {
    const { id } = await setupGroup(2);
    await expect(svc.performDraw(users[0], id)).rejects.toMatchObject({ code: "NOT_ENOUGH" });
    const g = await setupGroup(4);
    await svc.addParticipant(users[0], g.id, { name: "Pendente" });
    await expect(svc.performDraw(users[0], g.id)).rejects.toMatchObject({ code: "PENDING_PARTICIPANTS" });
    const prev = await svc.previewDraw(users[0], g.id);
    expect(prev.summary).toBe("4 confirmados, 1 aguardando");
    await svc.performDraw(users[0], g.id, { confirmPending: true });
  });

  it("10) o sorteio é persistido de forma transacional (tudo ou nada)", async () => {
    const { id, pid } = await setupGroup(4);
    const group = (await repo.getGroup(id))!;
    // lote com um participante inexistente → NADA é gravado, mesmo as linhas válidas
    const bogus = [
      { g: pid(0), r: pid(1) },
      { g: pid(1), r: pid(2) },
      { g: pid(2), r: pid(3) },
      { g: pid(3), r: "00000000-0000-0000-0000-000000000000" },
    ];
    expect(await repo.persistDraw(id, users[0], group.drawVersion, bogus)).toBeNull();
    // lote que quebraria a constraint (receptor duplicado) → erro e nada fica gravado
    const dup = [
      { g: pid(0), r: pid(1) },
      { g: pid(1), r: pid(1) },
      { g: pid(2), r: pid(1) },
      { g: pid(3), r: pid(0) },
    ];
    await expect(repo.persistDraw(id, users[0], group.drawVersion, dup)).rejects.toBeTruthy();
    const [{ n }] = await db.sql`select count(*)::int as n from secret_santa_assignments`;
    expect(n).toBe(0);
    expect(((await repo.getGroup(id))!).status).toBe("OPEN");
    // constraints do banco: nunca a si mesmo
    await expect(db.sql`insert into secret_santa_assignments (group_id, giver_participant_id, receiver_participant_id, draw_version) values (${id}, ${pid(0)}, ${pid(0)}, 9)`).rejects.toBeTruthy();
  });

  it("versão desatualizada não grava (otimista) e corrida de dois sorteios gera um só", async () => {
    const { id } = await setupGroup(4);
    await svc.performDraw(users[0], id);
    const group = (await repo.getGroup(id))!;
    const parts = await repo.listParticipants(id);
    const ring = parts.map((p, i) => ({ g: p.id, r: parts[(i + 1) % parts.length].id }));
    expect(await repo.persistDraw(id, users[0], group.drawVersion - 1, ring)).toBeNull();
    const [{ n }] = await db.sql`select count(*)::int as n from secret_santa_assignments where invalidated_at is null`;
    expect(n).toBe(4);
  });

  it("19) refazer invalida o anterior por completo e guarda o histórico de versões", async () => {
    const { id } = await setupGroup(4);
    await svc.performDraw(users[0], id);
    await svc.performDraw(users[0], id);
    const hist = await repo.countDrawHistory(id);
    expect(hist).toEqual([
      { version: 1, active: false, participants: 4 },
      { version: 2, active: true, participants: 4 },
    ]);
    // 20) nunca há duas atribuições ativas para o mesmo doador/receptor
    const rows = await db.sql`select giver_participant_id g, count(*)::int n from secret_santa_assignments where invalidated_at is null group by 1`;
    expect(rows.every((r) => r.n === 1)).toBe(true);
    const rr = await db.sql`select receiver_participant_id g, count(*)::int n from secret_santa_assignments where invalidated_at is null group by 1`;
    expect(rr.every((r) => r.n === 1)).toBe(true);
  });

  it("refazer desativado bloqueia; invalidar reabre o grupo", async () => {
    const a = await setupGroup(4, { allowRedraw: false });
    await svc.performDraw(users[0], a.id);
    await expect(svc.performDraw(users[0], a.id)).rejects.toMatchObject({ code: "REDRAW_DISABLED" });
    await expect(svc.invalidateDraw(users[0], a.id)).rejects.toMatchObject({ code: "REDRAW_DISABLED" });
    const b = await setupGroup(4);
    await svc.performDraw(users[0], b.id);
    await svc.invalidateDraw(users[0], b.id);
    expect(((await svc.getGroupView(users[0], b.id)) as View).group.status).toBe("OPEN");
    expect(await who(b.id, 1)).toBeNull();
  });

  it("21) não adiciona/remove participante nem restrição depois do sorteio sem invalidar", async () => {
    const { id, pid } = await setupGroup(4);
    await svc.performDraw(users[0], id);
    await expect(svc.addParticipant(users[0], id, { name: "Novo" })).rejects.toMatchObject({ code: "GROUP_LOCKED" });
    await expect(svc.removeParticipant(users[0], id, pid(1))).rejects.toMatchObject({ code: "GROUP_LOCKED" });
    await expect(svc.addRestrictions(users[0], id, { fromIds: [pid(1)], toIds: [pid(2)] })).rejects.toMatchObject({ code: "GROUP_LOCKED" });
    await svc.invalidateDraw(users[0], id);
    await expect(svc.addParticipant(users[0], id, { name: "Novo" })).resolves.toBeTruthy();
  });

  it("allowOwnerSeeDraw não pode mudar depois do sorteio", async () => {
    const { id } = await setupGroup(4);
    await svc.performDraw(users[0], id);
    await expect(svc.updateGroup(users[0], id, { allowOwnerSeeDraw: true })).rejects.toMatchObject({ code: "GROUP_LOCKED" });
  });
});

describe("privacidade", () => {
  it("11) participante vê só quem tirou; 12) não descobre quem o tirou; 13) organizador não vê resultados", async () => {
    const { id } = await setupGroup(4);
    await svc.performDraw(users[0], id);
    const mine = await who(id, 1);
    expect(mine).toBeTruthy();
    // resposta de my-assignment nunca contém ids de participantes/outros nomes além do amigo
    const dto = JSON.stringify(await svc.getMyAssignment(users[1], id));
    for (const other of NAMES.slice(0, 4).filter((n) => n !== mine)) expect(dto).not.toContain(other);
    // nenhuma API de grupo expõe a lista de sorteio
    for (const i of [0, 1, 2, 3]) {
      const view = JSON.stringify(await svc.getGroupView(users[i], id));
      expect(view).not.toMatch(/giver|receiver|assignment|amigoSorteado/i);
    }
    await expect(svc.getResults(users[0], id)).rejects.toMatchObject({ code: "NOT_REVEALED" });
    await expect(svc.getResults(users[1], id)).rejects.toMatchObject({ code: "NOT_REVEALED" });
  });

  it("cenário A tirou C: A vê C; C NÃO vê A; B não vê nada de A/C", async () => {
    const { id, pid } = await setupGroup(4);
    // força: A→C via restrições (A não pode tirar B nem D)
    await svc.addRestrictions(users[0], id, { fromIds: [pid(0)], toIds: [pid(1), pid(3)], bothWays: false });
    await svc.performDraw(users[0], id);
    expect(await who(id, 0)).toBe("Carla");
    const c = JSON.stringify(await svc.getMyAssignment(users[2], id));
    expect(c).not.toContain("Ana");
    const b = JSON.stringify([await svc.getMyAssignment(users[1], id), await svc.getGroupView(users[1], id), await svc.getWishlist(users[1], id)]);
    expect(b).not.toMatch(/"Carla"[^}]*"friend"/);
    expect(await who(id, 1)).not.toBe(await who(id, 0)); // cada um tira alguém diferente
  });

  it("organizador com allowOwnerSeeDraw=true vê o resultado; revelação manual libera para todos", async () => {
    const { id } = await setupGroup(4, { allowOwnerSeeDraw: true });
    await svc.performDraw(users[0], id);
    const owner = await svc.getResults(users[0], id);
    expect(owner.pairs).toHaveLength(4);
    await expect(svc.getResults(users[2], id)).rejects.toMatchObject({ code: "NOT_REVEALED" });
    await svc.revealGroup(users[0], id);
    expect((await svc.getResults(users[2], id)).pairs).toHaveLength(4);
  });

  it("modo NUNCA revelar: nem concluído libera; AUTOMÁTICO revela na data", async () => {
    const never = await setupGroup(4, { revealMode: "NEVER" });
    await svc.performDraw(users[0], never.id);
    await expect(svc.revealGroup(users[0], never.id)).rejects.toMatchObject({ code: "REVEAL_MODE" });
    await svc.completeGroup(users[0], never.id);
    await expect(svc.getResults(users[1], never.id)).rejects.toMatchObject({ code: "NOT_REVEALED" });

    const auto = await setupGroup(4, { revealMode: "AUTOMATIC", revealAt: "2026-12-24" });
    await svc.performDraw(users[0], auto.id);
    const g = (await repo.getGroup(auto.id))!;
    expect(svc.isRevealed(g, new Date("2026-12-23T12:00:00Z"))).toBe(false);
    expect(svc.isRevealed(g, new Date("2026-12-24T12:00:00Z"))).toBe(true);
  });

  it("concluído (modo manual) mostra o histórico de quem tirou quem", async () => {
    const { id } = await setupGroup(4);
    await svc.performDraw(users[0], id);
    await svc.completeGroup(users[0], id);
    expect((await svc.getResults(users[3], id)).pairs).toHaveLength(4);
  });

  it("presente escolhido é privado de quem tirou e fora das demais APIs", async () => {
    const { id } = await setupGroup(4);
    await svc.performDraw(users[0], id);
    const friend = await who(id, 1);
    await svc.saveMyGift(users[1], id, { name: "Livro secreto do Zé", priceCents: 4500, purchased: true });
    expect((await svc.getMyGift(users[1], id)).gift).toMatchObject({ name: "Livro secreto do Zé", purchased: true });
    const view = (await svc.getGroupView(users[1], id)) as View;
    expect(view.me.progress).toBe("PRESENTE_COMPRADO");
    const friendIdx = NAMES.indexOf(friend!);
    const spill = JSON.stringify([
      await svc.getGroupView(users[friendIdx], id),
      await svc.getMyAssignment(users[friendIdx], id),
      await svc.getGroupView(users[0], id),
      await svc.getWishlist(users[friendIdx], id),
      await svc.getConversation(users[friendIdx], id),
      (await svc.getNotifications(users[friendIdx])).notifications,
    ]);
    expect(spill).not.toContain("Livro secreto");
    expect(await db.sql`select 1 from secret_santa_audit_events where meta::text like '%Livro%'`).toHaveLength(0);
  });

  it("auditoria registra eventos sem gravar o resultado do sorteio", async () => {
    const { id } = await setupGroup(4);
    await svc.performDraw(users[0], id);
    const events = (await db.sql`select event, meta from secret_santa_audit_events where group_id = ${id}`).map((e) => e.event);
    expect(events).toEqual(expect.arrayContaining(["GroupCreated", "ParticipantInvited", "ParticipantAccepted", "DrawPerformed"]));
    const metas = JSON.stringify((await db.sql`select meta from secret_santa_audit_events`).map((m) => m.meta));
    expect(metas).not.toMatch(/giver|receiver|Bruno|Carla/i);
  });

  it("notificações do sorteio não carregam conteúdo sensível", async () => {
    const { id } = await setupGroup(4);
    await svc.performDraw(users[0], id);
    const n = (await svc.getNotifications(users[2])).notifications;
    expect(n.some((x) => x.type === "DRAW")).toBe(true);
    expect(JSON.stringify(n)).not.toMatch(/Ana|Bruno|Diego/);
  });
});

describe("lista de desejos e preferências", () => {
  it("14) lista de desejos: dono edita, quem tirou vê e marca comprado, dono nunca vê 'comprado'", async () => {
    const { id } = await setupGroup(4);
    await svc.performDraw(users[0], id);
    const friend = await who(id, 1);
    const fIdx = NAMES.indexOf(friend!);
    const wish = await svc.addWish(users[fIdx], id, { title: "Fone de ouvido", estimatedPriceCents: 20000, priority: 1, url: "loja.com/fone" });
    expect(wish.url).toBe("https://loja.com/fone");
    const seen = (await svc.getMyAssignment(users[1], id)) as { wishes: Array<{ id: string; title: string; purchased: boolean }> };
    expect(seen.wishes[0]).toMatchObject({ title: "Fone de ouvido", purchased: false });
    await svc.setWishPurchased(users[1], id, wish.id, true);
    const again = (await svc.getMyAssignment(users[1], id)) as { wishes: Array<{ purchased: boolean }> };
    expect(again.wishes[0].purchased).toBe(true);
    expect(JSON.stringify(await svc.getWishlist(users[fIdx], id))).not.toContain("purchased");
    // quem não tirou essa pessoa não marca comprado
    const other = [0, 1, 2, 3].find((i) => i !== 1 && i !== fIdx)!;
    await expect(svc.setWishPurchased(users[other], id, wish.id, true)).rejects.toMatchObject({ httpStatus: 404 });
    // só o dono edita/exclui
    await expect(svc.deleteWish(users[1], id, wish.id)).rejects.toMatchObject({ httpStatus: 404 });
    await expect(svc.addWish(users[1], id, { title: "" })).rejects.toMatchObject({ code: "TITLE_REQUIRED" });
    await svc.deleteWish(users[fIdx], id, wish.id);
  });

  it("desejos públicos aparecem para o grupo; privados não", async () => {
    const { id } = await setupGroup(4);
    await svc.addWish(users[1], id, { title: "Privado" });
    await svc.addWish(users[1], id, { title: "Público", publicToGroup: true });
    const list = (await svc.getWishlist(users[2], id)) as { publicWishes: Array<{ title: string }> };
    expect(list.publicWishes.map((w) => w.title)).toEqual(["Público"]);
  });

  it("15) preferências de presente salvas e visíveis só para quem tirou", async () => {
    const { id } = await setupGroup(4);
    await svc.performDraw(users[0], id);
    const friend = await who(id, 1);
    const fIdx = NAMES.indexOf(friend!);
    await svc.savePreferences(users[fIdx], id, { clothingSize: "M", shoeSize: "40", favoriteColors: "azul", likes: "café", avoid: "perfume", notes: "gosto de livros" });
    const seen = (await svc.getMyAssignment(users[1], id)) as { preferences: { clothingSize: string; avoid: string } };
    expect(seen.preferences).toMatchObject({ clothingSize: "M", avoid: "perfume" });
    const other = [0, 1, 2, 3].find((i) => i !== 1 && i !== fIdx)!;
    expect(JSON.stringify(await svc.getMyAssignment(users[other], id))).not.toContain("perfume");
  });

  it("recursos desativados pelo organizador são bloqueados no backend", async () => {
    const { id } = await setupGroup(4, { allowWishList: false, allowGiftPreferences: false, allowAnonymousMessages: false });
    await expect(svc.addWish(users[1], id, { title: "x" })).rejects.toMatchObject({ code: "DISABLED" });
    await expect(svc.savePreferences(users[1], id, {})).rejects.toMatchObject({ code: "DISABLED" });
    await svc.performDraw(users[0], id);
    await expect(svc.postMessage(users[1], id, { as: "GIVER", body: "oi" })).rejects.toMatchObject({ code: "DISABLED" });
    expect(await svc.getConversation(users[1], id)).toEqual({ enabled: false });
  });
});

describe("conversa anônima", () => {
  it("16) A→C anônimo; C vê 'seu amigo secreto'; C responde; A recebe; C nunca recebe a identidade de A", async () => {
    const { id, pid } = await setupGroup(4);
    await svc.addRestrictions(users[0], id, { fromIds: [pid(0)], toIds: [pid(1), pid(3)], bothWays: false });
    await svc.performDraw(users[0], id);
    expect(await who(id, 0)).toBe("Carla"); // A tirou C

    // C não pode iniciar conversa
    await expect(svc.postMessage(users[2], id, { as: "RECEIVER", body: "quem é você?" })).rejects.toMatchObject({ httpStatus: 403 });

    await svc.postMessage(users[0], id, { as: "GIVER", body: "Qual a sua cor favorita?" });
    const c1 = (await svc.getConversation(users[2], id)) as any; // eslint-disable-line @typescript-eslint/no-explicit-any
    expect(c1.asReceiver.messages).toEqual([expect.objectContaining({ mine: false, body: "Qual a sua cor favorita?" })]);
    expect(c1.asReceiver.canWrite).toBe(true);
    expect(c1.asGiver.messages).toEqual([]); // C também tirou alguém, mas essa conversa é outra e está vazia
    // o DTO do sorteado só tem estes campos: nada de remetente
    expect(Object.keys(c1.asReceiver.messages[0]).sort()).toEqual(["body", "createdAt", "id", "mine"]);
    expect(JSON.stringify(c1)).not.toMatch(/Ana|ana@|userId|sender|giver_|avatar/i);

    await svc.postMessage(users[2], id, { as: "RECEIVER", body: "Azul!" });
    const a = (await svc.getConversation(users[0], id)) as any; // eslint-disable-line @typescript-eslint/no-explicit-any
    expect(a.asGiver.messages.map((m: { mine: boolean; body: string }) => [m.mine, m.body])).toEqual([
      [true, "Qual a sua cor favorita?"],
      [false, "Azul!"],
    ]);
    const c2 = JSON.stringify(await svc.getConversation(users[2], id));
    expect(c2).not.toMatch(/Ana|ana@/);
    // notificações ao sorteado também são anônimas
    const notes = JSON.stringify((await svc.getNotifications(users[2])).notifications);
    expect(notes).not.toMatch(/Ana/);
  });

  it("não existe conversa entre participantes aleatórios nem usuário de fora", async () => {
    const { id } = await setupGroup(5);
    await svc.performDraw(users[0], id);
    // B só conversa com quem tirou e com quem o tirou; mandar como GIVER sem ter tirado ninguém não existe
    const c = (await svc.getConversation(users[1], id)) as any; // eslint-disable-line @typescript-eslint/no-explicit-any
    expect(c.asGiver).not.toBeNull();
    expect(c.asReceiver).not.toBeNull();
    await expect(svc.postMessage(users[5], id, { as: "GIVER", body: "oi" })).rejects.toMatchObject({ httpStatus: 404 });
    // depois de invalidar, a conversa antiga some (atribuição inválida)
    await svc.postMessage(users[1], id, { as: "GIVER", body: "oi" });
    await svc.invalidateDraw(users[0], id);
    const after = (await svc.getConversation(users[1], id)) as any; // eslint-disable-line @typescript-eslint/no-explicit-any
    expect(after.asGiver).toBeNull();
    await expect(svc.postMessage(users[1], id, { as: "GIVER", body: "ainda aí?" })).rejects.toMatchObject({ code: "GROUP_STATE" });
  });

  it("contagem de não lidas zera ao abrir a conversa", async () => {
    const { id } = await setupGroup(4);
    await svc.performDraw(users[0], id);
    const friend = NAMES.indexOf((await who(id, 1))!);
    await svc.postMessage(users[1], id, { as: "GIVER", body: "oi" });
    const friendView = (await svc.getMyAssignment(users[friend], id)) as { messages?: unknown };
    void friendView;
    const giverSide = (await svc.getMyAssignment(users[1], id)) as { messages: { unread: number } };
    expect(giverSide.messages.unread).toBe(0);
    await svc.getConversation(users[friend], id);
    const [{ n }] = await db.sql`select count(*)::int as n from secret_santa_messages where read_at is null`;
    expect(n).toBe(0);
  });
});

describe("histórico, duplicar e não repetir o ano passado", () => {
  it("duplica o grupo (pessoas e restrições, nunca o sorteio) e evita repetir quem tirou", async () => {
    const { id, pid } = await setupGroup(4);
    await svc.addRestrictions(users[0], id, { fromIds: [pid(1)], toIds: [pid(2)], bothWays: true });
    await svc.performDraw(users[0], id);
    const before = [0, 1, 2, 3].map((i) => 0 + i).map(async (i) => who(id, i));
    const lastYear = await Promise.all(before);
    await svc.completeGroup(users[0], id);

    const next = await svc.duplicateGroup(users[0], id, { name: "Família 2027", copyBudget: true });
    const [{ n }] = await db.sql`select count(*)::int as n from secret_santa_assignments where group_id = ${next.id}`;
    expect(n).toBe(0);
    const view = (await svc.getGroupView(users[0], next.id)) as View;
    expect(view.group).toMatchObject({ name: "Família 2027", avoidPrevious: true, budgetMaxCents: 10000 });
    expect(view.restrictions).toHaveLength(2);
    expect(view.counts).toMatchObject({ accepted: 1, pending: 3 });
    // convites aparecem na aba "Convites" dos participantes copiados
    const invites = (await svc.listMyGroups(users[2])).invites;
    expect(invites.map((i) => i.groupName)).toContain("Família 2027");
    for (const i of [1, 2, 3]) await svc.acceptInvite(users[i], invites.find(() => true) ? (await repo.listPendingInvites(users[i], `${NAMES[i].toLowerCase()}@example.com`))[0].token : "");

    for (let k = 0; k < 8; k += 1) {
      await svc.performDraw(users[0], next.id);
      for (let i = 0; i < 4; i += 1) expect(await who(next.id, i)).not.toBe(lastYear[i]);
    }
  });

  it("lista de grupos: ativos, concluídos e convites", async () => {
    const { id } = await setupGroup(4);
    const g2 = await svc.createGroup(users[0], { name: "Outro" });
    await svc.performDraw(users[0], id);
    await svc.completeGroup(users[0], id);
    const list = await svc.listMyGroups(users[0]);
    expect(list.active.map((g) => g.id)).toEqual([g2.id]);
    expect(list.completed.map((g) => g.id)).toEqual([id]);
    // convite por e-mail
    const inv = await svc.addParticipant(users[0], g2.id, { name: "Fabio", email: "fabio@example.com" });
    const invites = (await svc.listMyGroups(users[5])).invites;
    expect(invites.map((i) => i.token)).toContain(inv.inviteToken);
  });

  it("aviso do organizador notifica participantes", async () => {
    const { id } = await setupGroup(3);
    await svc.postAnnouncement(users[0], id, { body: "Levem 1 prato" });
    expect(((await svc.getGroupView(users[1], id)) as View).announcements[0].body).toBe("Levem 1 prato");
    expect((await svc.getNotifications(users[1])).notifications.some((n) => n.type === "ANNOUNCEMENT")).toBe(true);
  });
});
