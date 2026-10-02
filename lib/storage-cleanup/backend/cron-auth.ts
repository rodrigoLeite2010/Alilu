import "server-only";
import { timingSafeEqual } from "node:crypto";

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/** Bearer do cron de limpeza: STORAGE_CLEANUP_CRON_SECRET, ou os segredos de cron já existentes. */
export function isStorageCleanupCronAuthorized(request: Request): boolean {
  const header = request.headers.get("authorization") ?? "";
  if (!header.startsWith("Bearer ")) return false;
  const provided = header.slice("Bearer ".length).trim();
  if (provided.length < 16) return false;
  const secrets = [process.env.STORAGE_CLEANUP_CRON_SECRET, process.env.CRON_SECRET, process.env.INSTAGRAM_SCHEDULER_SECRET].filter(
    (value): value is string => typeof value === "string" && value.length >= 16,
  );
  return secrets.some((secret) => safeEqual(provided, secret));
}
