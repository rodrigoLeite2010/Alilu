import { loadPdfDocument, PdfMergeError } from "@/lib/pdf/merge-pdfs";
import { extractPdfTextPages } from "@/lib/pdf/pdf-text";
import { MAX_PDF_TO_JPG_PAGES, renderPdfToJpegs } from "@/lib/pdf/pdf-to-jpg";

function getFileBaseName(fileName: string): string {
  return fileName.replace(/\.pdf$/i, "") || "documento";
}

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function spreadsheetColumnName(index: number): string {
  let current = index + 1;
  let result = "";

  while (current > 0) {
    const remainder = (current - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    current = Math.floor((current - 1) / 26);
  }

  return result;
}

function createWorksheetXml(rows: string[][]): string {
  const content = rows
    .filter((row) => row.some((cell) => cell.trim().length > 0))
    .map((row, rowIndex) => {
      const cells = row
        .slice(0, 32)
        .map((cell, columnIndex) => {
          const value = cell.slice(0, 32_767);
          const reference = `${spreadsheetColumnName(columnIndex)}${rowIndex + 1}`;
          return `<c r="${reference}" t="inlineStr"><is><t xml:space="preserve">${xmlEscape(value)}</t></is></c>`;
        })
        .join("");
      return `<row r="${rowIndex + 1}">${cells}</row>`;
    })
    .join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${content}</sheetData></worksheet>`;
}

/** Cria um DOCX com texto editável extraído das páginas do PDF. */
export async function convertPdfToWord(file: File): Promise<Blob> {
  const pages = await extractPdfTextPages(file);
  const { Document, Packer, Paragraph, TextRun } = await import("docx");
  const children = pages.flatMap((page, pageIndex) => [
    new Paragraph({
      text: `Página ${page.number}`,
      heading: "Heading1",
      pageBreakBefore: pageIndex > 0,
    }),
    ...page.rows.map(
      (row) =>
        new Paragraph({
          children: [new TextRun(row.cells.join("\t"))],
        })
    ),
  ]);
  const document = new Document({
    sections: [{ children }],
  });

  return Packer.toBlob(document);
}

/** Cria um XLSX com uma aba por página e colunas inferidas do texto do PDF. */
export async function convertPdfToExcel(file: File): Promise<Blob> {
  const pages = await extractPdfTextPages(file);
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  const sheetOverrides = pages
    .map(
      (_, index) =>
        `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
    )
    .join("");
  const sheetDefinitions = pages
    .map(
      (page, index) =>
        `<sheet name="Página ${page.number}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`
    )
    .join("");
  const sheetRelations = pages
    .map(
      (_, index) =>
        `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`
    )
    .join("");

  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheetOverrides}</Types>`
  );
  zip.file(
    "_rels/.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`
  );
  zip.file(
    "xl/workbook.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheetDefinitions}</sheets></workbook>`
  );
  zip.file(
    "xl/_rels/workbook.xml.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheetRelations}<Relationship Id="rId${pages.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`
  );
  zip.file(
    "xl/styles.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="1"><font><sz val="11"/><name val="Arial"/></font></fonts><fills count="1"><fill><patternFill patternType="none"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="1"><xf xfId="0"/></cellXfs></styleSheet>`
  );

  for (const [index, page] of pages.entries()) {
    zip.file(`xl/worksheets/sheet${index + 1}.xml`, createWorksheetXml(page.rows.map((row) => row.cells)));
  }

  return zip.generateAsync({
    type: "blob",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
}

/**
 * Cria uma apresentação visual: cada página do PDF vira uma imagem em um
 * slide. O formato de slides é real, mas o texto não fica editável.
 */
export async function convertPdfToPowerPoint(file: File): Promise<Blob> {
  const pageCount = (await loadPdfDocument(file)).getPageCount();
  if (pageCount > MAX_PDF_TO_JPG_PAGES) {
    throw new PdfMergeError(
      "generation-failed",
      `Este conversor processa no máximo ${MAX_PDF_TO_JPG_PAGES} páginas por arquivo.`
    );
  }
  const pages = Array.from({ length: pageCount }, (_, index) => index + 1);
  const images = await renderPdfToJpegs(file, pages, 0.9, { scale: 1.5 });
  const { default: PptxGenJS } = await import("pptxgenjs");
  const presentation = new PptxGenJS();
  const slideWidth = 13.333;
  const slideHeight = 7.5;
  presentation.layout = "LAYOUT_WIDE";
  presentation.author = "ALILU Utilitários";
  presentation.subject = "Conversão visual de PDF";
  presentation.title = getFileBaseName(file.name);

  for (const image of images) {
    const data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") {
          resolve(reader.result);
          return;
        }
        reject(new Error("Não foi possível preparar a imagem do slide."));
      };
      reader.onerror = () => reject(reader.error ?? new Error("Falha ao ler a imagem."));
      reader.readAsDataURL(image.blob);
    });
    const ratio = image.pageSize[0] / image.pageSize[1];
    const imageHeight = Math.min(slideHeight, slideWidth / ratio);
    const imageWidth = imageHeight * ratio;
    const slide = presentation.addSlide();
    slide.background = { color: "FFFFFF" };
    slide.addImage({
      data,
      x: (slideWidth - imageWidth) / 2,
      y: (slideHeight - imageHeight) / 2,
      w: imageWidth,
      h: imageHeight,
    });
  }

  const output = await presentation.write({ outputType: "blob", compression: true });
  if (!(output instanceof Blob)) {
    throw new Error("Não foi possível gerar o arquivo PowerPoint.");
  }

  return output;
}
