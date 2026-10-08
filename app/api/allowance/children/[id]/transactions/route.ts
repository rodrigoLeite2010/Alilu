import { route } from "@/lib/allowance/backend/route-helpers";
import { getMonthlySummary, listChildTransactions } from "@/lib/allowance/backend/allowance-service";
import { todayInTimezone } from "@/lib/allowance/dates";

export const dynamic = "force-dynamic";

/** GET ?from=&to=&kind=income|expense|savings|reward|allowance&categoryId=&limit=&offset= · ?summary=YYYY-MM devolve o resumo mensal. */
export const GET = route<{ id: string }>(({ userId, params, request }) => {
  const search = new URL(request.url).searchParams;
  const summary = search.get("summary");
  if (summary !== null) {
    const match = /^(\d{4})-(\d{2})$/.exec(summary || todayInTimezone().slice(0, 7));
    const year = match ? Number(match[1]) : new Date().getFullYear();
    const month = match ? Number(match[2]) : new Date().getMonth() + 1;
    return getMonthlySummary(userId, params.id, year, Math.min(12, Math.max(1, month)));
  }
  return listChildTransactions(userId, params.id, Object.fromEntries(search.entries()));
});
