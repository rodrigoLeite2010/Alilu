import { createPdfFromHtml, type HtmlPdfOptions } from "@/lib/pdf/html-to-pdf";
import { PdfMergeError } from "@/lib/pdf/merge-pdfs";

export const MAX_OFFICE_FILE_SIZE_BYTES = 20 * 1024 * 1024;
const MAX_OFFICE_ARCHIVE_ENTRIES = 1_000;
const MAX_OFFICE_EXPANDED_BYTES = 60 * 1024 * 1024;
const MAX_OFFICE_XML_CHARACTERS = 2_000_000;
const MAX_SPREADSHEET_ROWS = 1_000;
const MAX_SPREADSHEET_COLUMNS = 40;
const MAX_PRESENTATION_SLIDES = 50;

export type SpreadsheetSheet = {
  name: string;
  rows: string[][];
};

type PresentationImage = {
  bytes: Uint8Array;
  type: "jpg" | "png";
};

type PresentationSlide = {
  number: number;
  text: string;
  images: PresentationImage[];
};

function getExtension(fileName: string): string {
  const match = /\.([a-z0-9]+)$/i.exec(fileName);
  return match?.[1]?.toLowerCase() ?? "";
}

function isZipHeader(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 4 &&
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    ((bytes[2] === 0x03 && bytes[3] === 0x04) ||
      (bytes[2] === 0x05 && bytes[3] === 0x06) ||
      (bytes[2] === 0x07 && bytes[3] === 0x08))
  );
}

function assertSafeOfficeArchive(bytes: Uint8Array): void {
  const minimumEndRecordLength = 22;
  const endRecordSearchStart = Math.max(0, bytes.length - 0xffff - minimumEndRecordLength);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let endRecordOffset = -1;

  for (let offset = bytes.length - minimumEndRecordLength; offset >= endRecordSearchStart; offset -= 1) {
    if (view.getUint32(offset, true) === 0x06054b50) {
      endRecordOffset = offset;
      break;
    }
  }

  if (endRecordOffset < 0) {
    throw new PdfMergeError("generation-failed", "O arquivo não possui uma estrutura ZIP válida.");
  }

  const diskNumber = view.getUint16(endRecordOffset + 4, true);
  const centralDirectoryDisk = view.getUint16(endRecordOffset + 6, true);
  const entriesOnDisk = view.getUint16(endRecordOffset + 8, true);
  const entryCount = view.getUint16(endRecordOffset + 10, true);
  const centralDirectorySize = view.getUint32(endRecordOffset + 12, true);
  const centralDirectoryOffset = view.getUint32(endRecordOffset + 16, true);

  if (
    diskNumber !== 0 ||
    centralDirectoryDisk !== 0 ||
    entriesOnDisk !== entryCount ||
    entryCount === 0xffff ||
    centralDirectorySize === 0xffffffff ||
    centralDirectoryOffset === 0xffffffff
  ) {
    throw new PdfMergeError(
      "generation-failed",
      "Este arquivo usa uma estrutura ZIP não suportada para processamento local."
    );
  }

  if (
    entryCount > MAX_OFFICE_ARCHIVE_ENTRIES ||
    centralDirectoryOffset + centralDirectorySize > endRecordOffset
  ) {
    throw new PdfMergeError(
      "generation-failed",
      "O arquivo possui muitos itens internos para ser processado com segurança no navegador."
    );
  }

  let cursor = centralDirectoryOffset;
  const centralDirectoryEnd = centralDirectoryOffset + centralDirectorySize;
  let uncompressedBytes = 0;

  for (let index = 0; index < entryCount; index += 1) {
    const minimumFileHeaderLength = 46;
    if (cursor + minimumFileHeaderLength > centralDirectoryEnd || view.getUint32(cursor, true) !== 0x02014b50) {
      throw new PdfMergeError("generation-failed", "A estrutura interna deste arquivo do Office é inválida.");
    }

    const compressedSize = view.getUint32(cursor + 20, true);
    const uncompressedSize = view.getUint32(cursor + 24, true);
    const nameLength = view.getUint16(cursor + 28, true);
    const extraLength = view.getUint16(cursor + 30, true);
    const commentLength = view.getUint16(cursor + 32, true);
    const headerLength = minimumFileHeaderLength + nameLength + extraLength + commentLength;

    if (
      compressedSize === 0xffffffff ||
      uncompressedSize === 0xffffffff ||
      cursor + headerLength > centralDirectoryEnd
    ) {
      throw new PdfMergeError(
        "generation-failed",
        "Este arquivo usa uma estrutura ZIP não suportada para processamento local."
      );
    }

    uncompressedBytes += uncompressedSize;
    if (uncompressedBytes > MAX_OFFICE_EXPANDED_BYTES) {
      throw new PdfMergeError(
        "generation-failed",
        "O conteúdo descompactado deste arquivo ultrapassa o limite seguro para processamento local."
      );
    }

    cursor += headerLength;
  }
}

export async function validateOfficeFile(file: File, extensions: string[]): Promise<void> {
  if (file.size === 0) {
    throw new PdfMergeError("generation-failed", "O arquivo selecionado está vazio.");
  }

  if (file.size > MAX_OFFICE_FILE_SIZE_BYTES) {
    throw new PdfMergeError(
      "too-large",
      "O arquivo excede o limite técnico de 20 MB para processamento local."
    );
  }

  if (!extensions.includes(getExtension(file.name))) {
    throw new PdfMergeError(
      "generation-failed",
      `Selecione um arquivo ${extensions.map((extension) => `.${extension}`).join(" ou ")}.`
    );
  }

  try {
    const header = new Uint8Array(await file.slice(0, 4).arrayBuffer());
    if (!isZipHeader(header)) {
      throw new PdfMergeError("generation-failed", "O arquivo não possui a estrutura esperada do Office.");
    }
  } catch (error) {
    if (error instanceof PdfMergeError) {
      throw error;
    }

    throw new PdfMergeError("read-failed", "Não foi possível ler o arquivo selecionado.");
  }
}

async function openOfficeArchive(file: File) {
  const { default: JSZip } = await import("jszip");

  try {
    const source = await file.arrayBuffer();
    assertSafeOfficeArchive(new Uint8Array(source));
    const archive = await JSZip.loadAsync(source, {
      checkCRC32: false,
      createFolders: false,
    });

    if (Object.keys(archive.files).length > MAX_OFFICE_ARCHIVE_ENTRIES) {
      throw new PdfMergeError(
        "generation-failed",
        "O arquivo possui muitos itens internos para ser processado com segurança no navegador."
      );
    }

    return archive;
  } catch (error) {
    if (error instanceof PdfMergeError) {
      throw error;
    }

    throw new PdfMergeError("generation-failed", "Não foi possível abrir este arquivo do Office.");
  }
}

async function readArchiveText(
  archive: Awaited<ReturnType<typeof openOfficeArchive>>,
  path: string,
  required?: true
): Promise<string>;
async function readArchiveText(
  archive: Awaited<ReturnType<typeof openOfficeArchive>>,
  path: string,
  required: false
): Promise<string | null>;
async function readArchiveText(
  archive: Awaited<ReturnType<typeof openOfficeArchive>>,
  path: string,
  required = true
): Promise<string | null> {
  const entry = archive.file(path);
  if (!entry) {
    if (required) {
      throw new PdfMergeError("generation-failed", "A estrutura interna deste arquivo do Office é inválida.");
    }

    return null;
  }

  const value = await entry.async("string");
  if (value.length > MAX_OFFICE_XML_CHARACTERS) {
    throw new PdfMergeError(
      "generation-failed",
      "Uma parte interna do arquivo é grande demais para ser processada com segurança no navegador."
    );
  }

  return value;
}

function decodeXml(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#([0-9]+);/g, (_, decimal: string) => String.fromCodePoint(Number.parseInt(decimal, 10)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function extractXmlText(xml: string): string {
  const parts = Array.from(xml.matchAll(/<(?:[a-z]+:)?t\b[^>]*>([\s\S]*?)<\/(?:[a-z]+:)?t>/gi)).map(
    (match) => decodeXml(match[1].replace(/<[^>]+>/g, ""))
  );
  return parts.join("").replace(/\s+/g, " ").trim();
}

function readAttributes(tag: string): Record<string, string> {
  return Object.fromEntries(
    Array.from(tag.matchAll(/([:\w-]+)\s*=\s*(["'])(.*?)\2/g)).map((match) => [match[1], match[3]])
  );
}

function resolveOfficePath(basePath: string, target: string): string {
  const output: string[] = [];
  for (const segment of `${basePath}/${target}`.split("/")) {
    if (!segment || segment === ".") continue;
    if (segment === "..") {
      output.pop();
      continue;
    }
    output.push(segment);
  }
  return output.join("/");
}

function textForPdf(value: string): string {
  // As fontes padrão do PDF suportam o conjunto Latin-1, que cobre o português.
  // Caracteres fora dele são substituídos para impedir falha na geração do arquivo.
  return value.replace(/[^\u0020-\u00ff\n\r\t]/g, "?");
}

function wrapText(text: string, font: { widthOfTextAtSize: (value: string, size: number) => number }, fontSize: number, maxWidth: number): string[] {
  const words = textForPdf(text).replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  if (words.length === 0) return [];

  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, fontSize) <= maxWidth) {
      current = candidate;
      continue;
    }

    if (current) {
      lines.push(current);
      current = "";
    }

    if (font.widthOfTextAtSize(word, fontSize) <= maxWidth) {
      current = word;
      continue;
    }

    let fragment = "";
    for (const character of word) {
      const fragmentCandidate = `${fragment}${character}`;
      if (font.widthOfTextAtSize(fragmentCandidate, fontSize) > maxWidth && fragment) {
        lines.push(fragment);
        fragment = character;
      } else {
        fragment = fragmentCandidate;
      }
    }
    current = fragment;
  }

  if (current) lines.push(current);
  return lines;
}

async function createPdfFromPresentation(slides: PresentationSlide[]): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const document = await PDFDocument.create({ updateMetadata: false });
  const normalFont = await document.embedFont(StandardFonts.Helvetica);
  const boldFont = await document.embedFont(StandardFonts.HelveticaBold);
  const pageWidth = 960;
  const pageHeight = 540;
  const margin = 38;

  for (const slide of slides) {
    const textLines = wrapText(slide.text || "Slide sem texto selecionável.", normalFont, 13, slide.images.length ? 580 : 884);
    let offset = 0;
    let pageIndex = 0;

    do {
      const page = document.addPage([pageWidth, pageHeight]);
      page.drawRectangle({ x: 0, y: 0, width: pageWidth, height: pageHeight, color: rgb(1, 1, 1) });
      page.drawText(
        pageIndex === 0 ? `Slide ${slide.number}` : `Slide ${slide.number} (continuação)`,
        { x: margin, y: pageHeight - margin, size: 18, font: boldFont, color: rgb(0.1, 0.1, 0.1) }
      );

      let y = pageHeight - margin - 32;
      const textEndY = margin;

      if (pageIndex === 0 && slide.images.length > 0) {
        const imageWidth = 260;
        const imageHeight = 145;
        for (const [imageIndex, image] of slide.images.slice(0, 3).entries()) {
          try {
            const embedded = image.type === "png"
              ? await document.embedPng(image.bytes)
              : await document.embedJpg(image.bytes);
            const scale = Math.min(imageWidth / embedded.width, imageHeight / embedded.height);
            const width = embedded.width * scale;
            const height = embedded.height * scale;
            const x = pageWidth - margin - imageWidth + (imageWidth - width) / 2;
            const imageY = pageHeight - margin - 56 - imageIndex * (imageHeight + 12) - height;
            page.drawRectangle({
              x: pageWidth - margin - imageWidth,
              y: imageY - (imageHeight - height) / 2,
              width: imageWidth,
              height: imageHeight,
              borderColor: rgb(0.82, 0.82, 0.82),
              borderWidth: 0.75,
            });
            page.drawImage(embedded, { x, y: imageY, width, height });
          } catch {
            // Formatos de mídia não aceitos pelo PDF são ignorados sem impedir o texto do slide.
          }
        }
      }

      while (offset < textLines.length && y >= textEndY + 16) {
        page.drawText(textLines[offset], { x: margin, y, size: 13, font: normalFont, color: rgb(0.17, 0.17, 0.17) });
        offset += 1;
        y -= 18;
      }

      pageIndex += 1;
    } while (offset < textLines.length);
  }

  return document.save({ addDefaultPage: false, useObjectStreams: true });
}

export async function convertPowerPointToPdf(file: File): Promise<Uint8Array> {
  await validateOfficeFile(file, ["pptx"]);
  const archive = await openOfficeArchive(file);
  const slidePaths = Object.keys(archive.files)
    .filter((path) => /^ppt\/slides\/slide\d+\.xml$/i.test(path))
    .sort((left, right) => {
      const leftNumber = Number(/slide(\d+)\.xml$/i.exec(left)?.[1] ?? 0);
      const rightNumber = Number(/slide(\d+)\.xml$/i.exec(right)?.[1] ?? 0);
      return leftNumber - rightNumber;
    });

  if (slidePaths.length === 0) {
    throw new PdfMergeError("generation-failed", "Não foram encontrados slides neste arquivo PPTX.");
  }

  if (slidePaths.length > MAX_PRESENTATION_SLIDES) {
    throw new PdfMergeError(
      "generation-failed",
      `Este conversor processa no máximo ${MAX_PRESENTATION_SLIDES} slides por arquivo.`
    );
  }

  const slides: PresentationSlide[] = [];
  for (const [index, slidePath] of slidePaths.entries()) {
    const xml = await readArchiveText(archive, slidePath);
    const relationshipPath = slidePath.replace("ppt/slides/", "ppt/slides/_rels/").replace(/\.xml$/i, ".xml.rels");
    const relationships = await readArchiveText(archive, relationshipPath, false);
    const images: PresentationImage[] = [];

    if (relationships) {
      const relationshipTags = Array.from(relationships.matchAll(/<Relationship\b[^>]*>/gi));
      for (const match of relationshipTags) {
        const attributes = readAttributes(match[0]);
        if (!attributes.Type?.endsWith("/image") || !attributes.Target || images.length >= 3) continue;

        const imagePath = resolveOfficePath("ppt/slides", attributes.Target);
        const extension = getExtension(imagePath);
        if (extension !== "png" && extension !== "jpg" && extension !== "jpeg") continue;

        const imageFile = archive.file(imagePath);
        if (!imageFile) continue;
        images.push({
          bytes: await imageFile.async("uint8array"),
          type: extension === "png" ? "png" : "jpg",
        });
      }
    }

    slides.push({ number: index + 1, text: extractXmlText(xml), images });
  }

  return createPdfFromPresentation(slides);
}

function parseSharedStrings(xml: string): string[] {
  return Array.from(xml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/gi)).map((match) => extractXmlText(match[1]));
}

function columnIndexFromReference(reference: string): number {
  const letters = /^([A-Z]+)/i.exec(reference)?.[1]?.toUpperCase() ?? "A";
  return Array.from(letters).reduce((total, letter) => total * 26 + letter.charCodeAt(0) - 64, 0) - 1;
}

function extractFirstTagValue(xml: string, tagName: string): string {
  const match = new RegExp(`<${tagName}\\b[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "i").exec(xml);
  return match ? decodeXml(match[1].replace(/<[^>]+>/g, "")) : "";
}

function parseWorksheet(xml: string, sharedStrings: string[]): string[][] {
  const rows: string[][] = [];
  const rowMatches = Array.from(xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/gi)).slice(0, MAX_SPREADSHEET_ROWS);

  for (const rowMatch of rowMatches) {
    const values: string[] = [];
    const cellMatches = Array.from(rowMatch[1].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/gi));
    for (const cellMatch of cellMatches) {
      const attributes = readAttributes(cellMatch[1]);
      const columnIndex = Math.min(MAX_SPREADSHEET_COLUMNS - 1, columnIndexFromReference(attributes.r ?? "A1"));
      const rawValue = extractFirstTagValue(cellMatch[2], "v");
      const inlineValue = extractXmlText(cellMatch[2]);
      const value = attributes.t === "s"
        ? sharedStrings[Number(rawValue)] ?? ""
        : attributes.t === "b"
          ? rawValue === "1" ? "Sim" : "Não"
          : attributes.t === "inlineStr"
            ? inlineValue
            : rawValue || inlineValue;
      values[columnIndex] = value;
    }

    if (values.some((value) => value?.trim())) {
      rows.push(Array.from({ length: Math.min(MAX_SPREADSHEET_COLUMNS, values.length) }, (_, index) => values[index] ?? ""));
    }
  }

  return rows;
}

export async function readXlsxSheets(file: File): Promise<SpreadsheetSheet[]> {
  await validateOfficeFile(file, ["xlsx"]);
  const archive = await openOfficeArchive(file);
  const workbookXml = await readArchiveText(archive, "xl/workbook.xml");
  const relationshipsXml = await readArchiveText(archive, "xl/_rels/workbook.xml.rels");
  const sharedStringsXml = await readArchiveText(archive, "xl/sharedStrings.xml", false);
  const sharedStrings = sharedStringsXml ? parseSharedStrings(sharedStringsXml) : [];
  const relationships = new Map<string, string>();

  for (const match of relationshipsXml.matchAll(/<Relationship\b[^>]*>/gi)) {
    const attributes = readAttributes(match[0]);
    if (attributes.Id && attributes.Target) relationships.set(attributes.Id, attributes.Target);
  }

  const sheetTags = Array.from(workbookXml.matchAll(/<sheet\b[^>]*\/?>(?:<\/sheet>)?/gi));
  const sheets: SpreadsheetSheet[] = [];
  for (const sheetTag of sheetTags) {
    const attributes = readAttributes(sheetTag[0]);
    const target = attributes["r:id"] ? relationships.get(attributes["r:id"]) : undefined;
    if (!target || !attributes.name) continue;

    const xml = await readArchiveText(archive, resolveOfficePath("xl", target));
    sheets.push({ name: attributes.name.slice(0, 31), rows: parseWorksheet(xml, sharedStrings) });
  }

  if (sheets.length === 0) {
    throw new PdfMergeError("generation-failed", "Não foram encontradas planilhas válidas neste arquivo XLSX.");
  }

  return sheets;
}

export async function createPdfFromSpreadsheet(sheets: SpreadsheetSheet[]): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const document = await PDFDocument.create({ updateMetadata: false });
  const normalFont = await document.embedFont(StandardFonts.Helvetica);
  const boldFont = await document.embedFont(StandardFonts.HelveticaBold);
  const pageWidth = 841.89;
  const pageHeight = 595.28;
  const margin = 30;
  const maxColumnsPerPage = 10;

  for (const sheet of sheets) {
    const columnCount = Math.max(1, ...sheet.rows.map((row) => row.length));
    const rowSource = sheet.rows.length > 0 ? sheet.rows : [["Planilha sem células com conteúdo."]];

    for (let columnStart = 0; columnStart < columnCount; columnStart += maxColumnsPerPage) {
      const columns = Math.min(maxColumnsPerPage, columnCount - columnStart);
      const cellWidth = (pageWidth - margin * 2) / columns;
      let page = document.addPage([pageWidth, pageHeight]);
      let y = pageHeight - margin;

      const drawHeader = () => {
        page.drawText(
          textForPdf(`${sheet.name}${columnCount > maxColumnsPerPage ? ` - colunas ${columnStart + 1}-${columnStart + columns}` : ""}`),
          { x: margin, y, size: 13, font: boldFont, color: rgb(0.1, 0.1, 0.1) }
        );
        y -= 22;
      };
      drawHeader();

      for (const row of rowSource) {
        const cells = Array.from({ length: columns }, (_, index) => row[columnStart + index] ?? "");
        const cellLines = cells.map((cell) => wrapText(cell, normalFont, 7.5, cellWidth - 8).slice(0, 8));
        const rowHeight = Math.max(18, ...cellLines.map((lines) => lines.length * 9 + 8));

        if (y - rowHeight < margin) {
          page = document.addPage([pageWidth, pageHeight]);
          y = pageHeight - margin;
          drawHeader();
        }

        for (let column = 0; column < columns; column += 1) {
          const x = margin + column * cellWidth;
          page.drawRectangle({
            x,
            y: y - rowHeight,
            width: cellWidth,
            height: rowHeight,
            borderColor: rgb(0.76, 0.76, 0.76),
            borderWidth: 0.5,
          });
          let cellY = y - 11;
          for (const line of cellLines[column]) {
            page.drawText(line, { x: x + 4, y: cellY, size: 7.5, font: normalFont, color: rgb(0.16, 0.16, 0.16) });
            cellY -= 9;
          }
        }

        y -= rowHeight;
      }
    }
  }

  return document.save({ addDefaultPage: false, useObjectStreams: true });
}

export async function convertExcelToPdf(file: File): Promise<Uint8Array> {
  return createPdfFromSpreadsheet(await readXlsxSheets(file));
}

export async function convertWordToPdf(file: File, options: HtmlPdfOptions): Promise<Uint8Array> {
  await validateOfficeFile(file, ["docx"]);
  const source = await file.arrayBuffer();
  assertSafeOfficeArchive(new Uint8Array(source));
  const mammoth = await import("mammoth");
  const result = await mammoth.convertToHtml({ arrayBuffer: source });

  if (!result.value.trim()) {
    throw new PdfMergeError("generation-failed", "Não foi possível encontrar conteúdo para converter neste DOCX.");
  }

  return createPdfFromHtml(result.value, options);
}
