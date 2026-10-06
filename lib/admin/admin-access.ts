import "server-only";
import { auth } from "@/auth";

import { isAdminEmail } from "./admin-email";

export { isAdminEmail };

/** Sessão do admin, ou null (não logado ou não autorizado). */
export async function getAdminSession(): Promise<{ userId: string; email: string } | null> {
  const session = await auth();
  const email = session?.user?.email ?? null;
  const userId = session?.user?.id ?? null;
  if (!userId || !email || !isAdminEmail(email)) return null;
  return { userId, email };
}
