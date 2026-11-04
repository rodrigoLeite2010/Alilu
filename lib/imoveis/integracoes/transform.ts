// Normalização de um registro bruto do parceiro em um anúncio do Alilu.
// Puro e isomórfico (sem I/O). Nunca descarta silenciosamente: avisos/erros são devolvidos.
import {
  FEATURES,
  PURPOSES,
  STATES,
  EMPTY_PROPERTY,
  type PropertyData,
  type Settings,
} from "@/lib/imoveis/model";
import { parseYoutubeUrl } from "@/lib/youtube-import/url";
import type { MappingConfig, TargetField } from "./fields";
import type { RawRecord } from "./parsers";

export type PartnerContext = {
  name: string;
  tradeName: string;
  partnerType: "Imobiliária" | "Corretor";
  creci: string;
  whatsapp: string;
  allowListingContacts: boolean;
  allowedImageHosts: string[];
  /** Autorização: descrições do parceiro podem ser reutilizadas? */
  descriptionsAllowed?: boolean;
  /** Autorização: link para o anúncio original pode ser exibido? */
  linksAllowed?: boolean;
};
export type FeedStatus = "available" | "paused" | "sold" | "rented";
export type Normalized = {
  code: string;
  data: PropertyData;
  privateData: { phone: string; address: string; zip: string; latitude: string; longitude: string };
  images: string[];
  originalUrl: string;
  feedStatus: FeedStatus;
  errors: string[];
  warnings: string[];
  /** Motivos que impedem publicação imediata (o anúncio fica pendente). */
  blockers: string[];
};

const plain = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

const STATE_NAMES: Record<string, string> = {
  acre: "AC", alagoas: "AL", amapa: "AP", amazonas: "AM", bahia: "BA", ceara: "CE",
  "distrito federal": "DF", "espirito santo": "ES", goias: "GO", maranhao: "MA",
  "mato grosso": "MT", "mato grosso do sul": "MS", "minas gerais": "MG", para: "PA",
  paraiba: "PB", parana: "PR", pernambuco: "PE", piaui: "PI", "rio de janeiro": "RJ",
  "rio grande do norte": "RN", "rio grande do sul": "RS", rondonia: "RO", roraima: "RR",
  "santa catarina": "SC", "sao paulo": "SP", sergipe: "SE", tocantins: "TO",
};

const PURPOSE_ALIASES: [RegExp, string][] = [
  [/temporada|season|vacation|diaria|short.?term/, "Temporada"],
  [/^(sale\s*\/\s*rent|venda\s*\/\s*(locacao|aluguel)|venda e (locacao|aluguel))$/, "Venda"],
  [/alug|locac|loca|rent|lease/, "Aluguel"],
  [/vend|sale|sell|compra|for sale/, "Venda"],
];

const TYPE_ALIASES: [RegExp, string, string?][] = [
  [/cobertura|penthouse/, "Cobertura"],
  [/kit.?net|kitchenette|studio|estudio|loft|flat/, "Kitnet"],
  [/apart|apto/, "Apartamento"],
  [/terreno|lote|land|\blot\b/, "Terreno"],
  [/chacara|sitio|fazenda|rancho|farm|ranch|country/, "Chácara"],
  [/galpao|barracao|warehouse|industrial|deposito/, "Galpão"],
  [/sala|comercial|commercial|office|consult|loja|store|business|ponto/, "Sala comercial"],
  [/condominio|\bcondo\b/, "Casa", "Condomínio fechado"],
  [/casa|sobrado|house|home|residencia|village|townhouse/, "Casa"],
];

const FEATURE_ALIASES: [RegExp, string][] = [
  [/piscina|pool/, "Piscina"],
  [/churrasq|bbq|barbecue|grill/, "Churrasqueira"],
  [/lazer|playground|recreation|gourmet|salao de festas|party|academia|gym|fitness/, "Área de lazer"],
  [/condominio fechado|gated|portaria 24|seguranca 24|security 24/, "Condomínio fechado"],
  [/mobiliad|furnish/, "Mobiliado"],
  [/aceita (animais|pet)|pet.?friendly|pets? allowed|animais/, "Aceita animais"],
];

/** Lê números em formato brasileiro ou internacional: "850.000,00", "850000.5", "R$ 1.200". */
export function parseNumber(input: string): number | null {
  let s = input.replace(/[^\d,.\-]/g, "");
  if (!s || !/\d/.test(s)) return null;
  const lastComma = s.lastIndexOf(","),
    lastDot = s.lastIndexOf(".");
  if (lastComma >= 0 && lastDot >= 0) {
    s = lastComma > lastDot ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  } else if (lastComma >= 0) {
    const decimals = s.length - lastComma - 1;
    s = (s.match(/,/g)!.length > 1 || decimals === 3) ? s.replace(/,/g, "") : s.replace(",", ".");
  } else if (lastDot >= 0) {
    const decimals = s.length - lastDot - 1;
    if (s.match(/\./g)!.length > 1 || decimals === 3) s = s.replace(/\./g, "");
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function stripHtml(text: string) {
  return text
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/\s*(p|div|li)\s*>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Valida links públicos (http/https, sem credenciais, sem IP privado literal). */
export function safePublicUrl(value: string, httpsOnly = false): string | null {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return null;
  }
  if (!(url.protocol === "https:" || (!httpsOnly && url.protocol === "http:"))) return null;
  if (url.username || url.password) return null;
  const host = url.hostname.toLowerCase();
  if (
    !host.includes(".") ||
    host === "localhost" ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    /^(\d+\.){3}\d+$/.test(host) ||
    host.startsWith("[")
  )
    return null;
  return url.toString();
}

export function hostAllowed(url: string, allowed: string[]) {
  if (!allowed.length) return false;
  const host = new URL(url).hostname.toLowerCase();
  return allowed.some((a) => {
    const h = a.trim().toLowerCase().replace(/^\*\./, "");
    return h && (host === h || host.endsWith(`.${h}`));
  });
}

export function normalizePhone(value: string) {
  const digits = value.replace(/\D/g, "").replace(/^0+/, "").replace(/^55(?=\d{10,11}$)/, "");
  return /^[1-9]\d{9,10}$/.test(digits) ? `55${digits}` : "";
}

export function normalizeRecord(
  raw: RawRecord,
  config: MappingConfig,
  ctx: PartnerContext,
  settings: Pick<Settings, "types" | "features">,
): Normalized {
  const errors: string[] = [],
    warnings: string[] = [],
    blockers: string[] = [];
  const values = (field: TargetField): string[] => {
    const source = config.mapping[field];
    const v: string | string[] | undefined = source ? raw[source] : undefined;
    const list = v === undefined ? [] : (Array.isArray(v) ? v : [v]).map((x) => String(x).trim()).filter(Boolean);
    const fallback = config.defaults[field];
    return list.length || !fallback ? list : [fallback.trim()];
  };
  const one = (field: TargetField) => values(field)[0] ?? "";
  const num = (field: TargetField, label: string) => {
    const text = one(field);
    if (!text) return 0;
    const n = parseNumber(text);
    if (n === null || n < 0) {
      errors.push(`${label} inválido: "${text.slice(0, 40)}".`);
      return 0;
    }
    return n;
  };
  const int = (field: TargetField, label: string) => {
    const n = num(field, label);
    if (!Number.isInteger(n)) {
      warnings.push(`${label} arredondado para ${Math.round(n)}.`);
      return Math.min(100, Math.round(n));
    }
    if (n > 100) {
      errors.push(`${label} acima de 100.`);
      return 0;
    }
    return n;
  };
  const money = (field: TargetField, label: string) => {
    let n = num(field, label);
    if (config.transforms.priceDivisor && config.transforms.priceDivisor > 1) n = n / config.transforms.priceDivisor;
    const cents = Math.round(n * 100) / 100;
    if (cents !== n) warnings.push(`${label} arredondado para duas casas decimais.`);
    if (cents > 1e12) {
      errors.push(`${label} fora do limite.`);
      return 0;
    }
    return cents;
  };
  const area = (field: TargetField, label: string) => {
    const text = one(field);
    let n = num(field, label);
    if (config.transforms.areaUnit === "ha" || /\bha\b|hectare/i.test(text)) n = n * 10000;
    if (n > 1e8) {
      errors.push(`${label} fora do limite.`);
      return 0;
    }
    return Math.round(n * 100) / 100;
  };
  const mapCustom = (map: Record<string, string> | undefined, value: string) => {
    if (!map) return undefined;
    const key = plain(value);
    for (const [k, v] of Object.entries(map)) if (plain(k) === key) return v;
    return undefined;
  };

  const code = one("code").slice(0, 120);
  if (!code) errors.push("Código externo ausente.");
  else if (!/^[\w.\-/: #]+$/u.test(code)) errors.push("Código externo com caracteres inválidos.");

  // Finalidade
  const purposeRaw = one("purpose");
  let purpose = mapCustom(config.transforms.purposeMap, purposeRaw) ?? "";
  if (!purpose && purposeRaw) purpose = PURPOSE_ALIASES.find(([re]) => re.test(plain(purposeRaw)))?.[1] ?? "";
  if (/sale\s*\/\s*rent|venda\s*(e|\/)\s*(locacao|aluguel)/.test(plain(purposeRaw)))
    warnings.push("Imóvel para venda e aluguel: importado como Venda.");
  if (!PURPOSES.includes(purpose as (typeof PURPOSES)[number])) {
    errors.push(purposeRaw ? `Finalidade não reconhecida: "${purposeRaw.slice(0, 40)}".` : "Finalidade ausente.");
    purpose = "Venda";
  }

  // Tipo
  const typeRaw = one("type");
  const extraFeatures: string[] = [];
  let type = mapCustom(config.transforms.typeMap, typeRaw) ?? "";
  if (!type && typeRaw) {
    const found = TYPE_ALIASES.find(([re]) => re.test(plain(typeRaw)));
    if (found) {
      type = found[1];
      if (found[2]) extraFeatures.push(found[2]);
    }
  }
  if (!type || !settings.types.includes(type)) {
    if (typeRaw && settings.types.includes("Outro")) {
      warnings.push(`Tipo "${typeRaw.slice(0, 40)}" convertido para Outro.`);
      type = "Outro";
    } else {
      errors.push(typeRaw ? `Tipo não reconhecido: "${typeRaw.slice(0, 40)}".` : "Tipo do imóvel ausente.");
      type = settings.types[0] ?? "Casa";
    }
  }

  // Localização
  const stateRaw = one("state");
  let state = stateRaw.toUpperCase();
  if (!STATES.includes(state)) state = STATE_NAMES[plain(stateRaw)] ?? "";
  if (!state) errors.push(stateRaw ? `UF inválida: "${stateRaw.slice(0, 30)}".` : "Estado ausente.");
  const city = one("city").replace(/\s+/g, " ").slice(0, 100);
  if (city.length < 2) errors.push("Cidade ausente.");
  const neighborhood = one("neighborhood").replace(/\s+/g, " ").slice(0, 100);
  if (neighborhood.length < 2) errors.push("Bairro ausente.");

  // Valores
  let price = money("price", "Preço");
  const rentPrice = money("rentPrice", "Aluguel");
  if (purpose !== "Venda" && rentPrice > 0) price = rentPrice;
  if (!price) errors.push("Imóvel sem preço.");
  const condo = money("condo", "Condomínio"),
    iptu = money("iptu", "IPTU");

  let areaTotal = area("area", "Área total");
  const builtArea = area("builtArea", "Área útil");
  if (!areaTotal && builtArea) {
    areaTotal = builtArea;
    warnings.push("Área total ausente: usada a área útil.");
  }
  if (!areaTotal) errors.push("Imóvel sem área.");

  // Características
  const featureValues = values("features").flatMap((f) => f.split(/[;|\n]|,(?!\d)/)).map((f) => f.trim()).filter(Boolean);
  const features = new Set<string>(extraFeatures.filter((f) => settings.features.includes(f)));
  const ignoredFeatures: string[] = [];
  for (const f of featureValues) {
    const mapped =
      mapCustom(config.transforms.featureMap, f) ??
      (settings.features.find((s) => plain(s) === plain(f)) || FEATURE_ALIASES.find(([re]) => re.test(plain(f)))?.[1]);
    if (mapped && settings.features.includes(mapped)) features.add(mapped);
    else ignoredFeatures.push(f.slice(0, 40));
  }
  if (ignoredFeatures.length)
    warnings.push(`Características sem correspondência ignoradas: ${[...new Set(ignoredFeatures)].slice(0, 8).join(", ")}.`);

  // Fotos (somente URLs https dos domínios autorizados do parceiro)
  const delimiter = config.transforms.photoDelimiter;
  const photoCandidates = values("photos").flatMap((v) =>
    delimiter ? v.split(delimiter) : v.split(/\s*[|;\n]\s*|\s*,\s*(?=https?:)|\s+(?=https?:)/),
  );
  const images: string[] = [];
  let rejectedPhotos = 0;
  for (const candidate of photoCandidates) {
    const url = safePublicUrl(candidate, true);
    if (!url || /youtube\.com|youtu\.be|vimeo\.com/i.test(url) || !hostAllowed(url, ctx.allowedImageHosts)) {
      rejectedPhotos++;
      continue;
    }
    if (!images.includes(url)) images.push(url);
  }
  if (rejectedPhotos)
    warnings.push(`${rejectedPhotos} foto(s) ignorada(s): URL inválida, sem https ou fora dos domínios autorizados do parceiro.`);
  if (images.length > 20) {
    warnings.push(`Somente as 20 primeiras de ${images.length} fotos foram mantidas.`);
    images.length = 20;
  }
  if (!images.length) blockers.push("Imóvel sem fotos autorizadas.");

  // Link original
  const originalRaw = ctx.linksAllowed === false ? "" : one("originalUrl");
  const originalUrl = originalRaw ? (safePublicUrl(originalRaw) ?? "") : "";
  if (originalRaw && !originalUrl) warnings.push("Link original inválido foi descartado.");

  // Contato: apenas o WhatsApp comercial autorizado do parceiro (ou do anúncio, se o parceiro permitir).
  const listingPhone = ctx.allowListingContacts ? normalizePhone(one("whatsapp")) : "";
  if (one("whatsapp") && !ctx.allowListingContacts)
    warnings.push("WhatsApp do anúncio ignorado: o parceiro não autorizou contatos por anúncio.");
  const phone = listingPhone || normalizePhone(ctx.whatsapp);
  if (!originalUrl && !phone) blockers.push("Sem link original nem WhatsApp comercial autorizado.");
  if (!/^[A-Z]{2}\s?\d{1,10}[-\s]?[FJ]$/i.test(ctx.creci)) blockers.push("Parceiro sem CRECI válido cadastrado.");

  // Status do feed
  const statusRaw = plain(one("status"));
  let feedStatus: FeedStatus = "available";
  if (statusRaw) {
    if (/vendid|sold/.test(statusRaw)) feedStatus = "sold";
    else if (/alugad|rented|leased/.test(statusRaw)) feedStatus = "rented";
    else if (/inativ|inactive|suspens|indisponi|unavailable|paus|remov|exclu|delet|false|^0$|^nao$|^no$/.test(statusRaw)) feedStatus = "paused";
  }

  // Texto
  const description0 = ctx.descriptionsAllowed === false ? "" : stripHtml(one("description")).slice(0, 10000);
  let title = stripHtml(one("title")).replace(/\s+/g, " ");
  const purposeText = purpose === "Venda" ? "à venda" : purpose === "Aluguel" ? "para alugar" : "para temporada";
  if (title.length < 10) {
    title = `${type} ${purposeText} em ${neighborhood || city}`.slice(0, 120);
    warnings.push("Título ausente ou curto: gerado automaticamente.");
  }
  if (title.length > 120) title = `${title.slice(0, 117).trimEnd()}...`;
  const bedrooms = int("bedrooms", "Quartos"),
    suites = int("suites", "Suítes"),
    bathrooms = int("bathrooms", "Banheiros"),
    parking = int("parking", "Vagas");
  let description = description0;
  if (description.length < 40) {
    description = [
      `${type} ${purposeText} em ${neighborhood}, ${city}/${state}.`,
      areaTotal ? `${areaTotal} m² de área total.` : "",
      bedrooms ? `${bedrooms} quarto(s).` : "",
      bathrooms ? `${bathrooms} banheiro(s).` : "",
      parking ? `${parking} vaga(s).` : "",
      `Anúncio de ${ctx.tradeName || ctx.name}.`,
      description0,
    ]
      .filter(Boolean)
      .join(" ");
    warnings.push("Descrição ausente ou curta: gerada a partir das características.");
  }

  const conditionRaw = plain(one("condition"));
  const condition = /constru|planta|lancament|launch|under/.test(conditionRaw)
    ? "Em construção"
    : /novo|new/.test(conditionRaw)
      ? "Novo"
      : "Usado";

  let videoUrl = "";
  if (one("videoUrl")) {
    const v = parseYoutubeUrl(one("videoUrl"));
    if (v.ok) videoUrl = v.normalizedUrl;
    else warnings.push("Vídeo ignorado: somente links do YouTube são aceitos.");
  }

  const address = one("address").slice(0, 300);
  const zip = one("zip").replace(/\D/g, "").slice(0, 8);

  const data: PropertyData = {
    ...EMPTY_PROPERTY,
    title,
    purpose,
    type,
    condition,
    description,
    state,
    city,
    neighborhood,
    area: areaTotal,
    builtArea,
    bedrooms,
    suites,
    bathrooms,
    parking,
    features: [...features],
    price,
    condo,
    iptu,
    fees: 0,
    advertiser: (ctx.tradeName || ctx.name).slice(0, 100),
    advertiserType: ctx.partnerType,
    creci: ctx.creci.slice(0, 40),
    watermarkName: "",
    videoUrl,
  };
  return {
    code,
    data,
    privateData: { phone, address, zip, latitude: one("latitude").slice(0, 30), longitude: one("longitude").slice(0, 30) },
    images,
    originalUrl,
    feedStatus,
    errors,
    warnings,
    blockers,
  };
}

export const KNOWN_FEATURES = FEATURES;
