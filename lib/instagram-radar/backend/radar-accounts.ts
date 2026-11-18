import "server-only";
import { decryptSecret } from "@/lib/instagram/backend/encryption";
import { listInstagramAccountsForUser } from "@/lib/instagram/backend/instagram-account-repository";
import { fetchInstagramProfileDetails } from "@/lib/instagram/backend/meta-graph-client";
import { getAccountCredentialsForProfile } from "./radar-repository";

/**
 * Seletor de conta do Radar Instagram: SÓ as contas do usuário logado que
 * estão conectadas. Foto, nome e tipo vêm da Meta (GET /me, permissão
 * instagram_business_basic já concedida); se a Meta não responder, a conta
 * aparece com o @usuário e o status do Alilu — nada é inventado. Nenhum
 * token sai do servidor.
 */

export interface RadarAccountOption {
  id: string;
  username: string | null;
  name: string | null;
  profilePictureUrl: string | null;
  accountType: string | null;
  status: string;
  authProvider: "instagram_login" | "facebook_login";
}

const PROFILE_TTL_MS = 10 * 60_000;
const PROFILE_TIMEOUT_MS = 4_000;
const profileCache = new Map<string, { at: number; value: Pick<RadarAccountOption, "name" | "profilePictureUrl" | "accountType"> }>();

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([promise, new Promise<T>((_, reject) => (timer = setTimeout(() => reject(new Error("timeout")), ms)))]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function loadProfile(accountId: string, userId: string, now: number) {
  const cached = profileCache.get(accountId);
  if (cached && now - cached.at < PROFILE_TTL_MS) return cached.value;
  const empty = { name: null, profilePictureUrl: null, accountType: null };
  try {
    const credentials = await getAccountCredentialsForProfile(accountId, userId);
    if (!credentials?.accessTokenEncrypted) return empty;
    const profile = await withTimeout(fetchInstagramProfileDetails(decryptSecret(credentials.accessTokenEncrypted), credentials.authProvider), PROFILE_TIMEOUT_MS);
    const value = { name: profile.name, profilePictureUrl: profile.profilePictureUrl, accountType: profile.accountType };
    profileCache.set(accountId, { at: now, value });
    return value;
  } catch {
    return empty;
  }
}

export async function listRadarAccountOptions(userId: string, options: { withProfile?: boolean; now?: number } = {}): Promise<{ accounts: RadarAccountOption[]; needsReconnect: number }> {
  const all = await listInstagramAccountsForUser(userId);
  const connected = all.filter((account) => account.status === "connected");
  const now = options.now ?? Date.now();
  const accounts = await Promise.all(
    connected.map(async (account) => {
      const profile = options.withProfile === false ? { name: null, profilePictureUrl: null, accountType: null } : await loadProfile(account.id, userId, now);
      return {
        id: account.id,
        username: account.igUsername,
        status: account.status,
        authProvider: account.authProvider,
        ...profile,
      };
    }),
  );
  return { accounts, needsReconnect: all.length - connected.length };
}

/** Só para testes. */
export function clearRadarProfileCache(): void {
  profileCache.clear();
}
