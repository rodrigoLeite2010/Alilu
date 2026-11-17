/**
 * Leitura de feeds RSS 2.0 / Atom (inclui o feed oficial de canais do
 * YouTube, com media:statistics) — módulo puro, sem rede.
 *
 * Segurança: DOCTYPE/entidades são recusados (XXE, "billion laughs"),
 * limites de nós, profundidade e tamanho de texto; nenhuma URL do feed é
 * acessada aqui (quem baixa o feed é o download seguro, com SSRF).
 */
import { SaxesParser } from "saxes";

export class FeedParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FeedParseError";
  }
}

export interface FeedEntry {
  id: string;
  title: string | null;
  link: string | null;
  description: string | null;
  author: string | null;
  publishedAt: Date | null;
  /** Arquivo de vídeo anunciado pelo próprio feed (enclosure/media:content). */
  mediaUrl: string | null;
  mediaType: string | null;
  thumbnailUrl: string | null;
  durationSeconds: number | null;
  /** Só quando o feed traz a métrica (ex.: feed do YouTube). */
  views: number | null;
  likes: number | null;
  youtubeVideoId: string | null;
}

interface XNode {
  name: string;
  attrs: Record<string, string>;
  children: XNode[];
  text: string;
}

const MAX_NODES = 200_000;
const MAX_DEPTH = 40;
const MAX_TEXT = 20_000;
export const MAX_FEED_ENTRIES = 100;

function parseTree(xml: string): XNode {
  const parser = new SaxesParser({ xmlns: false });
  const root: XNode = { name: "#root", attrs: {}, children: [], text: "" };
  const stack: XNode[] = [root];
  let nodes = 0;
  let failure: Error | null = null;
  parser.on("doctype", () => {
    throw new FeedParseError("Feed com DOCTYPE/entidades não é aceito por segurança.");
  });
  parser.on("opentag", (tag) => {
    if (++nodes > MAX_NODES) throw new FeedParseError("Feed grande demais.");
    if (stack.length > MAX_DEPTH) throw new FeedParseError("Feed aninhado demais.");
    const attrs: Record<string, string> = {};
    for (const [key, value] of Object.entries(tag.attributes as Record<string, string>)) attrs[key] = String(value).slice(0, 4000);
    const node: XNode = { name: tag.name.toLowerCase(), attrs, children: [], text: "" };
    stack.at(-1)!.children.push(node);
    stack.push(node);
  });
  const onText = (text: string) => {
    const current = stack.at(-1)!;
    if (current.text.length < MAX_TEXT) current.text += text;
  };
  parser.on("text", onText);
  parser.on("cdata", onText);
  parser.on("closetag", () => {
    stack.pop();
  });
  parser.on("error", (error) => {
    failure = error;
  });
  try {
    parser.write(xml).close();
  } catch (error) {
    if (error instanceof FeedParseError) throw error;
    throw new FeedParseError("Feed malformado.");
  }
  if (failure) throw new FeedParseError("Feed malformado.");
  return root;
}

const child = (node: XNode, ...names: string[]) => node.children.find((item) => names.includes(item.name)) ?? null;
const children = (node: XNode, ...names: string[]) => node.children.filter((item) => names.includes(item.name));
const text = (node: XNode | null) => {
  const value = node?.text.replace(/\s+/g, " ").trim();
  return value ? value : null;
};

function find(node: XNode, name: string, depth = 0): XNode | null {
  if (depth > 4) return null;
  for (const item of node.children) {
    if (item.name === name) return item;
    const nested = find(item, name, depth + 1);
    if (nested) return nested;
  }
  return null;
}

function httpUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function date(value: string | null): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function int(value: string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : null;
}

function stripHtml(value: string | null): string | null {
  if (!value) return null;
  const cleaned = value.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
  return cleaned ? cleaned.slice(0, 2000) : null;
}

const VIDEO_TYPES = /^(video\/(mp4|quicktime)|application\/x-mpegurl)$/i;

function mediaFrom(entry: XNode): { url: string | null; type: string | null; duration: number | null } {
  for (const enclosure of children(entry, "enclosure")) {
    const type = (enclosure.attrs.type ?? "").toLowerCase();
    const url = httpUrl(enclosure.attrs.url);
    if (url && (VIDEO_TYPES.test(type) || /\.(mp4|mov)(\?|$)/i.test(url))) return { url, type: type || null, duration: null };
  }
  const contents = [...children(entry, "media:content"), ...children(child(entry, "media:group") ?? { name: "", attrs: {}, children: [], text: "" }, "media:content")];
  for (const content of contents) {
    const type = (content.attrs.type ?? "").toLowerCase();
    const medium = (content.attrs.medium ?? "").toLowerCase();
    const url = httpUrl(content.attrs.url);
    if (!url) continue;
    // O feed do YouTube anuncia o PLAYER (application/x-shockwave-flash), não um arquivo: nunca é "mídia baixável".
    if (VIDEO_TYPES.test(type) || (medium === "video" && /\.(mp4|mov)(\?|$)/i.test(url))) {
      return { url, type: type || null, duration: int(content.attrs.duration) };
    }
  }
  return { url: null, type: null, duration: null };
}

function parseEntry(entry: XNode, atom: boolean): FeedEntry | null {
  const group = child(entry, "media:group");
  const youtubeVideoId = text(child(entry, "yt:videoid"));
  let link: string | null = null;
  if (atom) {
    const links = children(entry, "link");
    const alternate = links.find((item) => (item.attrs.rel ?? "alternate") === "alternate") ?? links[0];
    link = httpUrl(alternate?.attrs.href ?? null);
  } else {
    link = httpUrl(text(child(entry, "link")));
  }
  const guid = text(child(entry, "guid", "id"));
  const id = youtubeVideoId ? `yt:${youtubeVideoId}` : guid ?? link;
  if (!id) return null;

  const media = mediaFrom(entry);
  const thumbnail =
    httpUrl(child(entry, "media:thumbnail")?.attrs.url) ??
    httpUrl(group ? child(group, "media:thumbnail")?.attrs.url : null) ??
    httpUrl(find(entry, "media:thumbnail")?.attrs.url ?? null);
  const statistics = find(entry, "media:statistics");
  const rating = find(entry, "media:starrating");
  const authorNode = child(entry, "author");
  const author = authorNode ? text(child(authorNode, "name")) ?? text(authorNode) : text(child(entry, "dc:creator"));

  return {
    id: id.slice(0, 500),
    title: text(child(entry, "title")) ?? text(group ? child(group, "media:title") : null),
    link,
    description: stripHtml(text(child(entry, "description", "summary", "content")) ?? text(group ? child(group, "media:description") : null)),
    author: author ? author.slice(0, 200) : null,
    publishedAt: date(text(child(entry, "pubdate", "published", "updated", "dc:date"))),
    mediaUrl: media.url,
    mediaType: media.type,
    thumbnailUrl: thumbnail,
    durationSeconds: media.duration,
    views: statistics ? int(statistics.attrs.views) : null,
    // No feed do YouTube, media:starRating@count é o total de "gostei".
    likes: rating ? int(rating.attrs.count) : null,
    youtubeVideoId: youtubeVideoId && /^[A-Za-z0-9_-]{11}$/.test(youtubeVideoId) ? youtubeVideoId : null,
  };
}

export function parseFeed(xml: string): { title: string | null; entries: FeedEntry[] } {
  const root = parseTree(xml);
  const top = root.children[0];
  if (!top) throw new FeedParseError("Feed vazio.");
  if (top.name === "rss" || top.name === "rdf:rdf") {
    const channel = child(top, "channel") ?? top;
    const items = [...children(channel, "item"), ...children(top, "item")];
    return { title: text(child(channel, "title")), entries: items.slice(0, MAX_FEED_ENTRIES).map((item) => parseEntry(item, false)).filter((e): e is FeedEntry => e !== null) };
  }
  if (top.name === "feed") {
    return { title: text(child(top, "title")), entries: children(top, "entry").slice(0, MAX_FEED_ENTRIES).map((item) => parseEntry(item, true)).filter((e): e is FeedEntry => e !== null) };
  }
  throw new FeedParseError("O endereço não é um feed RSS/Atom.");
}

/** Feed oficial (sem cota) de um canal do YouTube. */
export function youtubeChannelFeedUrl(channelId: string): string {
  return `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`;
}

export function isValidYoutubeChannelId(value: string): boolean {
  return /^UC[A-Za-z0-9_-]{22}$/.test(value);
}
