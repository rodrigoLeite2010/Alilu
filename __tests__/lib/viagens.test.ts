import { describe, it, expect } from "vitest";
import { calculateTrip, newTrip, parseTrip, generateChecklist, routeSignature, tripDays, cents } from "@/lib/viagens/planner";
describe("Planejador de viagem", () => {
  it("calcula dias civis e noites sem interferência de fuso", () => {
    expect(tripDays({ ...newTrip(), departure: "2026-10-23", returnDate: "2026-10-25" })).toEqual({ days: 3, nights: 2, valid: true });
    expect(tripDays({ ...newTrip(), departure: "2026-10-23", returnDate: "2026-10-23" }).days).toBe(1);
    expect(tripDays(newTrip()).valid).toBe(false);
  });
  it("calcula ida e volta, consumo misto e pedágios distintos", () => {
    const t = { ...newTrip(), distance: 300, consumption: 12, urbanConsumption: 8, urbanPercent: 20, fuelPrice: 6, tollOut: 20, tollBack: 25 };
    const s = calculateTrip(t);
    expect(s.distance).toBe(600); expect(s.liters).toBeCloseTo(55); expect(s.fuel).toBe(33000); expect(s.categories.Transporte).toBe(37500);
    const oneWay = calculateTrip({ ...t, roundTrip: false }); expect(oneWay.distance).toBe(300); expect(oneWay.categories.Transporte).toBe(18500);
  });
  it("usa distância total da API sem dobrar de novo e invalida consulta alterada", () => {
    const t = newTrip(); t.origin = "A"; t.destination = "B"; t.distance = 300;
    t.route = { signature: routeSignature(t), distance: 650, minutes: 400, fetchedAt: "2026-10-21", labels: [], coordinates: [] };
    expect(calculateTrip(t).distance).toBe(650);
    t.stops = ["C"]; expect(calculateTrip(t).distance).toBe(600); expect(calculateTrip(t).warnings.join()).toMatch(/trajeto foi alterado/);
  });
  it("não duplica passagens, custos do roteiro ou despesas realizadas", () => {
    const t = newTrip(); Object.assign(t, { transport: "avião", adults: 2, children: 1, departure: "2026-10-23", returnDate: "2026-10-25", contingency: 10 });
    Object.assign(t.costs, { tickets: 1500, nightly: 200, breakfast: 10, lunch: 20, dinner: 20, snacks: 5, groceries: 50, tours: 40 });
    t.itinerary = [{ id: "a", title: "Museu", day: 2, time: "10:00", cost: 60 }];
    t.actual = [{ id: "b", category: "Transporte", title: "Passagens", amount: 1450, date: "2026-10-21" }];
    const s = calculateTrip(t);
    expect(s.categories).toEqual({ Transporte: 150000, Hospedagem: 40000, Alimentação: 54500, Lazer: 10000, Extras: 0 });
    expect(s.total).toBe(279950); expect(s.actual).toBe(145000);
    t.foodMode = "group"; expect(calculateTrip(t).categories.Alimentação).toBe(21500);
  });
  it("trata zero confirmado e pedágio ausente de forma diferente", () => {
    const t = newTrip(); expect(calculateTrip(t).warnings.join()).toMatch(/Pedágios pendentes/);
    t.tollOut = 0; t.tollBack = 0; expect(calculateTrip(t).warnings.join()).not.toMatch(/Pedágios pendentes/);
    expect(calculateTrip({ ...t, consumption: 0 }).total).toBe(0);
  });
  it("arredonda centavos e distribui economia por períodos restantes", () => {
    const t = newTrip(); t.transport = "ônibus"; t.costs.tickets = 1.005; t.contingency = 0; t.departure = "2026-10-28";
    expect(cents(1.005)).toBe(101); expect(calculateTrip(t, "2026-10-21").weekly).toBe(101);
    expect(Number.isFinite(calculateTrip({ ...t, adults: 0 }).perPerson)).toBe(true);
  });
  it("gera sugestões condicionais para bebê, animais, clima e atividades", () => {
    const t = newTrip(); Object.assign(t, { children: 1, childAges: "1", pets: true, purpose: "praia", climate: "chuva", activities: "trilha" });
    const ids = generateChecklist(t).map(i => i.id);
    expect(ids).toEqual(expect.arrayContaining(["bebe", "retencao", "pet-doc", "banho", "chuva", "trilha"]));
    expect(generateChecklist({ ...t, transport: "avião" }).map(i => i.id)).not.toContain("retencao");
  });
  it("valida restauração, rejeita entradas inválidas e remove procedência de API enviada pelo cliente", () => {
    expect(parseTrip(JSON.parse(JSON.stringify(newTrip())))).toEqual(newTrip());
    for (const bad of [{ adults: 0 }, { adults: 1.5 }, { budget: -1 }, { children: 1, childAges: "abc" }, { children: 1, childAges: "18" }, { children: 0, childAges: "2" }, { fuelPrice: Infinity }, { departure: "2026-02-30" }, { departure: "2026-10-25", returnDate: "2026-10-20" }, { stops: Array(6).fill("Cidade") }, { version: 2 }]) expect(() => parseTrip({ ...newTrip(), ...bad })).toThrow();
    expect(parseTrip({ ...newTrip(), route: { source: "fake" } }).route).toBeNull();
  });
});
