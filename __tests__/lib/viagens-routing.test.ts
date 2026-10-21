// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";
import { fetchRoadRoute } from "@/lib/viagens/routing";
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
const input = { origin: "São Paulo, SP", destination: "Rio de Janeiro, RJ", stops: ["Ubatuba, SP"], roundTrip: true };
it("não faz chamadas com integração desativada", async () => {
  vi.stubEnv("TRAVEL_ROUTES_ENABLED", "false"); const mock = vi.fn(); vi.stubGlobal("fetch", mock);
  await expect(fetchRoadRoute(input)).rejects.toThrow(/manualmente/); expect(mock).not.toHaveBeenCalled();
});
it("envia todos os pontos e o retorno, sem expor a chave no resultado", async () => {
  vi.stubEnv("TRAVEL_ROUTES_ENABLED", "true"); vi.stubEnv("ORS_API_KEY", "server-secret");
  const mock = vi.fn().mockResolvedValueOnce(Response.json({ features: [{ geometry: { coordinates: [-46, -23] }, properties: { label: "São Paulo" } }] }))
    .mockResolvedValueOnce(Response.json({ features: [{ geometry: { coordinates: [-45, -23] }, properties: { label: "Ubatuba" } }] }))
    .mockResolvedValueOnce(Response.json({ features: [{ geometry: { coordinates: [-43, -22] }, properties: { label: "Rio" } }] }))
    .mockResolvedValueOnce(Response.json({ features: [{ properties: { summary: { distance: 900000, duration: 36000 } }, geometry: { coordinates: [[-46, -23], [-43, -22]] } }] }));
  vi.stubGlobal("fetch", mock); const result = await fetchRoadRoute(input);
  expect(result.distance).toBe(900); expect(result.minutes).toBe(600); expect(JSON.stringify(result)).not.toContain("server-secret");
  expect(JSON.parse(mock.mock.calls[3][1].body).coordinates).toEqual([[-46, -23], [-45, -23], [-43, -22], [-45, -23], [-46, -23]]);
});
it("trata limite de provedor, falha de rede e cidade ausente", async () => {
  vi.stubEnv("TRAVEL_ROUTES_ENABLED", "true"); vi.stubEnv("ORS_API_KEY", "server-secret");
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 429 }))); await expect(fetchRoadRoute(input)).rejects.toThrow(/manual/);
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ features: [] }))); await expect(fetchRoadRoute(input)).rejects.toThrow(/encontrado/);
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Network error"))); await expect(fetchRoadRoute(input)).rejects.toThrow();
});
