export const PROPERTY_TYPES = [
  "Casa",
  "Apartamento",
  "Terreno",
  "Chácara",
  "Cobertura",
  "Kitnet",
  "Sala comercial",
  "Galpão",
  "Outro",
] as const;
export const FEATURES = [
  "Área de lazer",
  "Piscina",
  "Churrasqueira",
  "Condomínio fechado",
  "Mobiliado",
  "Aceita animais",
];
export const PURPOSES = ["Venda", "Aluguel", "Temporada"] as const;
export const STATES =
  "AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO".split(
    " ",
  );
export const STATUS: Record<string, string> = {
  draft: "Rascunho",
  pending: "Aguardando análise",
  published: "Publicado",
  paused: "Pausado",
  sold: "Vendido",
  rented: "Alugado",
  rejected: "Rejeitado",
  removed: "Removido",
};
export type PropertyData = {
  title: string;
  purpose: string;
  type: string;
  condition: string;
  description: string;
  state: string;
  city: string;
  neighborhood: string;
  area: number;
  builtArea: number;
  bedrooms: number;
  suites: number;
  bathrooms: number;
  parking: number;
  features: string[];
  price: number;
  condo: number;
  iptu: number;
  fees: number;
  financing: boolean;
  exchange: boolean;
  negotiable: boolean;
  advertiser: string;
  advertiserType: string;
  creci: string;
};
export type PropertyImage = { id: string; url: string; thumbnail: string };
export type Property = {
  id: string;
  slug: string;
  status: string;
  data: PropertyData;
  images: PropertyImage[];
  revision: number;
  updated_at: string;
  views: number;
  contacts: number;
  reason?: string;
};
export type Settings = {
  maxListings: number;
  maxPhotos: number;
  types: string[];
  features: string[];
  storageMB: number;
};
export const DEFAULT_SETTINGS: Settings = {
  maxListings: 10,
  maxPhotos: 20,
  types: [...PROPERTY_TYPES],
  features: [...FEATURES],
  storageMB: 500,
};
export const EMPTY_PROPERTY: PropertyData = {
  title: "",
  purpose: "Venda",
  type: "Casa",
  condition: "Usado",
  description: "",
  state: "SP",
  city: "",
  neighborhood: "",
  area: 0,
  builtArea: 0,
  bedrooms: 0,
  suites: 0,
  bathrooms: 0,
  parking: 0,
  features: [],
  price: 0,
  condo: 0,
  iptu: 0,
  fees: 0,
  financing: false,
  exchange: false,
  negotiable: false,
  advertiser: "",
  advertiserType: "Proprietário",
  creci: "",
};
export class PropertyError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export function parseProperty(
  input: unknown,
  settings: Settings = DEFAULT_SETTINGS,
) {
  if (!input || typeof input !== "object")
    throw new PropertyError("Preencha o anúncio.");
  const v = input as Record<string, unknown>;
  const submitting = v.submit === true;
  const labels: Record<string, string> = {
    title: "título",
    purpose: "finalidade",
    type: "tipo de imóvel",
    condition: "condição",
    description: "descrição",
    state: "estado",
    city: "cidade",
    neighborhood: "bairro",
    area: "área total",
    builtArea: "área construída",
    bedrooms: "quartos",
    suites: "suítes",
    bathrooms: "banheiros",
    parking: "vagas",
    price: "preço",
    condo: "condomínio",
    iptu: "IPTU",
    fees: "outras taxas",
    advertiser: "nome do anunciante",
    advertiserType: "tipo de anunciante",
    phone: "WhatsApp",
    address: "endereço",
    zip: "CEP",
  };
  const text = (key: string, min: number, max: number) => {
    const value = typeof v[key] === "string" ? v[key].trim() : "";
    if (value.length < (submitting ? min : 0) || value.length > max)
      throw new PropertyError(
        `Confira o campo ${labels[key] ?? key} (${min} a ${max} caracteres).`,
      );
    return value;
  };
  const choice = (key: string, choices: readonly string[]) => {
    const value = text(key, 1, 100);
    if (!choices.includes(value))
      throw new PropertyError(`Opção inválida: ${labels[key] ?? key}.`);
    return value;
  };
  const number = (key: string, max = 1e12) => {
    const n = Number(v[key] ?? 0);
    if (!Number.isFinite(n) || n < 0 || n > max)
      throw new PropertyError(`Valor inválido: ${labels[key] ?? key}.`);
    return n;
  };
  const data: PropertyData = {
    title: text("title", 10, 120),
    purpose: choice("purpose", PURPOSES),
    type: choice("type", settings.types),
    condition: choice("condition", ["Novo", "Usado", "Em construção"]),
    description: text("description", 40, 10000),
    state: choice("state", STATES),
    city: text("city", 2, 100),
    neighborhood: text("neighborhood", 2, 100),
    area: number("area", 1e8),
    builtArea: number("builtArea", 1e8),
    bedrooms: number("bedrooms", 100),
    suites: number("suites", 100),
    bathrooms: number("bathrooms", 100),
    parking: number("parking", 100),
    price: number("price"),
    condo: number("condo"),
    iptu: number("iptu"),
    fees: number("fees"),
    financing: v.financing === true,
    exchange: v.exchange === true,
    negotiable: v.negotiable === true,
    features: Array.isArray(v.features)
      ? [
          ...new Set(
            v.features.filter(
              (f): f is string =>
                typeof f === "string" && settings.features.includes(f),
            ),
          ),
        ]
      : [],
    advertiser: text("advertiser", 2, 100),
    advertiserType: choice("advertiserType", [
      "Proprietário",
      "Corretor",
      "Imobiliária",
    ]),
    creci: text("creci", 0, 40),
  };
  if (submitting && (!data.price || !data.area))
    throw new PropertyError("Informe preço e área maiores que zero.");
  for (const key of ["price", "condo", "iptu", "fees"] as const) {
    if (data[key] !== Math.round(data[key] * 100) / 100)
      throw new PropertyError(
        `Informe ${labels[key]} com no máximo duas casas decimais.`,
      );
  }
  for (const key of ["bedrooms", "suites", "bathrooms", "parking"] as const)
    if (!Number.isInteger(data[key]))
      throw new PropertyError(
        "Quartos, suítes, banheiros e vagas devem ser inteiros.",
      );
  if (
    submitting &&
    data.advertiserType !== "Proprietário" &&
    !/^[A-Z]{2}\s?\d{1,10}[-\s]?[FJ]$/i.test(data.creci)
  )
    throw new PropertyError(
      "Informe o CRECI no formato SP 123456-F ou SP 123456-J.",
    );
  const phone = text("phone", 10, 25)
    .replace(/\D/g, "")
    .replace(/^55(?=\d{10,11}$)/, "");
  if ((submitting || phone) && !/^[1-9]\d{9,10}$/.test(phone))
    throw new PropertyError("Informe um WhatsApp brasileiro com DDD.");
  if (submitting && v.consent !== true)
    throw new PropertyError(
      "Autorize o uso do contato e aceite os termos dos anúncios.",
    );
  const imageIds = Array.isArray(v.imageIds) ? v.imageIds : [];
  if (
    imageIds.length > settings.maxPhotos ||
    imageIds.some((id) => typeof id !== "string" || !UUID.test(id)) ||
    new Set(imageIds).size !== imageIds.length
  )
    throw new PropertyError("Fotos inválidas ou acima do limite.");
  if (v.submit === true && imageIds.length === 0)
    throw new PropertyError(
      "Adicione ao menos uma foto para enviar à análise.",
    );
  return {
    data,
    phone: phone ? `55${phone}` : "",
    address: text("address", 0, 300),
    zip: text("zip", 0, 9),
    consent: v.consent === true,
    imageIds: imageIds as string[],
    submit: submitting,
  };
}
export const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120);
}
export function money(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
export function parseFilters(params: URLSearchParams) {
  const text = (key: string) => (params.get(key) ?? "").trim().slice(0, 100);
  const num = (key: string) => {
    const n = Number(params.get(key));
    return Number.isFinite(n) && n >= 0 ? Math.min(n, 1e12) : 0;
  };
  return {
    purpose: text("purpose"),
    state: text("state"),
    city: text("city"),
    neighborhood: text("neighborhood"),
    type: text("type"),
    min: num("min"),
    max: num("max") || 1e12,
    bedrooms: num("bedrooms"),
    parking: num("parking"),
    area: num("area"),
    features: params.getAll("feature").slice(0, 30),
    sort: text("sort"),
    page: Math.min(1000, Math.max(1, Math.floor(num("page")) || 1)),
  };
}
export function toParams(
  values: Record<string, string | string[] | undefined>,
) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(values))
    for (const item of Array.isArray(v) ? v : v ? [v] : [])
      params.append(k, item);
  return params;
}
