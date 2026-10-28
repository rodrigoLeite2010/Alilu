import "server-only";
import sharp from "sharp";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { createCanvas, GlobalFonts } from "@napi-rs/canvas";
import { put, del, list } from "@vercel/blob";
import { getDb } from "@/lib/db/client";
import { PropertyError } from "./model";
import { boundedBody } from "./http";

const WATERMARK_FONT_FAMILY = "Alilu Property Watermark";
const WATERMARK_FONT_PATH = path.join(
  process.cwd(),
  "lib/ai-video/backend/fonts/DejaVuSans-Bold.ttf",
);
let watermarkFontRegistered = false;

function ensureWatermarkFont() {
  if (watermarkFontRegistered) return;
  if (!GlobalFonts.registerFromPath(WATERMARK_FONT_PATH, WATERMARK_FONT_FAMILY))
    throw new Error("Fonte da marca d'água indisponível.");
  watermarkFontRegistered = true;
}

/** Satori in the installed Next build cannot embed WebP. Only fetch our Blob prefix. */
export async function sharePhoto(source: string): Promise<string | null> {
  try {
    const url = new URL(source);
    if (
      url.protocol !== "https:" ||
      !url.hostname.endsWith(".public.blob.vercel-storage.com") ||
      !url.pathname.startsWith("/imoveis/") ||
      url.username ||
      url.password
    )
      return null;
    const response = await fetch(url, {
      signal: AbortSignal.timeout(5000),
      redirect: "error",
    });
    if (
      !response.ok ||
      Number(response.headers.get("content-length")) > 2 * 1024 * 1024
    )
      return null;
    const reader = response.body?.getReader();
    if (!reader) return null;
    const chunks: Uint8Array[] = [];
    let length = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > 2 * 1024 * 1024) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
    const png = await sharp(Buffer.concat(chunks), {
      limitInputPixels: 40_000_000,
    })
      .rotate()
      .resize(600, 630, { fit: "cover" })
      .png()
      .toBuffer();
    return `data:image/png;base64,${png.toString("base64")}`;
  } catch {
    return null;
  }
}

export async function processImage(
  buffer: Buffer,
  extension: string,
  contentType: string,
  watermarkName = "",
  watermarkCreci = "",
) {
  const formats: Record<string, string> = {
    jpg: "jpeg",
    jpeg: "jpeg",
    png: "png",
    webp: "webp",
  };
  const format = formats[extension.toLowerCase()];
  if (!format || contentType !== `image/${format}`)
    throw new PropertyError("Envie JPEG, PNG ou WebP.");
  try {
    const image = sharp(buffer, {
      limitInputPixels: 40_000_000,
      failOn: "warning",
      animated: false,
    });
    const metadata = await image.metadata();
    if (
      metadata.format !== format ||
      (metadata.pages ?? 1) > 1 ||
      !metadata.width ||
      !metadata.height ||
      metadata.width < 200 ||
      metadata.height < 200
    )
      throw new Error("invalid");
    // Sharp strips metadata by default. Never call withMetadata/keepMetadata.
    const [fullBase, thumbBase] = await Promise.all([
      image
        .clone()
        .rotate()
        .resize({
          width: 1600,
          height: 1600,
          fit: "inside",
          withoutEnlargement: true,
        })
        .webp({ quality: 80 })
        .toBuffer(),
      image
        .clone()
        .rotate()
        .resize({ width: 480, height: 360, fit: "cover" })
        .webp({ quality: 75 })
        .toBuffer(),
    ]);
    const watermark = watermarkName.trim().slice(0, 80);
    const creci = watermarkCreci.trim().slice(0, 40);
    const applyWatermark = async (source: Buffer) => {
      if (!watermark && !creci) return source;
      const { width, height } = await sharp(source).metadata();
      if (!width || !height) throw new Error("invalid output");
      return sharp(source)
        .composite([
          {
            input: await renderWatermarkOverlay(
              width,
              height,
              watermark,
              creci,
            ),
          },
        ])
        .webp({ quality: 80 })
        .toBuffer();
    };
    const [full, thumb] = await Promise.all([
      applyWatermark(fullBase),
      applyWatermark(thumbBase),
    ]);
    if (full.length + thumb.length > 2 * 1024 * 1024)
      throw new Error("too large");
    return { full, thumb };
  } catch {
    throw new PropertyError(
      "Imagem inválida. Use uma foto estática de pelo menos 200 × 200 pixels, até 40 megapixels.",
    );
  }
}

export async function renderWatermarkOverlay(
  width: number,
  height: number,
  name: string,
  creci = "",
) {
  ensureWatermarkFont();
  const canvas = createCanvas(width, height);
  const context = canvas.getContext("2d");
  const clean = (value: string, max: number) =>
    Array.from(value.trim().replace(/\s+/g, " "))
      .slice(0, max)
      .join("");
  const nameText = clean(name, 80);
  const creciValue = clean(creci, 40);
  const creciText = creciValue
    ? /^creci\b/i.test(creciValue)
      ? creciValue
      : `CRECI ${creciValue}`
    : "";
  const maxTextWidth = width * 0.56;
  const baseSize = Math.max(12, Math.round(Math.min(width, height) * 0.034));

  const fit = (text: string, size: number) => {
    context.font = `${size}px "${WATERMARK_FONT_FAMILY}"`;
    const measured = context.measureText(text).width;
    if (measured > maxTextWidth) {
      size = Math.max(10, Math.floor((size * maxTextWidth) / measured));
      context.font = `${size}px "${WATERMARK_FONT_FAMILY}"`;
    }
    let visible = text;
    while (
      context.measureText(visible).width > maxTextWidth &&
      visible.length > 4
    ) {
      visible = `${Array.from(visible).slice(0, -4).join("")}…`;
    }
    return { text: visible, size };
  };

  // Bottom line first (CRECI), name stacked above it.
  const lines = [
    creciText && fit(creciText, Math.max(10, Math.round(baseSize * 0.8))),
    nameText && fit(nameText, baseSize),
  ].filter(Boolean) as { text: string; size: number }[];

  const margin = Math.max(10, Math.round(width * 0.025));
  context.textAlign = "right";
  context.textBaseline = "bottom";
  context.lineJoin = "round";
  let y = height - margin;
  for (const line of lines) {
    context.font = `${line.size}px "${WATERMARK_FONT_FAMILY}"`;
    context.lineWidth = Math.max(2, line.size * 0.14);
    context.strokeStyle = "rgba(0, 0, 0, 0.72)";
    context.shadowColor = "rgba(0, 0, 0, 0.45)";
    context.shadowBlur = Math.max(2, line.size * 0.16);
    context.shadowOffsetY = Math.max(1, line.size * 0.04);
    context.strokeText(line.text, width - margin, y);
    context.fillStyle = "rgba(255, 255, 255, 0.94)";
    context.fillText(line.text, width - margin, y);
    y -= Math.round(line.size * 1.25);
  }
  return canvas.toBuffer("image/png");
}
export async function uploadImage(request: Request, user: string) {
  const params = new URL(request.url).searchParams;
  const extension = (params.get("name") ?? "").split(".").pop() ?? "";
  const watermarkName = params.get("watermark")?.trim() ?? "";
  if (watermarkName.length > 80)
    throw new PropertyError(
      "O nome da marca d'água deve ter até 80 caracteres.",
    );
  const watermarkCreci = params.get("creci")?.trim() ?? "";
  if (watermarkCreci.length > 40)
    throw new PropertyError("O CRECI da marca d'água deve ter até 40 caracteres.");
  const buffer = await boundedBody(request, 3 * 1024 * 1024);
  const { full, thumb } = await processImage(
    buffer,
    extension,
    request.headers.get("content-type") ?? "",
    watermarkName,
    watermarkCreci,
  );
  const db = getDb(),
    id = randomUUID();
  const [reserved] =
    await db`select reserve_property_image(${user}::uuid,${id}::uuid) as ok`;
  if (!reserved.ok)
    throw new PropertyError(
      "Limite de armazenamento ou de fotos atingido. Remova fotos sem uso ou contate a Alilu.",
      409,
    );
  const paths = [
    `imoveis/${user}/${id}.webp`,
    `imoveis/${user}/${id}-thumb.webp`,
  ];
  try {
    const photo = await put(paths[0], full, {
      access: "public",
      contentType: "image/webp",
      addRandomSuffix: false,
      cacheControlMaxAge: 31536000,
    });
    const thumbnail = await put(paths[1], thumb, {
      access: "public",
      contentType: "image/webp",
      addRandomSuffix: false,
      cacheControlMaxAge: 31536000,
    });
    await db`update property_images set url=${photo.url},thumbnail=${thumbnail.url},bytes=${full.length + thumb.length} where id=${id}`;
    return { id, url: photo.url, thumbnail: thumbnail.url };
  } catch (error) {
    // Retain a cleanup tombstone even if provider deletion fails.
    await db`update property_images set delete_pending=true where id=${id}`;
    throw error;
  }
}
export async function removeImage(user: string, id: string) {
  // Attached photos change only as part of the atomic save, preserving live galleries.
  const rows =
    await getDb()`update property_images set delete_pending=true where id=${id} and user_id=${user} and property_id is null returning id`;
  if (!rows.length)
    throw new PropertyError(
      "Foto não encontrada ou vinculada a um anúncio.",
      404,
    );
}
export async function cleanupImages() {
  const db = getDb();
  await db`with expired as (
    update properties set status='paused',reason='Prazo de 90 dias encerrado. Confirme a disponibilidade e reative para análise.',revision=revision+1,updated_at=now()
    where status='published' and expires_at<=now() returning id
  ) insert into property_history(property_id,action,snapshot) select id,'expired','{}'::jsonb from expired`;
  // Lock/claim abandoned uploads BEFORE a concurrent save can attach them.
  await db`update property_images set delete_pending=true where property_id is null and created_at<now()-interval '24 hours'`;
  const rows =
    await db`select id,user_id,url,thumbnail from property_images where delete_pending and property_id is null limit 100`;
  let deleted = 0;
  for (const row of rows) {
    const paths = [
      `imoveis/${row.user_id}/${row.id}.webp`,
      `imoveis/${row.user_id}/${row.id}-thumb.webp`,
    ];
    await del(paths);
    await db`delete from property_images where id=${row.id} and delete_pending and property_id is null`;
    deleted++;
  }
  // Also reclaim blobs left by deleted accounts or a process crash. One bounded page per run.
  const [cursorRow] =
    await db`select key from property_rate_limits where key like 'cleanup-cursor:%' limit 1`;
  const cursor = cursorRow ? String(cursorRow.key).slice(15) : undefined;
  const batch = await list({ prefix: "imoveis/", limit: 100, cursor });
  for (const blob of batch.blobs) {
    if (new Date(blob.uploadedAt).getTime() > Date.now() - 86400000) continue;
    const id = blob.pathname
      .split("/")
      .pop()
      ?.replace(/-thumb\.webp$|\.webp$/g, "");
    const [ref] =
      await db`select id from property_images where id::text=${id ?? ""} and not delete_pending`;
    if (!ref) await del(blob.url);
  }
  await db`delete from property_rate_limits where key like 'cleanup-cursor:%' or window_start<now()-interval '2 days'`;
  if (batch.hasMore && batch.cursor)
    await db`insert into property_rate_limits(key) values(${`cleanup-cursor:${batch.cursor}`}) on conflict do nothing`;
  return { deleted, scanned: batch.blobs.length };
}
