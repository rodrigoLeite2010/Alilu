import "server-only";
import { timingSafeEqual } from "node:crypto";

/**
 * Mesmo mecanismo dos outros crons do projeto: "Authorization: Bearer
 * <segredo>", comparação em tempo constante, segredo de no mínimo 16
 * caracteres. Aceita AI_VIDEO_CRON_SECRET (dedicado, opcional) ou os
 * segredos já usados pelos outros crons (CRON_SECRET /
 * INSTAGRAM_SCHEDULER_SECRET) — o mesmo disparador externo serve para todos.
 */
function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function isAiVideoCronRequestAuthorized(request: Request): boolean {
  const header = request.headers.get("authorization") ?? "";
  if (!header.startsWith("Bearer ")) return false;
  const provided = header.slice("Bearer ".length).trim();
  if (provided.length < 16) return false;
  const secrets = [process.env.AI_VIDEO_CRON_SECRET, process.env.CRON_SECRET, process.env.INSTAGRAM_SCHEDULER_SECRET].filter(
    (value): value is string => typeof value === "string" && value.length >= 16,
  );
  return secrets.some((secret) => safeEqual(provided, secret));
}
