import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { PDFDocument } from "pdf-lib";
import {
  convertPowerPointToPdf,
  createPdfFromSpreadsheet,
  readXlsxSheets,
} from "@/lib/pdf/office-to-pdf";

async function createOfficeFile(name: string, entries: Record<string, string>): Promise<File> {
  const zip = new JSZip();
  for (const [path, content] of Object.entries(entries)) zip.file(path, content);
  const blob = await zip.generateAsync({ type: "blob" });
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return new File([copy.buffer], name);
}

describe("conversores Office para PDF", () => {
  it("bloqueia arquivos Office cujo conteúdo ZIP descompactado excede o limite local", async () => {
    const bytes = new Uint8Array(98);
    const view = new DataView(bytes.buffer);
    view.setUint32(0, 0x04034b50, true);
    view.setUint32(30, 0x02014b50, true);
    view.setUint32(50, 1, true);
    view.setUint32(54, 61 * 1024 * 1024, true);
    view.setUint32(76, 0x06054b50, true);
    view.setUint16(84, 1, true);
    view.setUint16(86, 1, true);
    view.setUint32(88, 46, true);
    view.setUint32(92, 30, true);
    const file = new File([bytes.buffer], "limite.xlsx");

    await expect(readXlsxSheets(file)).rejects.toThrow("conteúdo descompactado");
  });

  it("lê células compartilhadas de um XLSX e gera uma tabela em PDF", async () => {
    const file = await createOfficeFile("planilha.xlsx", {
      "xl/workbook.xml": `<?xml version="1.0"?><workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Dados" sheetId="1" r:id="rId1"/></sheets></workbook>`,
      "xl/_rels/workbook.xml.rels": `<?xml version="1.0"?><Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>`,
      "xl/sharedStrings.xml": `<?xml version="1.0"?><sst><si><t>Produto</t></si><si><t>Café</t></si></sst>`,
      "xl/worksheets/sheet1.xml": `<?xml version="1.0"?><worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1"><v>10</v></c></row><row r="2"><c r="A2" t="s"><v>1</v></c></row></sheetData></worksheet>`,
    });

    const sheets = await readXlsxSheets(file);
    expect(sheets).toEqual([{ name: "Dados", rows: [["Produto", "10"], ["Café"]] }]);
    expect((await PDFDocument.load(await createPdfFromSpreadsheet(sheets))).getPageCount()).toBeGreaterThan(0);
  });

  it("extrai texto de slides PPTX para páginas de PDF", async () => {
    const file = await createOfficeFile("apresentacao.pptx", {
      "ppt/slides/slide1.xml": `<p:sld xmlns:p="p" xmlns:a="a"><a:t>Resumo do projeto</a:t></p:sld>`,
      "ppt/slides/slide2.xml": `<p:sld xmlns:p="p" xmlns:a="a"><a:t>Próximos passos</a:t></p:sld>`,
    });

    expect((await PDFDocument.load(await convertPowerPointToPdf(file))).getPageCount()).toBe(2);
  });
});
