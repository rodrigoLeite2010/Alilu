import { parseYoutubeUrl } from "@/lib/youtube-import/url";

export const DESAPEGO_STATES = "AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SE SP TO".split(" ");

export const DEFAULT_PRODUCT_CATEGORIES = [
  { name: "Celulares e smartphones", subcategories: ["Celulares", "Smartwatches", "Acessórios"] },
  { name: "Computadores e notebooks", subcategories: ["Notebooks", "Desktops", "Tablets"] },
  { name: "Videogames", subcategories: ["Consoles", "Jogos", "Acessórios"] },
  { name: "Eletrônicos", subcategories: ["Áudio", "TV e vídeo", "Câmeras"] },
  { name: "Eletrodomésticos", subcategories: ["Cozinha", "Lavanderia", "Climatização"] },
  { name: "Móveis", subcategories: ["Sala", "Quarto", "Cozinha", "Escritório"] },
  { name: "Decoração", subcategories: ["Quadros", "Iluminação", "Tapetes"] },
  { name: "Roupas", subcategories: ["Feminina", "Masculina", "Infantil"] },
  { name: "Calçados", subcategories: ["Feminino", "Masculino", "Infantil"] },
  { name: "Bolsas e acessórios", subcategories: ["Bolsas", "Relógios", "Acessórios"] },
  { name: "Brinquedos", subcategories: ["Educativos", "Jogos", "Pelúcias"] },
  { name: "Artigos infantis", subcategories: ["Carrinhos", "Móveis infantis", "Enxoval"] },
  { name: "Esportes e lazer", subcategories: ["Fitness", "Camping", "Lazer"] },
  { name: "Bicicletas", subcategories: ["Adulto", "Infantil", "Peças"] },
  { name: "Veículos", subcategories: ["Carros", "Motos", "Caminhonetes e utilitários", "Vans e minivans", "Caminhões", "Peças e acessórios automotivos"] },
  { name: "Ferramentas", subcategories: ["Manuais", "Elétricas", "Jardim"] },
  { name: "Instrumentos musicais", subcategories: ["Cordas", "Teclas", "Sopro", "Áudio"] },
  { name: "Livros", subcategories: ["Literatura", "Didáticos", "Infantis"] },
  { name: "Equipamentos de informática", subcategories: ["Monitores", "Periféricos", "Componentes"] },
  { name: "Jardim", subcategories: ["Móveis externos", "Plantas", "Equipamentos"] },
  { name: "Utilidades domésticas", subcategories: ["Cozinha", "Organização", "Limpeza"] },
  { name: "Peças e acessórios automotivos permitidos", subcategories: ["Acessórios", "Peças"] },
  { name: "Outros produtos", subcategories: [] },
] as const;

export const PRODUCT_CONDITIONS = [
  "Novo sem uso",
  "Seminovo",
  "Usado em ótimo estado",
  "Usado em bom estado",
  "Usado com marcas de uso",
  "Para conserto ou retirada de peças",
] as const;

export const DELIVERY_OPTIONS = ["Retirada combinada", "Entrega combinada", "Retirada ou entrega combinada"] as const;
export const VEHICLE_FUELS = ["Flex", "Gasolina", "Etanol", "Diesel", "Elétrico", "Híbrido", "GNV", "Outro"] as const;
export const VEHICLE_TRANSMISSIONS = ["Manual", "Automático", "Automatizado", "CVT", "Outro"] as const;
export const isVehicleCategory = (category: string) => category === "Veículos";
export const DESAPEGO_STATUS: Record<string, string> = {
  draft: "Rascunho", pending: "Aguardando análise", published: "Publicado",
  paused: "Pausado", sold: "Vendido", rejected: "Rejeitado", removed: "Removido",
};
export const MAX_PRODUCT_PHOTOS = 15;
export const PRODUCT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type ProductCategory = { name: string; subcategories: string[] };
export type DesapegoSettings = { maxListings: number; maxPhotos: number; storageMB: number; categories: ProductCategory[] };
export type ProductData = {
  title: string; category: string; subcategory: string; brand: string; model: string;
  description: string; usageTime: string; condition: string; price: number;
  year: number; mileage: number; fuel: string; transmission: string; videoUrl: string;
  previousPrice: number; negotiable: boolean; acceptsExchange: boolean;
  state: string; city: string; neighborhood: string; sellerName: string;
  contactPreference: "WhatsApp"; delivery: string;
};
export type ProductImage = { id: string; url: string; thumbnail: string };
export type ProductAd = { id: string; slug: string; status: string; data: ProductData; images: ProductImage[]; revision: number; updated_at: string; published_at?: string|null; views?: number; contacts?: number; reason?: string };
export const EMPTY_PRODUCT: ProductData = {
  title: "", category: "", subcategory: "", brand: "", model: "", description: "", usageTime: "",
  condition: "Seminovo", price: 0, previousPrice: 0, year: 0, mileage: 0, fuel: "", transmission: "", videoUrl: "", negotiable: false, acceptsExchange: false,
  state: "SP", city: "", neighborhood: "", sellerName: "", contactPreference: "WhatsApp", delivery: DELIVERY_OPTIONS[0],
};

export class DesapegoError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export function parseProduct(input: unknown, settings: DesapegoSettings) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new DesapegoError("Preencha o anúncio.");
  const v = input as Record<string, unknown>;
  const submitting = v.submit === true;
  const text = (key: string, min: number, max: number) => {
    const value = typeof v[key] === "string" ? v[key].trim() : "";
    if (value.length < (submitting ? min : 0) || value.length > max) throw new DesapegoError(`Confira o campo ${key} (${min} a ${max} caracteres).`);
    return value;
  };
  const number = (key: string, max = 1e12) => {
    const raw = v[key];
    const n = raw === "" || raw == null ? 0 : Number(raw);
    if (!Number.isFinite(n) || n < 0 || n > max || Math.round(n * 100) !== n * 100) throw new DesapegoError(`Confira o valor de ${key}; use até duas casas decimais.`);
    return n;
  };
  const category = text("category", 1, 100);
  const categoryConfig = settings.categories.find((item) => item.name === category);
  if (!categoryConfig) throw new DesapegoError("Selecione uma categoria válida.");
  const subcategory = text("subcategory", 0, 100);
  if (subcategory && !categoryConfig.subcategories.includes(subcategory)) throw new DesapegoError("Selecione uma subcategoria válida.");
  const isVehicle = isVehicleCategory(category);
  const condition = text("condition", 1, 60);
  if (!(PRODUCT_CONDITIONS as readonly string[]).includes(condition)) throw new DesapegoError("Selecione o estado de conservação.");
  const state = text("state", 2, 2).toUpperCase();
  if (!DESAPEGO_STATES.includes(state)) throw new DesapegoError("Selecione um estado válido.");
  const delivery = text("delivery", 1, 60);
  if (!(DELIVERY_OPTIONS as readonly string[]).includes(delivery)) throw new DesapegoError("Selecione uma opção de retirada ou entrega.");
  const yearValue = v.year === "" || v.year == null ? 0 : Number(v.year);
  const mileageValue = v.mileage === "" || v.mileage == null ? 0 : Number(v.mileage);
  const currentYear = new Date().getFullYear();
  if (!Number.isInteger(yearValue) || (yearValue !== 0 && (yearValue < 1900 || yearValue > currentYear + 1))) throw new DesapegoError("Informe um ano de fabricação válido.");
  if (!Number.isInteger(mileageValue) || mileageValue < 0 || mileageValue > 2_000_000) throw new DesapegoError("Informe uma quilometragem válida.");
  const fuel = text("fuel", 0, 30), transmission = text("transmission", 0, 30);
  if (fuel && !(VEHICLE_FUELS as readonly string[]).includes(fuel)) throw new DesapegoError("Selecione um combustível válido.");
  if (transmission && !(VEHICLE_TRANSMISSIONS as readonly string[]).includes(transmission)) throw new DesapegoError("Selecione um câmbio válido.");
  const videoUrl = text("videoUrl", 0, 2048);
  let normalizedVideoUrl = "";
  if (videoUrl) {
    const parsedVideo = parseYoutubeUrl(videoUrl);
    if (!parsedVideo.ok) throw new DesapegoError("Informe o link de um vídeo, Short ou live específica do YouTube.");
    normalizedVideoUrl = parsedVideo.normalizedUrl;
  }
  const data: ProductData = {
    title: text("title", 8, 120), category, subcategory,
    brand: text("brand", 0, 80), model: text("model", 0, 80),
    description: text("description", 30, 5000), usageTime: text("usageTime", 0, 80),
    condition, price: number("price"), previousPrice: number("previousPrice"),
    year: yearValue, mileage: mileageValue, fuel, transmission, videoUrl: normalizedVideoUrl,
    negotiable: v.negotiable === true, acceptsExchange: v.acceptsExchange === true,
    state, city: text("city", 2, 100), neighborhood: text("neighborhood", 0, 100),
    sellerName: text("sellerName", 2, 80), contactPreference: "WhatsApp", delivery,
  };
  if (submitting && isVehicle && (!data.brand || !data.model || !data.year)) throw new DesapegoError("Para anunciar um veículo, informe marca, modelo e ano.");
  if (data.previousPrice && data.previousPrice <= data.price) throw new DesapegoError("O valor anterior deve ser maior que o preço atual.");
  const phone = text("phone", 10, 25).replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
  if ((submitting || phone) && !/^[1-9]\d{9,10}$/.test(phone)) throw new DesapegoError("Informe um WhatsApp brasileiro com DDD.");
  const zip = text("zip", 0, 9).replace(/\D/g, "");
  if (zip && !/^\d{8}$/.test(zip)) throw new DesapegoError("O CEP deve conter 8 números.");
  if (submitting && v.consent !== true) throw new DesapegoError("Aceite os termos para enviar o anúncio.");
  const imageIds = Array.isArray(v.imageIds) ? v.imageIds : [];
  if (imageIds.length > settings.maxPhotos || imageIds.length > MAX_PRODUCT_PHOTOS || imageIds.some((id) => typeof id !== "string" || !PRODUCT_ID.test(id)) || new Set(imageIds).size !== imageIds.length) throw new DesapegoError("Fotos inválidas ou acima do limite.");
  if (submitting && imageIds.length === 0) throw new DesapegoError("Adicione ao menos uma foto para enviar à análise.");
  return { data, phone: phone ? `55${phone}` : "", zip, consent: v.consent === true, imageIds: imageIds as string[], submit: submitting };
}

export function parseProductFilters(params: URLSearchParams) {
  const text = (key: string) => (params.get(key) ?? "").trim().slice(0, 100);
  const rawNumber = (key: string) => Number(params.get(key));
  const min = rawNumber("min"), max = rawNumber("max");
  const page = Number(params.get("page"));
  return {
    q: text("q"), category: text("category"), subcategory: text("subcategory"), state: text("state"),
    city: text("city"), condition: text("condition"), brand: text("brand"),
    min: Number.isFinite(min) && min >= 0 ? Math.min(min, 1e12) : 0,
    max: Number.isFinite(max) && max > 0 ? Math.min(max, 1e12) : 1e12,
    acceptsExchange: params.get("exchange") === "1",
    sort: ["recent", "price", "price-desc"].includes(text("sort")) ? text("sort") : "recent",
    page: Number.isFinite(page) ? Math.min(1000, Math.max(1, Math.floor(page))) : 1,
  };
}

export function productSlug(title: string, city: string, id: string) {
  const base = `${title}-${city}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 110);
  return `${base || "produto"}-${id}`;
}

export function productMoney(value: number) { return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }
