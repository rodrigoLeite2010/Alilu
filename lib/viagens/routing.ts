import "server-only";
import { routeSignature, type RouteEstimate } from "./planner";
export function routingEnabled() { return process.env.TRAVEL_ROUTES_ENABLED === "true" && Boolean(process.env.ORS_API_KEY); }
type Input = { origin: string; destination: string; stops: string[]; roundTrip: boolean };
export async function fetchRoadRoute(input: Input): Promise<RouteEstimate> {
  if (!routingEnabled()) throw new Error("Rotas automáticas não estão configuradas. Informe a distância manualmente.");
  const key = process.env.ORS_API_KEY!;
  // No persistent provider cache until storage rights and account terms are verified.
  const read = async (url: string, init?: RequestInit) => {
    const res = await fetch(url, { ...init, cache: "no-store", signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error("Provedor de rotas indisponível ou limite atingido. Use a distância manual.");
    return res.json();
  };
  const points: number[][] = [], labels: string[] = [];
  for (const city of [input.origin, ...input.stops, input.destination]) {
    const url = new URL("https://api.openrouteservice.org/geocode/search");
    url.searchParams.set("api_key", key); url.searchParams.set("text", city); url.searchParams.set("size", "1"); url.searchParams.set("boundary.country", "BR");
    const result = await read(url.toString()); const feature = result.features?.[0];
    const coordinate = feature?.geometry?.coordinates;
    if (!Array.isArray(coordinate) || coordinate.length !== 2 || !coordinate.every((n: unknown) => typeof n === "number" && Number.isFinite(n))) throw new Error("Local não encontrado. Informe cidade e estado, ou use distância manual.");
    points.push(coordinate); labels.push(String(feature.properties?.label ?? city));
  }
  const routePoints = input.roundTrip ? [...points, ...points.slice(0, -1).reverse()] : points;
  const result = await read("https://api.openrouteservice.org/v2/directions/driving-car/geojson", { method: "POST", headers: { Authorization: key, "Content-Type": "application/json" }, body: JSON.stringify({ coordinates: routePoints, instructions: false }) });
  const feature = result.features?.[0], summary = feature?.properties?.summary;
  if (!summary || !Number.isFinite(summary.distance) || !Number.isFinite(summary.duration) || summary.distance <= 0 || !Array.isArray(feature.geometry?.coordinates)) throw new Error("Rota não encontrada. Use a distância manual.");
  return { signature: routeSignature(input), distance: summary.distance / 1000, minutes: summary.duration / 60, labels, coordinates: feature.geometry.coordinates.filter((_: unknown, i: number) => i % Math.max(1, Math.ceil(feature.geometry.coordinates.length / 400)) === 0), fetchedAt: new Date().toISOString() };
}
