import "server-only";
import { getDb } from "@/lib/db/client";
import type { Trip } from "./planner";
export type SavedTrip = { id: string; plan: Trip; archived: boolean; revision: number; updatedAt: string };
export async function listTrips(userId: string): Promise<SavedTrip[]> {
  const db = getDb();
  return await db`select id, plan, archived, revision, updated_at::text as "updatedAt" from travel_plans where user_id = ${userId} order by updated_at desc limit 100` as SavedTrip[];
}
export async function saveTrip(userId: string, plan: Trip, id: string | null, revision: number, archived: boolean): Promise<SavedTrip | null> {
  const db = getDb();
  const rows = id
    ? await db`update travel_plans set plan = ${JSON.stringify(plan)}::jsonb, archived = ${archived}, revision = revision + 1, updated_at = now() where id = ${id} and user_id = ${userId} and revision = ${revision} returning id, plan, archived, revision, updated_at::text as "updatedAt"`
    : await db`insert into travel_plans (user_id, plan, archived) select ${userId}, ${JSON.stringify(plan)}::jsonb, ${archived} where (select count(*) from travel_plans where user_id = ${userId}) < 100 returning id, plan, archived, revision, updated_at::text as "updatedAt"`;
  return (rows[0] as SavedTrip | undefined) ?? null;
}
export async function deleteTrip(userId: string, id: string): Promise<boolean> {
  const db = getDb(); return (await db`delete from travel_plans where id = ${id} and user_id = ${userId} returning id`).length > 0;
}
export async function claimRouteQuota(userId: string): Promise<boolean> {
  const db = getDb();
  return (await db`insert into travel_route_quotas (user_id, calls) values (${userId}, 1)
    on conflict (user_id) do update set
      calls = case when travel_route_quotas.window_start < now() - interval '1 day' then 1 else travel_route_quotas.calls + 1 end,
      window_start = case when travel_route_quotas.window_start < now() - interval '1 day' then now() else travel_route_quotas.window_start end
    where travel_route_quotas.window_start < now() - interval '1 day' or travel_route_quotas.calls < 10 returning user_id`).length > 0;
}
