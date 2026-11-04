// Leitores seguros de CSV, XLSX, JSON e XML (inclui VRSync).
// Isomórfico: roda no navegador (pré-processamento do upload) e no servidor (feeds).
// Não usa node:* — apenas Uint8Array, TextDecoder, jszip e saxes.
import JSZip from "jszip";
import { SaxesParser } from "saxes";

export type RawRecord = Record<string, string | string[]>;
export type ParseResult = {
  records: RawRecord[];
  fields: string[];
  warnings: string[];
  sheets?: string[];
};
export type ParseOptions = {
  delimiter?: string;
  sheet?: string;
  headerRow?: number;
  collectionPath?: string;
  recordTag?: string;
  maxRecords?: number;
};
export const LIMITS = {
  maxBytes: 30 * 1024 * 1024,
  maxRecords: 20000,
  maxFields: 400,
  maxValue: 20000,
  maxDepth: 32,
  maxXlsxUncompressed: 120 * 1024 * 1024,
  maxZipEntries: 2000,
};
export class ImportParseError extends Error {}
export type Format = "csv" | "xlsx" | "json" | "xml" | "vrsync";

export function detectFormat(name: string, bytes: Uint8Array): Format {
  const ext = name.toLowerCase().split(".").pop() ?? "";
  if (bytes[0] === 0x50 && bytes[1] === 0x4b) return "xlsx";
  if (ext === "xlsx") return "xlsx";
  const head = decodeText(bytes.subarray(0, 4096)).trimStart();
  if (head.startsWith("<")) return /VRSync|ListingDataFeed/i.test(head) ? "vrsync" : "xml";
  if (head.startsWith("{") || head.startsWith("[")) return "json";
  return "csv";
}

/** UTF-8 (com/sem BOM); se inválido, Windows-1252 (planilhas antigas do Excel). */
export function decodeText(bytes: Uint8Array) {
  let data = bytes;
  if (data[0] === 0xef && data[1] === 0xbb && data[2] === 0xbf) data = data.subarray(3);
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(data);
  } catch {
    return new TextDecoder("windows-1252").decode(data);
  }
}

function clip(value: string) {
  return value.length > LIMITS.maxValue ? value.slice(0, LIMITS.maxValue) : value;
}

function finish(records: RawRecord[], warnings: string[] = [], max = LIMITS.maxRecords, known: string[] = []): ParseResult {
  if (records.length > max)
    throw new ImportParseError(`O arquivo tem mais de ${max} registros. Divida-o em partes.`);
  const fields = new Set<string>(known);
  for (const r of records) for (const k of Object.keys(r)) fields.add(k);
  if (fields.size > LIMITS.maxFields)
    throw new ImportParseError("O arquivo tem campos demais para importação.");
  return { records, fields: [...fields], warnings };
}

// ---------------------------------------------------------------- CSV
export function detectDelimiter(firstLine: string) {
  const counts: Record<string, number> = { ";": 0, ",": 0, "\t": 0, "|": 0 };
  let quoted = false;
  for (const ch of firstLine) {
    if (ch === '"') quoted = !quoted;
    else if (!quoted && ch in counts) counts[ch]++;
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][1] > 0
    ? Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]
    : ",";
}

export function parseCsvRows(text: string, delimiter: string) {
  const rows: string[][] = [];
  let row: string[] = [],
    cell = "",
    quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += ch;
    } else if (ch === '"' && cell === "") quoted = true;
    else if (ch === delimiter) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      if (rows.length > LIMITS.maxRecords + 1)
        throw new ImportParseError(`O arquivo tem mais de ${LIMITS.maxRecords} registros.`);
    } else cell += ch;
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

function rowsToRecords(rows: string[][], headerRow = 1): ParseResult {
  const nonEmpty = rows.filter((r) => r.some((c) => c.trim() !== ""));
  const header = nonEmpty[headerRow - 1];
  if (!header) throw new ImportParseError("Não foi encontrado o cabeçalho.");
  const names = header.map((h, i) => h.trim() || `Coluna${i + 1}`);
  const seen = new Map<string, number>();
  const keys = names.map((n) => {
    const c = (seen.get(n) ?? 0) + 1;
    seen.set(n, c);
    return c > 1 ? `${n}_${c}` : n;
  });
  const warnings: string[] = [];
  const records = nonEmpty.slice(headerRow).map((r) => {
    const rec: RawRecord = {};
    keys.forEach((k, i) => {
      const v = (r[i] ?? "").trim();
      if (v !== "") rec[k] = clip(v);
    });
    if (r.length > keys.length && r.slice(keys.length).some((v) => v.trim()))
      warnings.push("Há linhas com mais colunas que o cabeçalho; valores extras foram ignorados.");
    return rec;
  });
  return finish(records, [...new Set(warnings)], LIMITS.maxRecords, keys);
}

export function parseCsv(bytes: Uint8Array, options: ParseOptions = {}): ParseResult {
  const text = decodeText(bytes);
  const newline = text.search(/\r?\n/);
  const firstLine = newline < 0 ? text : text.slice(0, newline);
  const delimiter = options.delimiter || detectDelimiter(firstLine);
  return rowsToRecords(parseCsvRows(text, delimiter), options.headerRow);
}

// ---------------------------------------------------------------- JSON
type Json = null | boolean | number | string | Json[] | { [k: string]: Json };

function checkDepth(value: Json, depth = 0): void {
  if (depth > LIMITS.maxDepth) throw new ImportParseError("JSON aninhado demais.");
  if (Array.isArray(value)) for (const v of value) checkDepth(v, depth + 1);
  else if (value && typeof value === "object")
    for (const v of Object.values(value)) checkDepth(v, depth + 1);
}

/** Achata objetos em caminhos "a.b", arrays viram "a[]" com vários valores. */
export function flatten(value: Json, prefix = "", out: Record<string, string[]> = {}) {
  if (value === null || value === undefined) return out;
  if (Array.isArray(value)) {
    for (const v of value) flatten(v, `${prefix}[]`, out);
    return out;
  }
  if (typeof value === "object") {
    for (const [k, v] of Object.entries(value)) {
      if (k === "__proto__" || k === "constructor" || k === "prototype") continue;
      flatten(v, prefix ? `${prefix}.${k}` : k, out);
    }
    return out;
  }
  const text = String(value).trim();
  if (text === "") return out;
  (out[prefix || "valor"] ??= []).push(clip(text));
  return out;
}

function toRecord(flat: Record<string, string[]>): RawRecord {
  const rec: RawRecord = Object.create(null);
  for (const [k, v] of Object.entries(flat)) rec[k] = k.includes("[]") || v.length > 1 ? v.slice(0, 200) : v[0];
  return { ...rec };
}

function getPath(value: Json, path: string): Json {
  let cur: Json = value;
  for (const part of path.split(".").filter(Boolean)) {
    if (!cur || typeof cur !== "object" || Array.isArray(cur)) return null;
    cur = Object.hasOwn(cur, part) ? (cur as Record<string, Json>)[part] : null;
  }
  return cur;
}

/** Encontra a primeira coleção de objetos (array) no documento. */
export function findCollection(value: Json, path = "", depth = 0): { path: string; items: Json[] } | null {
  if (Array.isArray(value)) return value.some((v) => v && typeof v === "object") ? { path, items: value } : null;
  if (!value || typeof value !== "object" || depth > 4) return null;
  let best: { path: string; items: Json[] } | null = null;
  for (const [k, v] of Object.entries(value)) {
    const found = findCollection(v, path ? `${path}.${k}` : k, depth + 1);
    if (found && (!best || found.items.length > best.items.length)) best = found;
  }
  return best;
}

export function parseJsonValue(doc: Json, options: ParseOptions = {}): ParseResult & { collectionPath: string } {
  checkDepth(doc);
  const found = options.collectionPath
    ? { path: options.collectionPath, items: getPath(doc, options.collectionPath) }
    : findCollection(doc);
  if (!found || !Array.isArray(found.items))
    throw new ImportParseError("Não foi encontrada uma lista de imóveis no JSON. Informe o caminho da coleção.");
  const records = found.items
    .filter((i): i is { [k: string]: Json } => !!i && typeof i === "object" && !Array.isArray(i))
    .map((i) => toRecord(flatten(i)));
  return { ...finish(records, [], options.maxRecords), collectionPath: found.path };
}

export function parseJson(bytes: Uint8Array, options: ParseOptions = {}) {
  let doc: Json;
  try {
    doc = JSON.parse(decodeText(bytes));
  } catch {
    throw new ImportParseError("JSON malformado.");
  }
  return parseJsonValue(doc, options);
}

// ---------------------------------------------------------------- XML
type XNode = { name: string; attrs: Record<string, string>; children: XNode[]; text: string };

/** Parser sem DTD: qualquer DOCTYPE é recusado (previne XXE e "billion laughs"). */
export function parseXmlTree(text: string): XNode {
  const parser = new SaxesParser({ xmlns: false });
  const root: XNode = { name: "#root", attrs: {}, children: [], text: "" };
  const stack: XNode[] = [root];
  let error: Error | null = null;
  let nodes = 0;
  parser.on("doctype", () => {
    throw new ImportParseError("XML com DOCTYPE/entidades não é aceito por segurança.");
  });
  parser.on("opentag", (tag) => {
    if (++nodes > 3_000_000) throw new ImportParseError("XML grande demais.");
    if (stack.length > LIMITS.maxDepth) throw new ImportParseError("XML aninhado demais.");
    const attrs: Record<string, string> = {};
    for (const [k, v] of Object.entries(tag.attributes as Record<string, string>)) {
      if (k === "xmlns" || k.startsWith("xmlns:")) continue;
      attrs[k.split(":").pop()!] = clip(String(v));
    }
    const node: XNode = { name: tag.name.split(":").pop()!, attrs, children: [], text: "" };
    stack.at(-1)!.children.push(node);
    stack.push(node);
  });
  const onText = (t: string) => {
    const cur = stack.at(-1)!;
    if (cur.text.length < LIMITS.maxValue) cur.text += t;
  };
  parser.on("text", onText);
  parser.on("cdata", onText);
  parser.on("closetag", () => {
    stack.pop();
  });
  parser.on("error", (e) => {
    error = e;
  });
  try {
    parser.write(text).close();
  } catch (e) {
    if (e instanceof ImportParseError) throw e;
    throw new ImportParseError("XML malformado.");
  }
  if (error) throw new ImportParseError("XML malformado.");
  return root;
}

function nodeToJson(node: XNode): Json {
  const text = node.text.trim();
  const hasAttrs = Object.keys(node.attrs).length > 0;
  if (!node.children.length && !hasAttrs) return text;
  const obj: { [k: string]: Json } = {};
  for (const [k, v] of Object.entries(node.attrs)) obj[`@${k}`] = v;
  const groups = new Map<string, XNode[]>();
  for (const c of node.children) groups.set(c.name, [...(groups.get(c.name) ?? []), c]);
  for (const [name, list] of groups) obj[name] = list.length > 1 ? list.map(nodeToJson) : nodeToJson(list[0]);
  if (text && !node.children.length) obj["#text"] = text;
  return obj;
}

/** Elemento que mais se repete sob um mesmo pai: provável registro de imóvel. */
function findRecordNodes(root: XNode, tag?: string): XNode[] {
  const out: XNode[] = [];
  if (tag) {
    const walk = (n: XNode) => {
      for (const c of n.children) {
        if (c.name === tag) out.push(c);
        else walk(c);
      }
    };
    walk(root);
    return out;
  }
  let best: XNode[] = [];
  const walk = (n: XNode) => {
    const groups = new Map<string, XNode[]>();
    for (const c of n.children) groups.set(c.name, [...(groups.get(c.name) ?? []), c]);
    for (const list of groups.values())
      if (list.length > best.length && list[0].children.length > 1) best = list;
    for (const c of n.children) if (c.children.length) walk(c);
  };
  walk(root);
  return best;
}

export function parseXml(bytes: Uint8Array, options: ParseOptions = {}): ParseResult & { recordTag: string } {
  const tree = parseXmlTree(decodeText(bytes));
  const isVr = /^(ListingDataFeed)$/i.test(tree.children[0]?.name ?? "");
  const tag = options.recordTag || (isVr ? "Listing" : undefined);
  const nodes = findRecordNodes(tree, tag);
  if (!nodes.length) throw new ImportParseError("Não foram encontrados registros de imóveis no XML.");
  const records = nodes.map((n) => toRecord(flatten(nodeToJson(n))));
  return { ...finish(records, [], options.maxRecords), recordTag: nodes[0].name };
}

// ---------------------------------------------------------------- XLSX
function colIndex(ref: string) {
  const letters = ref.replace(/\d+/g, "");
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

async function zipText(zip: JSZip, path: string) {
  const file = zip.file(path);
  return file ? file.async("string") : null;
}

function xmlNodes(text: string) {
  return parseXmlTree(text);
}

function collect(node: XNode, name: string, out: XNode[] = []) {
  for (const c of node.children) {
    if (c.name === name) out.push(c);
    collect(c, name, out);
  }
  return out;
}

function textOf(node: XNode): string {
  return node.children.length ? node.children.map(textOf).join("") : node.text;
}

export async function readXlsxRows(bytes: Uint8Array, sheetName?: string) {
  const zip = await JSZip.loadAsync(bytes);
  const entries = Object.values(zip.files);
  if (entries.length > LIMITS.maxZipEntries) throw new ImportParseError("Planilha inválida.");
  let total = 0;
  for (const e of entries) {
    const size = (e as unknown as { _data?: { uncompressedSize?: number } })._data?.uncompressedSize ?? 0;
    total += size;
  }
  if (total > LIMITS.maxXlsxUncompressed) throw new ImportParseError("Planilha grande demais depois de descompactada.");
  const workbook = await zipText(zip, "xl/workbook.xml");
  const rels = await zipText(zip, "xl/_rels/workbook.xml.rels");
  if (!workbook || !rels) throw new ImportParseError("Arquivo .xlsx inválido.");
  const sheets = collect(xmlNodes(workbook), "sheet").map((s) => ({ name: s.attrs.name, rid: s.attrs.id }));
  const targets = new Map(collect(xmlNodes(rels), "Relationship").map((r) => [r.attrs.Id, r.attrs.Target]));
  const chosen = sheets.find((s) => s.name === sheetName) ?? sheets[0];
  if (!chosen) throw new ImportParseError("A planilha não tem abas.");
  const target = (targets.get(chosen.rid) ?? "").replace(/^\/?xl\//, "").replace(/^\//, "");
  const sheetXml = await zipText(zip, `xl/${target}`);
  if (!sheetXml) throw new ImportParseError("Aba da planilha não encontrada.");
  const sharedXml = await zipText(zip, "xl/sharedStrings.xml");
  const shared = sharedXml ? collect(xmlNodes(sharedXml), "si").map(textOf) : [];
  const rows: string[][] = [];
  for (const row of collect(xmlNodes(sheetXml), "row")) {
    if (rows.length > LIMITS.maxRecords + 1) throw new ImportParseError(`A planilha tem mais de ${LIMITS.maxRecords} linhas.`);
    const values: string[] = [];
    for (const c of row.children.filter((n) => n.name === "c")) {
      const idx = c.attrs.r ? colIndex(c.attrs.r) : values.length;
      if (idx < 0 || idx > LIMITS.maxFields) continue;
      const v = c.children.find((n) => n.name === "v");
      let value = "";
      if (c.attrs.t === "s") value = shared[Number(v?.text)] ?? "";
      else if (c.attrs.t === "inlineStr") value = textOf(c.children.find((n) => n.name === "is") ?? c);
      else if (c.attrs.t === "b") value = v?.text === "1" ? "TRUE" : "FALSE";
      else value = v?.text ?? "";
      // Fórmulas nunca são executadas: usamos só o valor em cache (<v>).
      values[idx] = clip(value);
    }
    rows.push(Array.from(values, (v) => v ?? ""));
  }
  return { rows, sheets: sheets.map((s) => s.name) };
}

export async function parseXlsx(bytes: Uint8Array, options: ParseOptions = {}): Promise<ParseResult> {
  let data;
  try {
    data = await readXlsxRows(bytes, options.sheet);
  } catch (e) {
    if (e instanceof ImportParseError) throw e;
    throw new ImportParseError("Arquivo .xlsx inválido ou corrompido.");
  }
  return { ...rowsToRecords(data.rows, options.headerRow), sheets: data.sheets };
}

// ---------------------------------------------------------------- entrada única
export async function parseFile(
  bytes: Uint8Array,
  format: Format,
  options: ParseOptions = {},
): Promise<ParseResult & { collectionPath?: string; recordTag?: string }> {
  if (bytes.byteLength > LIMITS.maxBytes) throw new ImportParseError("Arquivo acima de 30 MB.");
  if (!bytes.byteLength) throw new ImportParseError("Arquivo vazio.");
  if (format === "csv") return parseCsv(bytes, options);
  if (format === "xlsx") return parseXlsx(bytes, options);
  if (format === "json") return parseJson(bytes, options);
  return parseXml(bytes, options);
}

// ---------------------------------------------------------------- exportação segura
/** Neutraliza injeção de fórmulas ao gerar CSV para abrir no Excel. */
export function csvCell(value: unknown) {
  let text = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[";,\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
export function toCsv(rows: unknown[][], delimiter = ";") {
  return "﻿" + rows.map((r) => r.map(csvCell).join(delimiter)).join("\r\n") + "\r\n";
}

function xmlEscape(s: string) {
  return s.replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[c]!).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "");
}

/** Gera um .xlsx mínimo (strings inline, sem fórmulas). */
export async function buildXlsx(sheets: { name: string; rows: string[][] }[]) {
  const zip = new JSZip();
  const col = (i: number) => {
    let s = "";
    for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
    return s;
  };
  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}</Types>`,
  );
  zip.file(
    "_rels/.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
  );
  zip.file(
    "xl/workbook.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((s, i) => `<sheet name="${xmlEscape(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets></workbook>`,
  );
  zip.file(
    "xl/_rels/workbook.xml.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("")}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
  );
  zip.file(
    "xl/styles.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="1"><fill><patternFill patternType="none"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="2"><xf fontId="0"/><xf fontId="1" applyFont="1"/></cellXfs></styleSheet>`,
  );
  sheets.forEach((s, si) => {
    const rows = s.rows
      .map(
        (r, ri) =>
          `<row r="${ri + 1}">${r.map((v, ci) => `<c r="${col(ci)}${ri + 1}" t="inlineStr"${ri === 0 ? ' s="1"' : ""}><is><t xml:space="preserve">${xmlEscape(v)}</t></is></c>`).join("")}</row>`,
      )
      .join("");
    zip.file(
      `xl/worksheets/sheet${si + 1}.xml`,
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows}</sheetData></worksheet>`,
    );
  });
  return zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
}
