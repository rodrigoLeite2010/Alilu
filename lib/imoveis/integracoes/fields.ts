// Campos de destino do Alilu e nomes conhecidos para mapeamento automático.
// Módulo isomórfico (servidor e navegador): sem imports de node:*.

export const TARGET_FIELDS = [
  { key: "code", label: "Código externo", required: true },
  { key: "title", label: "Título" },
  { key: "description", label: "Descrição" },
  { key: "purpose", label: "Finalidade", required: true },
  { key: "type", label: "Tipo do imóvel", required: true },
  { key: "condition", label: "Condição" },
  { key: "price", label: "Preço / valor de venda", required: true },
  { key: "rentPrice", label: "Valor de aluguel" },
  { key: "condo", label: "Condomínio" },
  { key: "iptu", label: "IPTU" },
  { key: "state", label: "Estado (UF)", required: true },
  { key: "city", label: "Cidade", required: true },
  { key: "neighborhood", label: "Bairro", required: true },
  { key: "address", label: "Endereço (privado)" },
  { key: "zip", label: "CEP (privado)" },
  { key: "latitude", label: "Latitude (privado)" },
  { key: "longitude", label: "Longitude (privado)" },
  { key: "bedrooms", label: "Quartos" },
  { key: "suites", label: "Suítes" },
  { key: "bathrooms", label: "Banheiros" },
  { key: "parking", label: "Vagas" },
  { key: "area", label: "Área total (m²)", required: true },
  { key: "builtArea", label: "Área útil/construída (m²)" },
  { key: "features", label: "Características" },
  { key: "photos", label: "Fotos (URLs)" },
  { key: "originalUrl", label: "Link do anúncio original" },
  { key: "whatsapp", label: "WhatsApp comercial do anúncio" },
  { key: "status", label: "Status / disponibilidade" },
  { key: "videoUrl", label: "Vídeo (YouTube)" },
] as const;

export type TargetField = (typeof TARGET_FIELDS)[number]["key"];

export type MappingConfig = {
  mapping: Partial<Record<TargetField, string>>;
  defaults: Partial<Record<TargetField, string>>;
  transforms: {
    typeMap?: Record<string, string>;
    purposeMap?: Record<string, string>;
    featureMap?: Record<string, string>;
    photoDelimiter?: string;
    areaUnit?: "m2" | "ha";
    priceDivisor?: number;
  };
};

export const EMPTY_MAPPING: MappingConfig = {
  mapping: {},
  defaults: {},
  transforms: {},
};

export function normalizeKey(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

// Nomes normalizados (sem acentos/separadores). Comparados com o último
// segmento do caminho e com os dois últimos segmentos concatenados.
const ALIASES: Record<TargetField, string[]> = {
  code: ["codigoimovel", "codigo", "cod", "code", "listingid", "id", "idimovel", "referencia", "ref", "externalid", "propertyid", "sku"],
  title: ["titulo", "title", "nome", "headline", "chamada"],
  description: ["descricao", "description", "desc", "observacao", "observacoes", "detalhes", "detailsdescription"],
  purpose: ["finalidade", "transactiontype", "transacao", "negocio", "purpose", "operacao", "tipooferta", "modalidade"],
  type: ["tipo", "tipoimovel", "propertytype", "type", "categoria", "subtipo", "detailspropertytype"],
  condition: ["condicao", "condition", "estado imovel", "situacaoobra", "construction status"].map(normalizeKey),
  price: ["valor", "preco", "price", "listprice", "saleprice", "valorvenda", "precovenda", "detailslistprice"],
  rentPrice: ["valoraluguel", "aluguel", "rentalprice", "rentprice", "precoaluguel", "valorlocacao", "detailsrentalprice"],
  condo: ["condominio", "valorcondominio", "condo", "condofee", "propertyadministrationfee", "taxacondominio"],
  iptu: ["iptu", "valoriptu", "yearlytax", "propertytax", "imposto"],
  state: ["estado", "uf", "state", "locationstate", "siglaestado"],
  city: ["cidade", "city", "municipio", "locationcity"],
  neighborhood: ["bairro", "neighborhood", "district", "locationneighborhood"],
  address: ["endereco", "address", "logradouro", "rua", "locationaddress"],
  zip: ["cep", "zip", "zipcode", "postalcode", "locationpostalcode"],
  latitude: ["latitude", "lat"],
  longitude: ["longitude", "lng", "lon", "long"],
  bedrooms: ["quartos", "dormitorios", "dorms", "bedrooms", "detailsbedrooms"],
  suites: ["suites", "suite", "detailssuites"],
  bathrooms: ["banheiros", "bathrooms", "banhos", "wc", "detailsbathrooms"],
  parking: ["vagas", "garagem", "garage", "parking", "parkingspaces", "detailsgarage"],
  area: ["areatotal", "totalarea", "area", "lotarea", "areaterreno", "detailslotarea"],
  builtArea: ["areautil", "areaconstruida", "builtarea", "livingarea", "usablearea", "areaprivativa", "detailslivingarea"],
  features: ["caracteristicas", "features", "feature", "comodidades", "amenities", "featuresfeature"],
  photos: ["fotos", "foto", "imagens", "imagem", "images", "image", "photos", "photo", "pictures", "mediaitem", "item", "urlfotos", "galeria"],
  originalUrl: ["linkoriginal", "urloriginal", "link", "sourceurl", "detailviewurl", "permalink", "urlanuncio"],
  whatsapp: ["whatsappcomercial", "whatsapp", "celular", "contatowhatsapp"],
  status: ["status", "situacao", "disponibilidade", "ativo", "publicationstatus"],
  videoUrl: ["video", "videourl", "youtube", "linkvideo"],
};

/** Divide um caminho achatado ("Details.ListPrice.#text") em segmentos úteis. */
export function pathSegments(path: string) {
  return path
    .split(".")
    .map((s) => s.replace(/\[\]$/, ""))
    .filter((s) => s && s !== "#text");
}

export function suggestMapping(fields: string[]): MappingConfig["mapping"] {
  const result: MappingConfig["mapping"] = {};
  const taken = new Set<string>();
  // Prioriza correspondência exata do caminho inteiro, depois último segmento, depois os dois últimos.
  const candidates = (field: string) => {
    const seg = pathSegments(field).filter((s) => !s.startsWith("@"));
    const last = normalizeKey(seg.at(-1) ?? "");
    const lastTwo = normalizeKey(seg.slice(-2).join(""));
    return [normalizeKey(seg.join("")), lastTwo, last];
  };
  for (const pass of [0, 1, 2]) {
    for (const target of TARGET_FIELDS) {
      if (result[target.key]) continue;
      const aliases = ALIASES[target.key];
      const match = fields.find(
        (f) =>
          !taken.has(f) &&
          !f.includes("@") &&
          aliases.includes(candidates(f)[pass]),
      );
      if (match) {
        result[target.key] = match;
        taken.add(match);
      }
    }
  }
  return result;
}

/** Colunas da planilha-modelo oficial (ordem fixa). */
export const TEMPLATE_COLUMNS = [
  "CodigoImovel",
  "Titulo",
  "Descricao",
  "Tipo",
  "Finalidade",
  "Valor",
  "Condominio",
  "IPTU",
  "Cidade",
  "Estado",
  "Bairro",
  "Quartos",
  "Suites",
  "Banheiros",
  "Vagas",
  "AreaUtil",
  "AreaTotal",
  "Endereco",
  "CEP",
  "Latitude",
  "Longitude",
  "Caracteristicas",
  "Fotos",
  "LinkOriginal",
  "WhatsAppComercial",
  "Status",
] as const;

export const TEMPLATE_EXAMPLE: Record<(typeof TEMPLATE_COLUMNS)[number], string> = {
  CodigoImovel: "ABC123",
  Titulo: "Casa com 3 dormitórios no Urbanova",
  Descricao:
    "Casa térrea com 3 dormitórios, sendo 1 suíte, sala ampla, cozinha planejada e quintal com churrasqueira. Dados fictícios para teste.",
  Tipo: "Casa",
  Finalidade: "Venda",
  Valor: "850000,00",
  Condominio: "0",
  IPTU: "2400,00",
  Cidade: "São José dos Campos",
  Estado: "SP",
  Bairro: "Urbanova",
  Quartos: "3",
  Suites: "1",
  Banheiros: "2",
  Vagas: "2",
  AreaUtil: "180",
  AreaTotal: "250",
  Endereco: "",
  CEP: "",
  Latitude: "",
  Longitude: "",
  Caracteristicas: "Churrasqueira; Área de lazer",
  Fotos:
    "https://parceiro.example/imagens/ABC123-1.jpg | https://parceiro.example/imagens/ABC123-2.jpg",
  LinkOriginal: "https://parceiro.example/imovel/ABC123",
  WhatsAppComercial: "12999990000",
  Status: "Ativo",
};

/** Mapeamento correspondente à planilha-modelo. */
export const TEMPLATE_MAPPING: MappingConfig["mapping"] = {
  code: "CodigoImovel",
  title: "Titulo",
  description: "Descricao",
  type: "Tipo",
  purpose: "Finalidade",
  price: "Valor",
  condo: "Condominio",
  iptu: "IPTU",
  city: "Cidade",
  state: "Estado",
  neighborhood: "Bairro",
  bedrooms: "Quartos",
  suites: "Suites",
  bathrooms: "Banheiros",
  parking: "Vagas",
  builtArea: "AreaUtil",
  area: "AreaTotal",
  address: "Endereco",
  zip: "CEP",
  latitude: "Latitude",
  longitude: "Longitude",
  features: "Caracteristicas",
  photos: "Fotos",
  originalUrl: "LinkOriginal",
  whatsapp: "WhatsAppComercial",
  status: "Status",
};
