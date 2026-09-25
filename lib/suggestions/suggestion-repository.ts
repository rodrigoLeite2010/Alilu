import "server-only";
import { getDb } from "@/lib/db/client";

const MAX_MESSAGE_LENGTH = 1200;
const MAX_PAGE_PATH_LENGTH = 300;
const MAX_USER_AGENT_LENGTH = 500;

export interface SuggestionRecord {
  id: string;
  message: string;
  pagePath: string | null;
  status: string;
  createdAt: string;
}

function cleanText(value: string, maxLength: number): string {
  return value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

export function sanitizeSuggestionMessage(value: unknown): string {
  if (typeof value !== "string") return "";
  return cleanText(value, MAX_MESSAGE_LENGTH);
}

export function sanitizeSuggestionMeta(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const cleaned = cleanText(value, maxLength);
  return cleaned || null;
}

export async function createSuggestion(input: {
  message: string;
  pagePath?: string | null;
  userAgent?: string | null;
}): Promise<string> {
  const message = sanitizeSuggestionMessage(input.message);
  if (message.length < 3) {
    throw new Error("Conte um pouco mais sobre a ferramenta que você gostaria.");
  }

  const pagePath = sanitizeSuggestionMeta(input.pagePath, MAX_PAGE_PATH_LENGTH);
  const userAgent = sanitizeSuggestionMeta(input.userAgent, MAX_USER_AGENT_LENGTH);
  const db = getDb();
  const rows = await db`
    insert into suggestions (message, page_path, user_agent)
    values (${message}, ${pagePath}, ${userAgent})
    returning id
  `;
  return rows[0].id as string;
}

export async function listSuggestions(limit = 200): Promise<SuggestionRecord[]> {
  const db = getDb();
  const rows = await db`
    select id, message, page_path, status, created_at
    from suggestions
    order by created_at desc
    limit ${limit}
  `;

  return rows.map((row) => ({
    id: row.id as string,
    message: row.message as string,
    pagePath: (row.page_path as string | null) ?? null,
    status: row.status as string,
    createdAt: new Date(row.created_at as string).toISOString(),
  }));
}
