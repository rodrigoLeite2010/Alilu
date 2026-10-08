/** Cliente das rotas /api/allowance (tudo é calculado e validado no servidor). */
export async function call<T = unknown>(method: string, url: string, body?: unknown): Promise<{ data?: T; error?: string }> {
  try {
    const response = await fetch(url, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
    });
    const payload = (await response.json().catch(() => ({}))) as { data?: T; error?: string };
    if (!response.ok) return { error: payload.error ?? "Não foi possível concluir agora." };
    return { data: payload.data };
  } catch {
    return { error: "Sem conexão. Tente novamente." };
  }
}

export function formatDateBr(iso: string | null | undefined): string {
  if (!iso) return "";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}
export function formatDayMonth(iso: string | null | undefined): string {
  if (!iso) return "";
  const [, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}`;
}
