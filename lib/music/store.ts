import "server-only";
import { randomBytes, randomUUID } from "node:crypto";
import { getDb } from "@/lib/db/client";
import { trackSpeed, type Live, type Program, type SetData } from "./types";
import { MusicError, number, playbackInput, requireValue, setInput, songInput, uuid } from "./validation";

type Input = Record<string, unknown>;
type Row = Record<string, unknown>;

function entity(row: Row) {
  return { ...(row.data as object), id: row.id, revision: row.revision };
}

async function quota(user: string, bucket: string, limit: number) {
  const db = getDb();
  const rows = await db`
    insert into music_quotas as q (user_id, bucket) values (${user}, ${bucket})
    on conflict (user_id, bucket) do update set
      calls = case when q.window_start < now() - interval '1 minute' then 1 else q.calls + 1 end,
      window_start = case when q.window_start < now() - interval '1 minute' then now() else q.window_start end
    where q.calls < ${limit} or q.window_start < now() - interval '1 minute'
    returning calls`;
  requireValue(rows.length, "Muitas solicitações. Aguarde um minuto.", 429);
}

export async function library(user: string) {
  const db = getDb();
  const [songs, sets, sessions] = await Promise.all([
    db`select id, revision, data - array['chart','notes','url','source'] as data from music_songs where user_id = ${user} order by updated_at desc`,
    db`select id, revision, data, played_at from music_sets where user_id = ${user} order by updated_at desc`,
    db`select id, program->>'name' as name, ended or expires_at <= now() as ended, updated_at from music_live
        where user_id = ${user} order by updated_at desc limit 20`,
  ]);
  return { songs: songs.map(entity), sets: sets.map((row) => ({ ...entity(row), playedAt: row.played_at })), sessions };
}

export async function readSong(user: string, id: string) {
  const db = getDb();
  const [row] = await db`select * from music_songs where id = ${id} and user_id = ${user}`;
  requireValue(row, "Música não encontrada.", 404);
  return entity(row);
}

export async function programFor(user: string, id: string, revision?: number): Promise<Program> {
  const db = getDb();
  const [row] = await db`
    select r.data, r.revision,
      (select jsonb_agg(jsonb_build_object('item', i.value, 'song', s.data ||
          jsonb_build_object('id', s.id, 'revision', s.revision)) order by i.position)
       from jsonb_array_elements(r.data->'items') with ordinality i(value, position)
       join music_songs s on s.id = (i.value->>'songId')::uuid and s.user_id = r.user_id) as tracks
    from music_sets r where r.id = ${id} and r.user_id = ${user}`;
  requireValue(row, "Repertório não encontrado.", 404);
  requireValue(revision === undefined || row.revision === revision, "O repertório mudou. Reabra e tente novamente.", 409);
  const { items, ...details } = row.data as SetData;
  const tracks = (row.tracks ?? []) as Program["tracks"];
  requireValue(tracks.length > 0, "Adicione músicas ao repertório primeiro.");
  requireValue(items.length === tracks.length, "Remova as músicas excluídas do repertório antes de usar o palco.", 409);
  return { ...details, tracks };
}

async function save(user: string, input: Input, kind: "song" | "set") {
  const db = getDb();
  const id = uuid(input.id);
  const revision = number(input.revision, 0, 2_000_000_000);
  requireValue(Number.isInteger(revision));
  const data = kind === "song" ? songInput(input.data) : setInput(input.data);
  const payload = JSON.stringify(data);
  requireValue(Buffer.byteLength(payload) <= (kind === "song" ? 240000 : 62000), "O conteúdo excede o limite de armazenamento.");
  const table = kind === "song" ? "music_songs" : "music_sets";
  if ("items" in data) {
    const ids = [...new Set(data.items.map((item) => item.songId))];
    const rows = await db`select id from music_songs where user_id = ${user} and id = any(${ids}::uuid[])`;
    requireValue(rows.length === ids.length, "Há músicas indisponíveis neste repertório.", 409);
  }
  // Nomes fixos, selecionados acima. O lock serializa a verificação da cota por conta.
  const rows = revision === 0
    ? await db.transaction([
      db`select id from users where id = ${user} for update`,
      db.query(`insert into ${table} (id,user_id,data)
        select $1,$2,$3::jsonb where (select count(*) from ${table} where user_id=$2) < $4
        on conflict (id) do nothing returning *`, [id, user, payload, kind === "song" ? 500 : 100]),
    ]).then((results) => results[1])
    : await db.query(`update ${table} set data=$3::jsonb, revision=revision+1, updated_at=now()
       where id=$1 and user_id=$2 and revision=$4 returning *`, [id, user, payload, revision]);
  requireValue(rows[0], "O item mudou em outro dispositivo ou o limite da biblioteca foi atingido.", 409);
  return kind === "song" ? entity(rows[0]) : { ...entity(rows[0]), playedAt: rows[0].played_at };
}

function liveView(row: Row, user: string): Live {
  const owner = row.user_id === user;
  return {
    id: row.id as string, version: row.version as number, updatedAt: new Date(row.updated_at as string).toISOString(),
    serverTime: new Date(row.server_time as string).toISOString(), state: row.state as Live["state"],
    ended: row.ended as boolean, owner, participant: row.participant as string, leader: row.controller === row.participant,
    ...(owner && !row.ended ? { code: row.code as string } : {}),
    ...(row.devices && !row.ended ? { devices: row.devices as Live["devices"] } : {}),
    ...(row.program && !row.ended ? { program: row.program as Program } : {}),
  };
}

export async function readLive(user: string, id: string, device: string, loaded: boolean) {
  const db = getDb();
  const [row] = await db`
    select l.id, l.user_id, l.controller, l.code, l.state, l.version, l.updated_at, d.participant,
      l.ended or l.expires_at <= now() as ended, clock_timestamp() as server_time,
      case when not ${loaded} then l.program end as program,
      case when l.user_id = ${user} or l.controller = d.participant then (
        select jsonb_agg(jsonb_build_object('participant', p.participant, 'joinedAt', p.joined_at) order by p.joined_at)
        from music_live_devices p where p.session_id = l.id and p.seen_at > now() - interval '45 seconds'
      ) end as devices
    from music_live l join music_live_devices d on d.session_id = l.id
    where l.id = ${id} and d.user_id = ${user} and d.device = ${device}`;
  requireValue(row, "Sessão indisponível para este dispositivo.", 404);
  return liveView(row, user);
}

export async function musicAction(user: string, input: Input) {
  const db = getDb();
  const action = input.action;
  if (action === "live-read") {
    return readLive(user, uuid(input.id), uuid(input.device), input.loaded === true);
  }
  await quota(user, action === "join" ? "invite" : action === "presence" ? "presence" : "write",
    action === "join" ? 12 : action === "presence" ? 120 : 100);
  switch (action) {
    case "song-save": return save(user, input, "song");
    case "set-save": return save(user, input, "set");
    case "song-delete": {
      const song = uuid(input.id);
      await db.transaction([
        db`select id from users where id = ${user} for update`,
        db`delete from music_songs where id = ${song} and user_id = ${user}`,
        db`delete from music_live where user_id = ${user}
          and program @> ${JSON.stringify({ tracks: [{ song: { id: song } }] })}::jsonb`,
      ]);
      return {};
    }
    case "set-delete": {
      await db`delete from music_sets where id = ${uuid(input.id)} and user_id = ${user}`;
      return {};
    }
    case "program": return programFor(user, uuid(input.id));
    case "start": {
      const set = uuid(input.id);
      const device = uuid(input.device);
      const revision = number(input.revision, 1, 2_000_000_000);
      const program = await programFor(user, set, revision);
      const songIds = [...new Set(program.tracks.map(({ song }) => song.id))];
      const payload = JSON.stringify(program);
      requireValue(Buffer.byteLength(payload) < 1_400_000, "O repertório está grande demais para compartilhar em uma sessão.");
      const state = { index: 0, position: 0, speed: trackSpeed(program.tracks[0]), extent: 0, playing: false };
      const id = randomUUID();
      const code = randomBytes(9).toString("base64url");
      const participant = randomUUID();
      const [, , rows] = await db.transaction([
        db`select id from users where id = ${user} for update`,
        db`delete from music_live where user_id = ${user} and expires_at <= now()`,
        db`with created as (
          insert into music_live (id,set_id,user_id,controller,code,program,state)
          select ${id},${set},${user},${participant},${code},${payload}::jsonb,${JSON.stringify(state)}::jsonb
          where (select count(*) from music_live where user_id = ${user}) < 20
            and exists(select 1 from music_sets where id = ${set} and user_id = ${user} and revision = ${revision})
            and (select count(*) from music_songs where user_id = ${user} and id = any(${songIds}::uuid[])) = ${songIds.length}
          returning id
        ), recent as (
          update music_sets set played_at = now() where id = ${set} and exists(select 1 from created)
        ) insert into music_live_devices(session_id, device, user_id, participant)
          select id, ${device}, ${user}, ${participant} from created returning session_id`,
      ]);
      requireValue(rows.length, "O repertório mudou ou o limite de 20 sessões em 12 horas foi atingido.", 409);
      return readLive(user, id, device, false);
    }
    case "join": {
      const device = uuid(input.device);
      const id = input.id ? uuid(input.id) : null;
      const code = typeof input.code === "string" && /^[A-Za-z0-9_-]{12}$/.test(input.code.trim()) ? input.code.trim() : null;
      requireValue(id || code, "Informe o código de convite.");
      const [, rows] = await db.transaction([
        db`select id from music_live where (code = ${code} or (id = ${id} and user_id = ${user})) for update`,
        db`insert into music_live_devices as d (session_id, device, user_id)
          select l.id, ${device}, ${user} from music_live l
          where (l.code = ${code} or (l.id = ${id} and l.user_id = ${user}))
            and not l.ended and l.expires_at > now()
            and ((select count(*) from music_live_devices p where p.session_id = l.id) < 100
                 or exists(select 1 from music_live_devices p where p.session_id=l.id and p.device=${device}))
          on conflict (session_id, device) do update set seen_at = now() where d.user_id = excluded.user_id
          returning session_id`,
      ]);
      requireValue(rows[0], "Convite indisponível, encerrado ou com lotação máxima.", 404);
      return readLive(user, rows[0].session_id as string, device, false);
    }
    case "presence": {
      await db`update music_live_devices set seen_at = now()
        where session_id = ${uuid(input.id)} and device = ${uuid(input.device)} and user_id = ${user}`;
      return {};
    }
    case "leave": {
      await db`update music_live_devices set seen_at = '-infinity'
        where session_id = ${uuid(input.id)} and device = ${uuid(input.device)} and user_id = ${user}`;
      return {};
    }
    case "control": {
      const id = uuid(input.id);
      const device = uuid(input.device);
      const target = input.target ? uuid(input.target) : null;
      const version = number(input.version, 1, 2_000_000_000);
      const end = input.end === true;
      const state = playbackInput(input.state);
      const rows = await db`
        update music_live l set controller = coalesce(${target}::uuid, l.controller), ended = ${end},
          program = case when ${end} then jsonb_build_object('name', l.program->>'name') else l.program end,
          state = ${JSON.stringify(state)}::jsonb, version = version + 1, updated_at = clock_timestamp()
        where l.id = ${id} and l.version = ${version} and not l.ended and l.expires_at > now()
          and ${state.index} < jsonb_array_length(l.program->'tracks')
          and exists (
            select 1 from music_live_devices d
            where d.session_id = l.id and d.device = ${device} and d.user_id = ${user}
              and (l.controller = d.participant or (l.user_id = ${user} and (${target}::uuid = d.participant or ${end})))
          )
          and (${target}::uuid is null or exists (select 1 from music_live_devices d where d.session_id = l.id and d.participant = ${target} and d.seen_at > now() - interval '45 seconds'))
        returning id`;
      requireValue(rows.length, "O controle ou o estado da sessão mudou. Aguarde a sincronização.", 409);
      return readLive(user, id, device, true);
    }
    default: throw new MusicError("Operação desconhecida.");
  }
}
