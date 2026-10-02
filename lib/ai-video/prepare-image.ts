/**
 * Prepara a imagem escolhida no navegador antes do upload (roda no cliente).
 *
 * Celular é onde mais falha:
 *   - iPhone entrega HEIC/HEIF; galerias do Android às vezes mandam o
 *     arquivo com tipo vazio ("") ou "image/jpg";
 *   - fotos da câmera passam fácil de 10–20 MB e milhares de pixels.
 * O upload só aceita JPG/PNG/WebP até 16 MB, então: se já estiver num formato
 * aceito e num tamanho razoável, vai como está; senão, o próprio navegador
 * decodifica e regrava como JPEG (ou PNG, para manter transparência),
 * com no máximo MAX_SIDE pixels no maior lado.
 */

export const PREPARE_MAX_SIDE = 2560;
const PASS_THROUGH_BYTES = 4 * 1024 * 1024;
const ACCEPTED = new Set(["image/jpeg", "image/png", "image/webp"]);

export class ImagePrepareError extends Error {}

/** Tipo efetivo: corrige "image/jpg" e tipo vazio pela extensão do nome. */
export function effectiveImageType(file: Pick<File, "type" | "name">): string {
  const type = (file.type || "").toLowerCase();
  if (type === "image/jpg" || type === "image/pjpeg") return "image/jpeg";
  if (type) return type;
  const ext = file.name.toLowerCase().split(".").pop() ?? "";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "heic" || ext === "heif") return "image/heic";
  return "";
}

export function needsConversion(type: string, size: number): boolean {
  return !ACCEPTED.has(type) || size > PASS_THROUGH_BYTES;
}

export function targetSize(width: number, height: number, maxSide = PREPARE_MAX_SIDE): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= maxSide) return { width, height };
  const scale = maxSide / longest;
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

async function decode(file: File): Promise<{ source: CanvasImageSource; width: number; height: number; close: () => void }> {
  if (typeof createImageBitmap === "function") {
    try {
      // "from-image": respeita a rotação EXIF da foto do celular.
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
    } catch {
      // alguns navegadores (Safari antigo) não decodificam por aqui — tenta <img>
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, close: () => URL.revokeObjectURL(url) };
  } catch {
    URL.revokeObjectURL(url);
    throw new ImagePrepareError("Não foi possível abrir essa imagem. Use uma foto JPG, PNG ou WebP (no iPhone: Ajustes › Câmera › Formatos › Mais compatível).");
  }
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/** Devolve um File pronto para o upload (JPG/PNG/WebP, ≤ maxBytes). */
export async function prepareImageForUpload(file: File, maxBytes: number): Promise<File> {
  const type = effectiveImageType(file);
  if (type && !type.startsWith("image/")) throw new ImagePrepareError("Escolha um arquivo de imagem (JPG, PNG ou WebP).");
  if (!needsConversion(type, file.size)) {
    return file.type === type ? file : new File([file], file.name, { type, lastModified: file.lastModified });
  }

  const decoded = await decode(file);
  try {
    const size = targetSize(decoded.width, decoded.height);
    const canvas = document.createElement("canvas");
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext("2d");
    if (!context) throw new ImagePrepareError("Seu navegador não conseguiu preparar a imagem. Tente outra foto.");
    const keepAlpha = type === "image/png" || type === "image/webp";
    if (!keepAlpha) {
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, size.width, size.height);
    }
    context.drawImage(decoded.source, 0, 0, size.width, size.height);
    const outType = keepAlpha ? "image/png" : "image/jpeg";
    let blob = await toBlob(canvas, outType, 0.9);
    if (blob && blob.size > maxBytes && outType === "image/jpeg") blob = await toBlob(canvas, outType, 0.75);
    if (!blob) throw new ImagePrepareError("Seu navegador não conseguiu preparar a imagem. Tente outra foto.");
    if (blob.size > maxBytes) throw new ImagePrepareError("A imagem ficou grande demais mesmo depois de reduzida. Tente outra foto.");
    const base = file.name.replace(/\.[^.]+$/, "") || "imagem";
    return new File([blob], `${base}.${outType === "image/png" ? "png" : "jpg"}`, { type: outType, lastModified: Date.now() });
  } finally {
    decoded.close();
  }
}
