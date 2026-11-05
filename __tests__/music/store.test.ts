// @vitest-environment node
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { createTestDb, type TestDb } from "../helpers/pglite-db";
import { emptySet, emptySong, type Live, type MusicSet, type Song } from "@/lib/music/types";
import { library, musicAction, programFor, readSong } from "@/lib/music/store";

let db: TestDb;
let owner: string;
let guest: string;
let stranger: string;

vi.mock("@/lib/db/client", () => {
  type Executor = Pick<TestDb["pg"], "query">;
  function query(text: string, values: unknown[]) {
    const run = async (executor: Executor) => (await executor.query<Record<string, unknown>>(text, values)).rows;
    return Object.assign(run, {
      then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => run(db.pg).then(resolve, reject),
    });
  }
  return { getDb: () => Object.assign(
    (strings: TemplateStringsArray, ...values: unknown[]) =>
      query(strings.reduce((text, part, index) => text + (index ? "$" + index : "") + part, ""), values),
    {
      query,
      transaction: (queries: ReturnType<typeof query>[]) => db.pg.transaction(async (tx) => {
        const results = [];
        for (const run of queries) results.push(await run(tx));
        return results;
      }),
    },
  ) };
});

beforeAll(async () => {
  db = await createTestDb();
  const users = await db.sql`insert into users(email) values ('owner@music.test'), ('guest@music.test'), ('stranger@music.test') returning id`;
  [owner, guest, stranger] = users.map((row) => row.id as string);
});
afterAll(() => db?.close());

const makeSong = (user: string, title: string) => musicAction(user, {
  action: "song-save", id: randomUUID(), revision: 0,
  data: { ...emptySong, title, originalKey: "C", chart: "[C]Um [G/B]verso" },
}) as Promise<Song>;

const saveSet = (user: string, id: string, revision: number, ids: string[]) => musicAction(user, {
  action: "set-save", id, revision,
  data: { ...emptySet, name: "Ensaio", items: ids.map((songId) => ({ id: randomUUID(), songId, key: "D", speed: 30, notes: "" })) },
}) as Promise<MusicSet>;

it("persiste a edição com controle de versão e isola a biblioteca por conta", async () => {
  const song = await makeSong(owner, "Canção original");
  const edit = { action: "song-save", id: song.id, revision: song.revision, data: { ...song, title: "Edição" } };
  await expect(musicAction(guest, edit)).rejects.toMatchObject({ status: 409 });
  await expect(musicAction(owner, edit)).resolves.toMatchObject({ revision: 2, title: "Edição" });
  await expect(musicAction(owner, edit)).rejects.toMatchObject({ status: 409 });
  await expect(readSong(guest, song.id)).rejects.toMatchObject({ status: 404 });
  expect((await library(guest)).songs).toEqual([]);
});

it("valida propriedade, guarda a ordem do repertório e aplica tom por faixa", async () => {
  const [first, second] = await Promise.all([makeSong(owner, "Primeira"), makeSong(owner, "Segunda")]);
  const id = randomUUID();
  await expect(saveSet(guest, id, 0, [first.id])).rejects.toMatchObject({ status: 409 });
  const set = await saveSet(owner, id, 0, [first.id, second.id]);
  await saveSet(owner, id, set.revision, [second.id, first.id]);
  const program = await programFor(owner, id);
  expect(program.tracks.map(({ song }) => song.id)).toEqual([second.id, first.id]);
  expect(program.tracks[0].item.key).toBe("D");
});

it("espelha, reconecta, isola sessões e transfere controle entre dispositivos", async () => {
  const [first, second] = await Promise.all([makeSong(owner, "A"), makeSong(owner, "B")]);
  const set = await saveSet(owner, randomUUID(), 0, [first.id, second.id]);
  const device = randomUUID();
  const secondary = randomUUID();
  const invited = randomUUID();
  const start = await musicAction(owner, { action: "start", id: set.id, revision: set.revision, device }) as Live;
  const join = { action: "join", code: start.code };
  const read = { action: "live-read", id: start.id };
  const control = { action: "control", id: start.id, version: start.version, state: { index: 1, playing: true, extent: 500, speed: 50, position: 0.2 } };
  expect(start.leader).toBe(true);
  await expect(musicAction(guest, { action: "join", id: start.id, device: invited })).rejects.toMatchObject({ status: 404 });
  const guestView = await musicAction(guest, { ...join, device: invited }) as Live;
  expect(guestView).toMatchObject({ leader: false, owner: false });
  expect(await musicAction(guest, { ...read, device: invited })).not.toHaveProperty("code");
  await expect(musicAction(owner, { action: "join", id: start.id, device: secondary })).resolves.toMatchObject({ leader: false, owner: true });
  await expect(musicAction(stranger, { ...read, device: invited })).rejects.toMatchObject({ status: 404 });
  await expect(musicAction(guest, { ...control, device: invited })).rejects.toMatchObject({ status: 409 });
  await expect(musicAction(owner, { ...control, device: secondary })).rejects.toMatchObject({ status: 409 });
  const next = await musicAction(owner, { ...control, device }) as Live;
  expect(next.version).toBe(start.version + 1);
  await expect(musicAction(owner, { ...control, device })).rejects.toMatchObject({ status: 409 });
  await expect(musicAction(guest, { ...read, device: invited, loaded: true })).resolves.toMatchObject({ state: control.state, version: next.version });
  const transfer = await musicAction(owner, { ...control, device, version: next.version, target: guestView.participant }) as Live;
  expect(transfer.leader).toBe(false);
  await expect(musicAction(guest, { ...read, device: invited })).resolves.toMatchObject({ leader: true });
  await expect(musicAction(guest, { ...control, device: invited, version: transfer.version, end: true })).resolves.toMatchObject({ ended: true });
  expect(await musicAction(guest, { ...read, device: invited })).not.toHaveProperty("program");
  expect(await db.sql`select program from music_live where id = ${start.id}`).toEqual([{ program: { name: set.name } }]);
});

it("encerra sessões que contêm uma música excluída pelo dono", async () => {
  const song = await makeSong(owner, "Cifra removida");
  const set = await saveSet(owner, randomUUID(), 0, [song.id]);
  const device = randomUUID();
  const start = await musicAction(owner, { action: "start", id: set.id, revision: set.revision, device }) as Live;
  await musicAction(guest, { action: "song-delete", id: song.id });
  await expect(readSong(owner, song.id)).resolves.toMatchObject({ id: song.id });
  await musicAction(owner, { action: "song-delete", id: song.id });
  await expect(musicAction(owner, { action: "live-read", id: start.id, device })).rejects.toMatchObject({ status: 404 });
  await expect(readSong(owner, song.id)).rejects.toMatchObject({ status: 404 });
});
