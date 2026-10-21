export const expenseCategories = ["Transporte", "Hospedagem", "Alimentação", "Lazer", "Extras"] as const;
export type ExpenseCategory = typeof expenseCategories[number];
export type ChecklistItem = { id: string; group: string; text: string; quantity: number; kind: "Recomendação" | "Verificar requisito legal" | "Opcional"; done: boolean };
export type Activity = { id: string; day: number; time: string; title: string; cost: number };
export type ActualExpense = { id: string; category: ExpenseCategory; title: string; amount: number; date: string };
export type RouteEstimate = { signature: string; distance: number; minutes: number; labels: string[]; coordinates: number[][]; fetchedAt: string };
export const costLabels = {
  tickets: "Passagens (total do grupo)", parking: "Estacionamento", stopsCost: "Despesas nas paradas", rides: "Transporte por aplicativo", rental: "Aluguel de veículo", transportOther: "Outras despesas de transporte",
  nightly: "Valor por noite (grupo)", lodgingFees: "Taxas de hospedagem", breakfast: "Café da manhã", lunch: "Almoço", dinner: "Jantar", snacks: "Lanches", groceries: "Mercado (total da viagem)",
  tours: "Passeios fora do roteiro", admissions: "Ingressos", childActivities: "Atividades infantis", shopping: "Compras", leisureOther: "Outros gastos de lazer", insurance: "Seguro viagem", internet: "Internet", petsCost: "Despesas com animais", emergency: "Reserva para emergências",
} as const;
export type CostKey = keyof typeof costLabels;
export type Trip = {
  version: 1; title: string; origin: string; destination: string; stops: string[]; departure: string; returnDate: string; roundTrip: boolean;
  adults: number; children: number; childAges: string; purpose: string; transport: string; vehicle: string; fuel: string; distance: number; minutes: number;
  consumption: number; urbanConsumption: number; urbanPercent: number; fuelPrice: number; ethanolConsumption: number; ethanolPrice: number;
  tollOut: number | null; tollBack: number | null; lodging: string; nightsOverride: number | null; foodMode: "person" | "group";
  costs: Record<CostKey, number>; contingency: number; budget: number; saved: number; breakfastUpgrade: number; dailyChange: number;
  scenarios: [number, number, number]; pets: boolean; activities: string; climate: string;
  checklist: ChecklistItem[]; itinerary: Activity[]; actual: ActualExpense[]; route: RouteEstimate | null;
};
export function newTrip(): Trip {
  return { version: 1, title: "Minha viagem", origin: "", destination: "", stops: [], departure: "", returnDate: "", roundTrip: true, adults: 1, children: 0, childAges: "", purpose: "férias", transport: "carro", vehicle: "", fuel: "gasolina", distance: 0, minutes: 0, consumption: 0, urbanConsumption: 0, urbanPercent: 0, fuelPrice: 0, ethanolConsumption: 0, ethanolPrice: 0, tollOut: null, tollBack: null, lodging: "hotel", nightsOverride: null, foodMode: "person", costs: Object.fromEntries(Object.keys(costLabels).map(k => [k, 0])) as Record<CostKey, number>, contingency: 10, budget: 0, saved: 0, breakfastUpgrade: 0, dailyChange: 0, scenarios: [80, 100, 125], pets: false, activities: "", climate: "não informado", checklist: [], itinerary: [], actual: [], route: null };
}
export function validDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}
export function tripDays(t: Trip) {
  const valid = validDate(t.departure) && validDate(t.returnDate) && t.returnDate >= t.departure;
  const nights = valid ? Math.round((Date.parse(t.returnDate) - Date.parse(t.departure)) / 86400000) : 0;
  return { days: nights + 1, nights: t.nightsOverride ?? nights, valid };
}
export function routeSignature(t: Pick<Trip, "origin" | "destination" | "stops" | "roundTrip">): string {
  return JSON.stringify([t.origin.trim(), ...t.stops.map(s => s.trim()), t.destination.trim(), t.roundTrip]);
}
export const cents = (n: number) => Math.round((n + Number.EPSILON) * 100);
export const money = (n: number) => (n / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export function calculateTrip(t: Trip, today = new Date().toISOString().slice(0, 10)) {
  const { days, nights, valid } = tripDays(t);
  const people = Math.max(1, t.adults + t.children);
  const driving = ["carro", "moto"].includes(t.transport);
  const route = t.route?.signature === routeSignature(t) ? t.route : null;
  const distance = driving ? route?.distance ?? t.distance * (t.roundTrip ? 2 : 1) : 0;
  const liters = driving && t.consumption > 0 && (t.urbanPercent === 0 || t.urbanConsumption > 0)
    ? distance * ((1 - t.urbanPercent / 100) / t.consumption + (t.urbanPercent ? t.urbanPercent / 100 / t.urbanConsumption : 0)) : 0;
  const fuel = cents(liters * t.fuelPrice);
  const c = t.costs;
  const dailyFood = c.breakfast + c.lunch + c.dinner + c.snacks;
  const sum = (...values: number[]) => values.reduce((a, b) => a + cents(b), 0);
  const categories: Record<ExpenseCategory, number> = {
    Transporte: sum(c.tickets, c.parking, c.stopsCost, c.rides, c.rental, c.transportOther) + (driving ? fuel + sum(t.tollOut ?? 0, t.roundTrip ? t.tollBack ?? 0 : 0) : 0),
    Hospedagem: cents(c.nightly * nights) + cents(c.lodgingFees),
    Alimentação: cents(dailyFood * days * (t.foodMode === "person" ? people : 1)) + cents(c.groceries),
    Lazer: sum(c.tours, c.admissions, c.childActivities, c.shopping, c.leisureOther) + t.itinerary.reduce((a, b) => a + cents(b.cost), 0),
    Extras: sum(c.insurance, c.internet, c.petsCost, c.emergency),
  };
  const subtotal = Object.values(categories).reduce((a, b) => a + b, 0);
  const contingency = Math.round(subtotal * t.contingency / 100);
  const total = subtotal + contingency;
  const actualCategories = Object.fromEntries(expenseCategories.map(k => [k, t.actual.filter(e => e.category === k).reduce((a, e) => a + cents(e.amount), 0)])) as Record<ExpenseCategory, number>;
  const actual = Object.values(actualCategories).reduce((a, b) => a + b, 0);
  const remaining = Math.max(0, total - cents(t.saved));
  const until = validDate(t.departure) ? Math.max(0, Math.ceil((Date.parse(t.departure) - Date.parse(today)) / 86400000)) : 0;
  const warnings: string[] = [];
  if (t.adults < 1) warnings.push("Informe pelo menos um adulto.");
  if (t.route && !route) warnings.push("O trajeto foi alterado após a consulta. Consulte novamente ou revise a distância manual anterior.");
  if (!valid) warnings.push("Informe datas válidas para calcular dias e noites; por enquanto consideramos 1 dia e nenhuma noite, salvo ajuste manual.");
  if (driving && !distance) warnings.push("Distância não informada.");
  if (driving && (!t.consumption || !t.fuelPrice || (t.urbanPercent > 0 && !t.urbanConsumption))) warnings.push("Informe preço e consumo para completar o combustível.");
  if (driving && (t.tollOut === null || (t.roundTrip && t.tollBack === null))) warnings.push("Pedágios pendentes: total incompleto. Informe 0 somente se confirmar que não há cobrança.");
  return { days, nights, people, distance, minutes: driving ? route?.minutes ?? t.minutes * (t.roundTrip ? 2 : 1) : 0, liters, fuel, categories, subtotal, contingency, total, perDay: Math.round(total / days), perPerson: Math.round(total / people), actualCategories, actual, difference: actual - total, remaining, budgetDifference: cents(t.budget) - total, committed: t.budget > 0 ? total / cents(t.budget) * 100 : null, weekly: until ? Math.ceil(remaining / Math.ceil(until / 7)) : remaining, monthly: until ? Math.ceil(remaining / Math.ceil(until / 30)) : remaining, until,
    ethanol: t.ethanolConsumption > 0 && t.ethanolPrice > 0 ? cents(distance / t.ethanolConsumption * t.ethanolPrice) : null,
    extraNight: cents(c.nightly + dailyFood * (t.foodMode === "person" ? people : 1)), breakfastSaving: cents(c.breakfast * people - t.breakfastUpgrade), dailyImpact: cents(t.dailyChange * days), warnings };
}

/** Strict allowlist used both by API and local-draft restoration. No arbitrary JSON stored. */
export function parseTrip(value: unknown): Trip {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Viagem inválida.");
  const o = value as Record<string, unknown>, t = newTrip();
  if (o.version !== 1) throw new Error("Versão de viagem incompatível.");
  const text = (v: unknown, max = 180) => { if (typeof v !== "string" || v.length > max) throw new Error("Texto inválido ou muito longo."); return v.trim(); };
  const num = (v: unknown, max = 10000000, integer = false) => { if (typeof v !== "number" || !Number.isFinite(v) || v < 0 || v > max || (integer && !Number.isInteger(v))) throw new Error("Valor numérico inválido."); return v; };
  const array = (v: unknown, max: number): unknown[] => { if (!Array.isArray(v) || v.length > max) throw new Error("Lista inválida ou muito longa."); return v; };
  const record = (v: unknown): Record<string, unknown> => { if (!v || typeof v !== "object" || Array.isArray(v)) throw new Error("Item inválido."); return v as Record<string, unknown>; };
  for (const key of ["title", "origin", "destination", "departure", "returnDate", "childAges", "purpose", "transport", "vehicle", "fuel", "lodging", "activities", "climate"] as const) t[key] = text(o[key]);
  if (!t.title) throw new Error("Dê um nome à viagem.");
  for (const key of ["roundTrip", "pets"] as const) { if (typeof o[key] !== "boolean") throw new Error("Opção inválida."); t[key] = o[key]; }
  for (const key of ["distance", "minutes", "consumption", "urbanConsumption", "urbanPercent", "fuelPrice", "ethanolConsumption", "ethanolPrice", "contingency", "budget", "saved", "breakfastUpgrade", "dailyChange"] as const) t[key] = num(o[key]);
  t.adults = num(o.adults, 100, true); t.children = num(o.children, 100, true);
  if (t.adults < 1 || t.urbanPercent > 100 || t.contingency > 100) throw new Error("Confira viajantes e percentuais.");
  if (t.childAges) { const ages = t.childAges.split(/[,;]+/).map(a => a.trim()); if (ages.length > t.children || ages.some(a => !/^\d{1,2}$/.test(a) || Number(a) > 17)) throw new Error("Informe até uma idade de 0 a 17 anos por criança, separada por vírgula."); }
  if (!["carro", "moto", "ônibus", "avião", "outro"].includes(t.transport)) throw new Error("Transporte inválido.");
  if ((t.departure && !validDate(t.departure)) || (t.returnDate && !validDate(t.returnDate)) || (t.departure && t.returnDate && t.returnDate < t.departure)) throw new Error("A data final deve ser igual ou posterior à saída.");
  if (t.departure && t.returnDate && (Date.parse(t.returnDate) - Date.parse(t.departure)) / 86400000 > 730) throw new Error("Limite de 730 dias por viagem.");
  for (const key of ["tollOut", "tollBack", "nightsOverride"] as const) t[key] = o[key] === null ? null : num(o[key], key === "nightsOverride" ? 730 : 10000000, key === "nightsOverride");
  t.stops = array(o.stops, 5).map(s => text(s));
  const costs = record(o.costs); for (const key of Object.keys(costLabels) as CostKey[]) t.costs[key] = num(costs[key]);
  if (o.foodMode !== "person" && o.foodMode !== "group") throw new Error("Modo de alimentação inválido."); t.foodMode = o.foodMode;
  const scenarios = array(o.scenarios, 3); if (scenarios.length !== 3) throw new Error("Cenários inválidos."); t.scenarios = scenarios.map(n => num(n, 500)) as Trip["scenarios"];
  t.checklist = array(o.checklist, 300).map(v => { const r = record(v); if (!["Recomendação", "Verificar requisito legal", "Opcional"].includes(String(r.kind)) || typeof r.done !== "boolean") throw new Error("Item de mala inválido."); return { id: text(r.id, 80), group: text(r.group, 60), text: text(r.text), quantity: num(r.quantity, 10000, true), kind: r.kind as ChecklistItem["kind"], done: r.done }; });
  t.itinerary = array(o.itinerary, 300).map(v => { const r = record(v), time = text(r.time, 5); if (time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error("Horário inválido."); const day = num(r.day, 731, true); if (!day) throw new Error("Dia inválido."); return { id: text(r.id, 80), day, time, title: text(r.title), cost: num(r.cost) }; });
  t.actual = array(o.actual, 500).map(v => { const r = record(v); if (!expenseCategories.includes(r.category as ExpenseCategory) || !validDate(String(r.date))) throw new Error("Despesa inválida."); return { id: text(r.id, 80), title: text(r.title), date: text(r.date, 10), category: r.category as ExpenseCategory, amount: num(r.amount) }; });
  for (const list of [t.checklist, t.itinerary, t.actual]) if (new Set(list.map(i => i.id)).size !== list.length) throw new Error("Itens duplicados.");
  // Provider estimates are session-only: never trust client-supplied provenance in persisted plans.
  t.route = null;
  return t;
}

export function generateChecklist(t: Trip): ChecklistItem[] {
  const result: ChecklistItem[] = [], { days } = tripDays(t), people = t.adults + t.children;
  const add = (id: string, group: string, text: string, quantity = 1, kind: ChecklistItem["kind"] = "Recomendação") => result.push({ id, group, text, quantity, kind, done: false });
  add("doc", "Documentos", "Documento de identificação aceito no destino", people, "Verificar requisito legal");
  add("reservas", "Documentos", "Reservas e comprovantes");
  if (["avião", "ônibus"].includes(t.transport)) add("passagens", "Documentos", "Passagens e regras de bagagem");
  add("camisetas", "Roupas", "Camisetas (lavagem pode reduzir a quantidade)", Math.min(days, 7) * people);
  for (const [id, label] of [["intimas", "Roupas íntimas"], ["meias", "Pares de meias"]]) add(id, "Roupas", label, Math.min(days + 1, 8) * people);
  for (const [id, label] of [["bermuda", "Bermudas"], ["calca", "Calças"], ["pijama", "Pijamas"], ["calcados", "Calçados confortáveis"]]) add(id, "Roupas", label, people);
  if (t.climate === "frio" || t.purpose === "campo") add("casaco", "Roupas", "Casacos e proteção para frio", people);
  if (t.climate === "chuva") add("chuva", "Roupas", "Capa ou guarda-chuva", people);
  if (t.purpose === "praia" || /praia|piscina|natação/i.test(t.activities)) add("banho", "Roupas", "Roupas de banho", people);
  for (const [id, label] of [["dentes", "Escova e pasta de dentes"], ["shampoo", "Shampoo e sabonete"], ["solar", "Protetor solar"], ["repelente", "Repelente"], ["pessoal", "Itens de higiene pessoais"]]) add(id, "Higiene", label, id === "dentes" ? people : 1);
  for (const [id, label] of [["medicamentos", "Medicamentos habituais e receitas necessárias"], ["kit", "Kit básico de primeiros socorros"]]) add(id, "Saúde", label);
  for (const [id, label] of [["celular", "Celular e carregadores"], ["adaptador", "Adaptadores"], ["power", "Power bank (confira regras da transportadora)"]]) add(id, "Eletrônicos", label, 1, id === "celular" ? "Recomendação" : "Opcional");
  if (["carro", "moto"].includes(t.transport)) {
    add("cnh", "Veículo", "CNH e documento do veículo aplicáveis", 1, "Verificar requisito legal");
    for (const [id, label] of [["pneus", "Conferir pneus e estepe ou kit do fabricante"], ["oleo", "Conferir óleo e freios"]]) add(id, "Veículo", label);
    add("equipamento", "Veículo", "Conferir equipamentos exigidos para seu veículo", 1, "Verificar requisito legal");
  }
  if (t.children) {
    add("menores", "Crianças", "Conferir documentos e eventual autorização para menores", 1, "Verificar requisito legal");
    if (t.transport === "carro") add("retencao", "Crianças", `Conferir retenção adequada às idades${t.childAges ? ` (${t.childAges})` : ""}, altura e veículo`, t.children, "Verificar requisito legal");
    const baby = t.childAges.split(/[,;]+/).some(a => a.trim() !== "" && Number(a.trim()) <= 2);
    if (baby) add("bebe", "Crianças", "Fraldas e itens de alimentação do bebê");
    add("extras", "Crianças", "Roupas extras e higiene", t.children); add("brinquedos", "Crianças", "Brinquedos e lanches", t.children);
  }
  if (t.pets) { add("pet-comida", "Animais", "Água e alimentação"); add("pet-caixa", "Animais", "Caixa ou sistema de transporte adequado"); add("pet-doc", "Animais", "Conferir documentos e cuidados veterinários aplicáveis", 1, "Verificar requisito legal"); }
  if (/trilha|caminhada/i.test(t.activities)) add("trilha", "Atividades", "Calçado de trilha, água e proteção solar", people);
  if (t.purpose === "negócios") add("trabalho", "Atividades", "Materiais para reuniões e roupa de trabalho");
  return result;
}

export function tripSummary(t: Trip): string {
  const s = calculateTrip(t);
  return [`Planejamento Alilu — ${t.title}`, `${t.origin || "Origem a definir"} → ${t.destination || "Destino a definir"}`, ...(t.stops.length ? [`Paradas: ${t.stops.join(" → ")}`] : []), `${t.departure || "Saída a definir"} a ${t.returnDate || "Fim a definir"} • ${s.days} dia(s), ${s.nights} noite(s) • ${s.people} pessoa(s)`, `${t.transport} • ${t.roundTrip ? "ida e volta" : "somente ida"} • ${s.distance.toFixed(1)} km`, ...(["carro", "moto"].includes(t.transport) ? [`Combustível (${t.fuel}): ${s.liters.toFixed(2)} L × ${money(cents(t.fuelPrice))}/L = ${money(s.fuel)}`, `Pedágios: ida ${t.tollOut === null ? "pendente" : money(cents(t.tollOut))}${t.roundTrip ? `; volta ${t.tollBack === null ? "pendente" : money(cents(t.tollBack))}` : ""}`] : []), ...expenseCategories.map(k => `${k}: ${money(s.categories[k])}`), `Imprevistos (${t.contingency}%): ${money(s.contingency)}`, `Total estimado: ${money(s.total)} • por pessoa: ${money(s.perPerson)}`, `Disponível: ${money(cents(t.budget))} • falta economizar: ${money(s.remaining)}`, `Gastos reais: ${money(s.actual)}`, ...s.warnings.map(w => `Pendente: ${w}`), "Estimativas baseadas nos valores informados; confirme tarifas e condições antes de viajar."].join("\n");
}
