import { route, readBody } from "@/lib/allowance/backend/route-helpers";
import { createCategory, listUserCategories } from "@/lib/allowance/backend/allowance-service";

export const dynamic = "force-dynamic";

/** GET ?all=1: padrão + minhas. POST { name, type, icon?, color? } */
export const GET = route(({ userId, request }) => listUserCategories(userId, new URL(request.url).searchParams.get("all") === "1"));
export const POST = route(async ({ userId, request }) => createCategory(userId, await readBody(request)), 201);
