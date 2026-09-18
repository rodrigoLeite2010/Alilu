import { PdfMergeError } from "@/lib/pdf/merge-pdfs";

const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;
const POINTS_PER_MM = 72 / 25.4;
const CSS_PIXELS_PER_POINT = 96 / 72;
const MAX_HTML_SOURCE_CHARACTERS = 250_000;
const MAX_HTML_PDF_PAGES = 20;
const MAX_RENDERED_PIXELS = 16_000_000;

export type HtmlPdfOptions = {
  orientation: "portrait" | "landscape";
  marginMm: number;
};

function getPageSize(options: HtmlPdfOptions): [number, number] {
  return options.orientation === "landscape"
    ? [A4_HEIGHT, A4_WIDTH]
    : [A4_WIDTH, A4_HEIGHT];
}

function getSafeMarginMm(marginMm: number): number {
  return Math.max(5, Math.min(30, marginMm));
}

/**
 * Remove scripts, links e referências remotas antes de colocar o HTML em uma
 * superfície temporária de renderização. O HTML nunca é enviado a um servidor
 * nem executado como página independente.
 */
export async function sanitizeHtmlForPdf(source: string): Promise<string> {
  if (source.trim().length === 0) {
    throw new PdfMergeError("generation-failed", "Cole ou digite o HTML que deseja converter.");
  }

  if (source.length > MAX_HTML_SOURCE_CHARACTERS) {
    throw new PdfMergeError(
      "generation-failed",
      "O HTML excede o limite de 250 mil caracteres para processamento local."
    );
  }

  const { default: DOMPurify } = await import("dompurify");
  const cleanHtml = DOMPurify.sanitize(source, {
    ALLOWED_TAGS: [
      "article",
      "aside",
      "blockquote",
      "br",
      "code",
      "dd",
      "div",
      "dl",
      "dt",
      "em",
      "figcaption",
      "figure",
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "hr",
      "img",
      "li",
      "main",
      "ol",
      "p",
      "pre",
      "section",
      "small",
      "span",
      "strong",
      "sub",
      "sup",
      "table",
      "tbody",
      "td",
      "tfoot",
      "th",
      "thead",
      "tr",
      "u",
      "ul",
    ],
    ALLOWED_ATTR: ["alt", "colspan", "height", "rowspan", "src", "title", "width"],
    ALLOW_DATA_ATTR: false,
    ALLOWED_URI_REGEXP: /^data:image\/(?:png|jpeg|webp);base64,/i,
  });
  const template = document.createElement("template");
  template.innerHTML = cleanHtml;

  for (const element of Array.from(template.content.querySelectorAll("[src], [href], [style]"))) {
    if (element instanceof HTMLImageElement) {
      const sourceUrl = element.getAttribute("src") ?? "";
      if (/^data:image\/(?:png|jpeg|webp);base64,/i.test(sourceUrl)) {
        continue;
      }
      element.remove();
      continue;
    }

    element.removeAttribute("src");
    element.removeAttribute("href");
    element.removeAttribute("style");
  }

  const result = template.innerHTML.trim();
  if (!result) {
    throw new PdfMergeError("generation-failed", "O HTML não contém conteúdo que possa ser convertido.");
  }

  return result;
}

function createRenderStyles(): HTMLStyleElement {
  const style = document.createElement("style");
  style.textContent = `
    .alilu-pdf-html-render { color: #18181b; font: 16px/1.5 Arial, Helvetica, sans-serif; overflow-wrap: anywhere; }
    .alilu-pdf-html-render h1, .alilu-pdf-html-render h2, .alilu-pdf-html-render h3, .alilu-pdf-html-render h4, .alilu-pdf-html-render h5, .alilu-pdf-html-render h6 { line-height: 1.2; margin: 1.1em 0 0.45em; }
    .alilu-pdf-html-render h1 { font-size: 2em; } .alilu-pdf-html-render h2 { font-size: 1.55em; } .alilu-pdf-html-render h3 { font-size: 1.25em; }
    .alilu-pdf-html-render p, .alilu-pdf-html-render blockquote, .alilu-pdf-html-render pre, .alilu-pdf-html-render ul, .alilu-pdf-html-render ol, .alilu-pdf-html-render dl { margin: 0 0 0.8em; }
    .alilu-pdf-html-render ul, .alilu-pdf-html-render ol { padding-left: 1.4em; }
    .alilu-pdf-html-render blockquote { border-left: 3px solid #a1a1aa; padding-left: 0.8em; }
    .alilu-pdf-html-render pre { white-space: pre-wrap; background: #f4f4f5; padding: 0.65em; }
    .alilu-pdf-html-render table { width: 100%; border-collapse: collapse; margin: 0 0 0.9em; table-layout: fixed; }
    .alilu-pdf-html-render th, .alilu-pdf-html-render td { border: 1px solid #a1a1aa; padding: 0.4em; text-align: left; vertical-align: top; }
    .alilu-pdf-html-render th { background: #f4f4f5; font-weight: 700; }
    .alilu-pdf-html-render img { display: block; max-width: 100%; height: auto; margin: 0.6em 0; }
  `;
  return style;
}

/**
 * Renderiza HTML sanitizado no próprio navegador e recorta o resultado em
 * páginas A4. CSS externo, URLs, scripts e formulários não participam da
 * conversão; apenas o conteúdo local fornecido pela pessoa usuária é usado.
 */
export async function createPdfFromHtml(
  source: string,
  options: HtmlPdfOptions
): Promise<Uint8Array> {
  const cleanHtml = await sanitizeHtmlForPdf(source);
  const [pageWidth, pageHeight] = getPageSize(options);
  const margin = getSafeMarginMm(options.marginMm) * POINTS_PER_MM;
  const widthPixels = Math.round(pageWidth * CSS_PIXELS_PER_POINT);
  const heightPixels = Math.round(pageHeight * CSS_PIXELS_PER_POINT);
  const marginPixels = Math.round(margin * CSS_PIXELS_PER_POINT);
  const container = document.createElement("article");
  const renderStyles = createRenderStyles();
  container.className = "alilu-pdf-html-render";
  container.setAttribute("aria-hidden", "true");
  container.style.cssText = [
    "position: fixed",
    "left: -20000px",
    "top: 0",
    `width: ${widthPixels}px`,
    `min-height: ${heightPixels}px`,
    `padding: ${marginPixels}px`,
    "box-sizing: border-box",
    "background: #ffffff",
    "z-index: -1",
  ].join(";");
  container.innerHTML = cleanHtml;
  document.head.append(renderStyles);
  document.body.append(container);

  try {
    const naturalHeight = Math.max(container.scrollHeight, heightPixels);
    if (naturalHeight > heightPixels * MAX_HTML_PDF_PAGES) {
      throw new PdfMergeError(
        "generation-failed",
        `O conteúdo ultrapassa o limite de ${MAX_HTML_PDF_PAGES} páginas para processamento local.`
      );
    }

    const requestedScale = Math.sqrt(MAX_RENDERED_PIXELS / (widthPixels * naturalHeight));
    const scale = Math.max(0.75, Math.min(1.5, requestedScale));
    const { default: html2canvas } = await import("html2canvas");
    const canvas = await html2canvas(container, {
      allowTaint: false,
      backgroundColor: "#ffffff",
      logging: false,
      scale,
      useCORS: false,
      windowWidth: widthPixels,
    });
    const { PDFDocument } = await import("pdf-lib");
    const pdfDocument = await PDFDocument.create({ updateMetadata: false });
    const pageCanvasHeight = Math.max(1, Math.floor(canvas.width * (pageHeight / pageWidth)));

    for (let sourceY = 0; sourceY < canvas.height; sourceY += pageCanvasHeight) {
      const sliceHeight = Math.min(pageCanvasHeight, canvas.height - sourceY);
      const slice = window.document.createElement("canvas");
      slice.width = canvas.width;
      slice.height = sliceHeight;
      const context = slice.getContext("2d", { alpha: false });
      if (!context) {
        throw new PdfMergeError("generation-failed", "Seu navegador não conseguiu preparar uma página do PDF.");
      }
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, slice.width, slice.height);
      context.drawImage(canvas, 0, sourceY, canvas.width, sliceHeight, 0, 0, slice.width, sliceHeight);
      const image = await pdfDocument.embedJpg(slice.toDataURL("image/jpeg", 0.92));
      const page = pdfDocument.addPage([pageWidth, pageHeight]);
      const imageHeight = pageHeight * (sliceHeight / pageCanvasHeight);
      page.drawImage(image, { x: 0, y: pageHeight - imageHeight, width: pageWidth, height: imageHeight });
      slice.width = 1;
      slice.height = 1;
    }

    canvas.width = 1;
    canvas.height = 1;
    return pdfDocument.save({ addDefaultPage: false, useObjectStreams: true });
  } catch (error) {
    if (error instanceof PdfMergeError) {
      throw error;
    }

    throw new PdfMergeError("generation-failed", "Não foi possível converter este HTML em PDF.");
  } finally {
    container.remove();
    renderStyles.remove();
  }
}
