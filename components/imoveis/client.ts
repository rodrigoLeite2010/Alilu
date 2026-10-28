export async function estateRequest(
  path: string,
  method = "POST",
  data?: unknown,
) {
  const response = await fetch(`/api/imoveis${path}`, {
    method,
    headers: data === undefined ? {} : { "Content-Type": "application/json" },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
  const result = await response.json();
  if (!response.ok)
    throw new Error(result.error ?? "Não foi possível concluir.");
  return result;
}
