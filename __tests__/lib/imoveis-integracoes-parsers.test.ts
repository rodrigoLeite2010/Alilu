// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildXlsx,
  csvCell,
  detectFormat,
  parseCsv,
  parseFile,
  parseJson,
  parseXml,
  parseXlsx,
  toCsv,
  ImportParseError,
} from "@/lib/imoveis/integracoes/parsers";
import { suggestMapping, TEMPLATE_COLUMNS, TEMPLATE_MAPPING } from "@/lib/imoveis/integracoes/fields";
import { normalizeRecord, parseNumber, safePublicUrl, type PartnerContext } from "@/lib/imoveis/integracoes/transform";
import { DEFAULT_SETTINGS } from "@/lib/imoveis/model";

const modelos = join(process.cwd(), "public", "imoveis", "modelos");
const file = (name: string) => new Uint8Array(readFileSync(join(modelos, name)));
const enc = (s: string) => new TextEncoder().encode(s);
const ctx: PartnerContext = {
  name: "Imobiliária Exemplo",
  tradeName: "Exemplo Imóveis",
  partnerType: "Imobiliária",
  creci: "SP 12345-J",
  whatsapp: "5512999990000",
  allowListingContacts: false,
  allowedImageHosts: ["parceiro.example"],
};

describe("Importador — leitura de arquivos", () => {
  it("lê o CSV de exemplo com separador detectado, aspas e BOM", () => {
    const r = parseCsv(file("MODELO_IMPORTACAO_IMOVEIS.csv"));
    expect(r.records).toHaveLength(2);
    expect(r.fields).toEqual([...TEMPLATE_COLUMNS]);
    expect(r.records[0].CodigoImovel).toBe("ABC123");
    expect(r.records[0].Fotos).toContain("|");
  });
  it("trata CSV em Windows-1252, vírgula e campos com quebra de linha", () => {
    const latin = Uint8Array.from([...Buffer.from("Codigo,Bairro,Descricao\n1,", "latin1"), 0x55, 0x72, 0x62, 0x61, 0x6e, 0x6f, 0x76, 0x61, 0x20, 0xe7, ...Buffer.from(',"linha 1\nlinha ""2"""\n', "latin1")]);
    const r = parseCsv(latin);
    expect(r.records[0].Bairro).toBe("Urbanova ç");
    expect(r.records[0].Descricao).toBe('linha 1\nlinha "2"');
    expect(parseCsv(enc("a;b\n1;2"), { delimiter: ";" }).records[0]).toEqual({ a: "1", b: "2" });
  });
  it("lê o JSON de exemplo encontrando a coleção e achatando imagens aninhadas", () => {
    const r = parseJson(file("EXEMPLO_IMPORTACAO_IMOVEIS.json"));
    expect(r.collectionPath).toBe("imoveis");
    expect(r.records[0]["imagens[]"]).toHaveLength(2);
    expect(r.records[1]["imagens[].url"]).toEqual(["https://parceiro.example/imagens/APT-204-1.jpg"]);
    expect(parseJson(enc('{"data":{"items":[{"id":1}]}}'), { collectionPath: "data.items" }).records).toEqual([{ id: "1" }]);
  });
  it("recusa JSON malformado ou profundamente aninhado", () => {
    expect(() => parseJson(enc("{oops"))).toThrow(ImportParseError);
    const deep = "[".repeat(60) + "1" + "]".repeat(60);
    expect(() => parseJson(enc(`{"a":${deep}}`))).toThrow(/aninhado/);
  });
  it("lê VRSync com namespace, atributos, CDATA e mídia", () => {
    const bytes = file("EXEMPLO_IMPORTACAO_IMOVEIS.xml");
    expect(detectFormat("feed.xml", bytes)).toBe("vrsync");
    const r = parseXml(bytes);
    expect(r.recordTag).toBe("Listing");
    expect(r.records).toHaveLength(2);
    expect(r.records[0].ListingID).toBe("ABC123");
    expect(r.records[0]["Details.ListPrice.#text"]).toBe("850000");
    expect(r.records[0]["Media.Item[].#text"]).toHaveLength(3);
    expect(r.records[0]["Location.State.@abbreviation"]).toBe("SP");
  });
  it("bloqueia XXE, entidades (billion laughs) e XML malformado", () => {
    const xxe = `<?xml version="1.0"?><!DOCTYPE x [<!ENTITY e SYSTEM "file:///etc/passwd">]><imoveis><imovel><a>&e;</a><b>1</b></imovel></imoveis>`;
    expect(() => parseXml(enc(xxe))).toThrow(/DOCTYPE/);
    const laughs = `<?xml version="1.0"?><!DOCTYPE lolz [<!ENTITY lol "lol"><!ENTITY lol2 "&lol;&lol;">]><r><i><a>&lol2;</a><b/></i></r>`;
    expect(() => parseXml(enc(laughs))).toThrow(ImportParseError);
    expect(() => parseXml(enc("<a><b></a>"))).toThrow(ImportParseError);
    expect(() => parseXml(enc("<a>&undefined;</a>"))).toThrow(ImportParseError);
  });
  it("detecta registros em XML personalizado sem schema fixo", () => {
    const r = parseXml(enc(`<carteira><dados><imovel><cod>1</cod><preco>10</preco></imovel><imovel><cod>2</cod><preco>20</preco></imovel></dados></carteira>`));
    expect(r.records.map((x) => x.cod)).toEqual(["1", "2"]);
  });
  it("lê a planilha-modelo gerada e uma planilha do Excel/openpyxl escolhendo a aba, sem executar fórmulas", async () => {
    const own = await parseXlsx(file("MODELO_IMPORTACAO_IMOVEIS.xlsx"));
    expect(own.sheets).toEqual(["Imoveis", "Instrucoes"]);
    expect(own.records[1].CodigoImovel).toBe("APT-204");
    const bytes = new Uint8Array(readFileSync(join(process.cwd(), "__tests__/fixtures/imoveis-integracoes/openpyxl.xlsx")));
    const r = await parseXlsx(bytes, { sheet: "Carteira" });
    expect(r.records[0]).toMatchObject({ CodigoImovel: "X1", Valor: "850000.5", Quartos: "3" });
    expect(r.records[1].Titulo).toBeUndefined();
    await expect(parseXlsx(enc("PK não é zip"))).rejects.toThrow(ImportParseError);
  });
  it("gera planilha válida e neutraliza fórmulas em relatórios CSV", async () => {
    const x = await buildXlsx([{ name: "A", rows: [["h"], ["=1+1"]] }]);
    expect((await parseXlsx(x)).records[0].h).toBe("=1+1");
    expect(csvCell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(csvCell("@cmd")).toBe("'@cmd");
    expect(toCsv([["a", "b;c"]])).toBe('﻿a;"b;c"\r\n');
  });
  it("limita tamanho e quantidade de registros", async () => {
    await expect(parseFile(new Uint8Array(0), "csv")).rejects.toThrow(/vazio/);
    const big = "c\n" + Array.from({ length: 20002 }, (_, i) => i).join("\n");
    await expect(parseFile(enc(big), "csv")).rejects.toThrow(/20000/);
    const ok = "c;v\n" + Array.from({ length: 20000 }, (_, i) => `${i};x`).join("\n");
    const started = Date.now();
    expect((await parseFile(enc(ok), "csv")).records).toHaveLength(20000);
    expect(Date.now() - started).toBeLessThan(5000);
  });
});

describe("Importador — mapeamento e conversão", () => {
  it("sugere mapeamento automático para modelo, JSON e VRSync", () => {
    expect(suggestMapping([...TEMPLATE_COLUMNS])).toMatchObject({ code: "CodigoImovel", price: "Valor", area: "AreaTotal", builtArea: "AreaUtil", photos: "Fotos" });
    const json = parseJson(file("EXEMPLO_IMPORTACAO_IMOVEIS.json"));
    expect(suggestMapping(json.fields)).toMatchObject({ code: "codigo", price: "preco", photos: "imagens[]", originalUrl: "urlOriginal" });
    const vr = parseXml(file("EXEMPLO_IMPORTACAO_IMOVEIS.xml"));
    expect(suggestMapping(vr.fields)).toMatchObject({
      code: "ListingID",
      purpose: "TransactionType",
      type: "Details.PropertyType",
      price: "Details.ListPrice.#text",
      rentPrice: "Details.RentalPrice.#text",
      photos: "Media.Item[].#text",
      originalUrl: "DetailViewUrl",
      neighborhood: "Location.Neighborhood",
      area: "Details.LotArea.#text",
      builtArea: "Details.LivingArea.#text",
      features: "Details.Features.Feature[]",
    });
  });
  it("converte números brasileiros e internacionais", () => {
    expect(parseNumber("R$ 850.000,00")).toBe(850000);
    expect(parseNumber("850000.50")).toBe(850000.5);
    expect(parseNumber("1.200")).toBe(1200);
    expect(parseNumber("1,5")).toBe(1.5);
    expect(parseNumber("180 m²")).toBe(180);
    expect(parseNumber("abc")).toBeNull();
  });
  it("normaliza o VRSync em anúncio do Alilu, filtrando vídeos e fotos fora dos domínios autorizados", () => {
    const vr = parseXml(file("EXEMPLO_IMPORTACAO_IMOVEIS.xml"));
    const mapping = { mapping: suggestMapping(vr.fields), defaults: {}, transforms: {} };
    const casa = normalizeRecord(vr.records[0], mapping, ctx, DEFAULT_SETTINGS);
    expect(casa.errors).toEqual([]);
    expect(casa.data).toMatchObject({ purpose: "Venda", type: "Casa", state: "SP", price: 850000, area: 250, builtArea: 180, bedrooms: 3, parking: 2, iptu: 2400 });
    expect(casa.data.features).toEqual(expect.arrayContaining(["Churrasqueira", "Área de lazer"]));
    expect(casa.data.description).not.toContain("<br>");
    expect(casa.images).toHaveLength(2);
    expect(casa.privateData.zip).toBe("12244000");
    expect(casa.data).not.toHaveProperty("address");
    expect(casa.privateData.phone).toBe("5512999990000");
    const apto = normalizeRecord(vr.records[1], mapping, ctx, DEFAULT_SETTINGS);
    expect(apto.data).toMatchObject({ purpose: "Aluguel", type: "Apartamento", price: 3200, condo: 780, area: 68 });
    expect(apto.warnings.join(" ")).toContain("área útil");
    expect(apto.data.features).toEqual(expect.arrayContaining(["Piscina", "Aceita animais"]));
    const blocked = normalizeRecord(vr.records[0], mapping, { ...ctx, allowedImageHosts: ["outro.example"] }, DEFAULT_SETTINGS);
    expect(blocked.images).toEqual([]);
    expect(blocked.blockers).toContain("Imóvel sem fotos autorizadas.");
  });
  it("registra erros de campos obrigatórios, conversões e status", () => {
    const n = normalizeRecord({ CodigoImovel: "Z", Finalidade: "troca", Tipo: "nave espacial", Estado: "XX", Valor: "abc" }, { mapping: TEMPLATE_MAPPING, defaults: {}, transforms: {} }, { ...ctx, creci: "" }, { ...DEFAULT_SETTINGS, types: ["Casa"] });
    expect(n.errors.join(" ")).toMatch(/Finalidade não reconhecida/);
    expect(n.errors.join(" ")).toMatch(/Tipo não reconhecido/);
    expect(n.errors.join(" ")).toMatch(/UF inválida/);
    expect(n.errors.join(" ")).toMatch(/Preço inválido/);
    expect(n.errors.join(" ")).toMatch(/Cidade ausente/);
    expect(n.blockers.join(" ")).toMatch(/CRECI/);
    const base = { CodigoImovel: "A", Finalidade: "Venda", Tipo: "Casa", Estado: "São Paulo", Cidade: "SJC", Bairro: "Centro", Valor: "1", AreaTotal: "10" };
    expect(normalizeRecord({ ...base, Status: "Vendido" }, { mapping: TEMPLATE_MAPPING, defaults: {}, transforms: {} }, ctx, DEFAULT_SETTINGS).feedStatus).toBe("sold");
    expect(normalizeRecord({ ...base, Status: "Inativo" }, { mapping: TEMPLATE_MAPPING, defaults: {}, transforms: {} }, ctx, DEFAULT_SETTINGS).feedStatus).toBe("paused");
    const withDefault = normalizeRecord({ ...base, Finalidade: "" }, { mapping: TEMPLATE_MAPPING, defaults: { purpose: "Aluguel" }, transforms: { purposeMap: { Locação: "Aluguel" } } }, ctx, DEFAULT_SETTINGS);
    expect(withDefault.data.purpose).toBe("Aluguel");
    expect(normalizeRecord({ ...base, Valor: "85000000" }, { mapping: TEMPLATE_MAPPING, defaults: {}, transforms: { priceDivisor: 100 } }, ctx, DEFAULT_SETTINGS).data.price).toBe(850000);
  });
  it("só aceita links públicos seguros", () => {
    expect(safePublicUrl("https://parceiro.example/x")).toBe("https://parceiro.example/x");
    for (const bad of ["javascript:alert(1)", "https://user:pw@x.example", "http://127.0.0.1/", "https://localhost/", "https://[::1]/", "ftp://x.example"])
      expect(safePublicUrl(bad)).toBeNull();
    expect(safePublicUrl("http://parceiro.example", true)).toBeNull();
  });
  it("respeita a autorização de descrições, links e contato por anúncio", () => {
    const raw = { CodigoImovel: "A", Finalidade: "Venda", Tipo: "Casa", Estado: "SP", Cidade: "SJC", Bairro: "Centro", Valor: "1", AreaTotal: "10", Descricao: "Descrição original do parceiro com bastante texto para reutilização.", LinkOriginal: "https://parceiro.example/a", WhatsAppComercial: "12988887777" };
    const m = { mapping: TEMPLATE_MAPPING, defaults: {}, transforms: {} };
    const denied = normalizeRecord(raw, m, { ...ctx, descriptionsAllowed: false, linksAllowed: false }, DEFAULT_SETTINGS);
    expect(denied.data.description).not.toContain("original do parceiro");
    expect(denied.originalUrl).toBe("");
    expect(denied.privateData.phone).toBe("5512999990000");
    expect(normalizeRecord(raw, m, { ...ctx, allowListingContacts: true }, DEFAULT_SETTINGS).privateData.phone).toBe("5512988887777");
  });
});
