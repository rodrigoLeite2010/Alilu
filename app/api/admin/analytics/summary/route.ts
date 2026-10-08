import { adminAnalyticsResponse } from "@/lib/analytics/backend/analytics-route";
import { getAnalyticsSummary } from "@/lib/analytics/backend/analytics-service";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** GET: só ADMIN_EMAILS. Dados do PostHog com cache curto (ver analytics-service). */
export async function GET(): Promise<Response> {
  return adminAnalyticsResponse(() => getAnalyticsSummary());
}
