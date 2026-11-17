/**
 * Prompts e saneamento das respostas de IA do Radar Viral (puro, testado).
 *
 * Regras impostas no prompt E no código (a IA não é a última palavra):
 *   - a IA nunca informa métricas (as do painel vêm só das APIs);
 *   - "confirmado" só vale com link de uma FONTE OFICIAL configurada;
 *     o resto vira "a verificar" / "rumor" / "teoria";
 *   - nada de "gameplay oficial", "trailer oficial", "data confirmada",
 *     "vazamento" sem fonte — o código troca/remove;
 *   - legenda dentro dos limites do Instagram (2.200 caracteres, 30 hashtags).
 */
import { validateCaption } from "@/lib/video-queue/captions";
import { CAPTION_STYLE_LABEL, type CaptionStyle } from "./types";

export const CONTENT_TYPES = ["noticia", "curiosidade", "comparacao", "teoria", "rumor", "gameplay", "humor", "outro"] as const;
export type ContentType = (typeof CONTENT_TYPES)[number];
export const CLAIM_STATUSES = ["confirmado", "rumor", "teoria", "a_verificar"] as const;
export type ClaimStatus = (typeof CLAIM_STATUSES)[number];

export interface CandidateForAi {
  title: string | null;
  description: string | null;
  authorName: string | null;
  platform: string;
  publishedAt: Date | null;
}

const clip = (value: string | null | undefined, max: number) => (value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
const str = (value: unknown, max: number) => (typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "");
const num01 = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(1, Math.max(0, parsed)) : null;
};

const BASE_RULES = [
  "Responda SOMENTE com um objeto JSON válido, sem texto fora dele.",
  "Nunca invente números (visualizações, curtidas, datas, preços) nem afirme que algo viralizará.",
  "Não chame nada de trailer oficial, gameplay oficial, vazamento ou data de lançamento confirmada, a menos que a fonte oficial listada diga isso.",
  "Diferencie notícia confirmada (com fonte oficial), rumor e teoria de fãs.",
].join("\n");

function describeCandidate(candidate: CandidateForAi): string {
  return [
    `Plataforma: ${candidate.platform}`,
    `Título: "${clip(candidate.title, 200)}"`,
    candidate.description ? `Descrição (trecho): "${clip(candidate.description, 600)}"` : "Descrição: (vazia)",
    candidate.authorName ? `Autor/canal: ${clip(candidate.authorName, 80)}` : "",
    candidate.publishedAt ? `Publicado em: ${candidate.publishedAt.toISOString().slice(0, 10)}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildClassificationPrompt(candidate: CandidateForAi, theme: string): string {
  return [
    `Você classifica vídeos para um radar de conteúdo sobre ${theme}. Analise só os METADADOS abaixo (você não assistiu ao vídeo).`,
    describeCandidate(candidate),
    "",
    BASE_RULES,
    `Formato: {"topic": string (assunto principal, até 100 caracteres), "relevance": número 0..1 (aderência a ${theme}), "contentType": um de ${CONTENT_TYPES.join("|")}, "claimStatus": um de rumor|teoria|a_verificar, "isLikelyRepost": boolean (parece reupload/compilação de outro canal), "adaptability": número 0..1 (potencial de virar um conteúdo ORIGINAL nosso), "adaptationIdea": string (até 200 caracteres, sem copiar o vídeo)}`,
  ].join("\n");
}

export interface Classification {
  topic: string;
  relevance: number | null;
  contentType: ContentType;
  claimStatus: ClaimStatus;
  isLikelyRepost: boolean;
  adaptability: number | null;
  adaptationIdea: string;
}

export function sanitizeClassification(raw: Record<string, unknown>): Classification {
  const contentType = CONTENT_TYPES.includes(raw.contentType as ContentType) ? (raw.contentType as ContentType) : "outro";
  // Classificação por metadados nunca "confirma" nada.
  const claim = raw.claimStatus === "rumor" || raw.claimStatus === "teoria" ? (raw.claimStatus as ClaimStatus) : "a_verificar";
  return {
    topic: str(raw.topic, 100),
    relevance: num01(raw.relevance),
    contentType,
    claimStatus: claim,
    isLikelyRepost: raw.isLikelyRepost === true,
    adaptability: num01(raw.adaptability),
    adaptationIdea: str(raw.adaptationIdea, 200),
  };
}

const MISLEADING: Array<[RegExp, string]> = [
  [/\b(trailer|gameplay)\s+oficial\b/gi, "$1"],
  [/\bvazad[oa]s?\b|\bvazamento\b/gi, "rumor"],
  [/\b(data|lan[cç]amento)\s+confirmad[oa]\b/gi, "$1 (ainda sem anúncio da desenvolvedora)"],
  [/\bconfirmad[oa]\b/gi, "comentado"],
];

/** Troca afirmações enganosas quando não há fonte oficial. */
export function softenClaims(text: string, hasOfficialSource: boolean): string {
  if (hasOfficialSource) return text;
  return MISLEADING.reduce((acc, [pattern, replacement]) => acc.replace(pattern, replacement), text);
}

export function buildCaptionPrompt(input: { candidate: CandidateForAi; theme: string; style: CaptionStyle; hashtags: string[]; ownContent: boolean }): string {
  return [
    `Escreva textos para um Reel do Instagram/Facebook sobre ${input.theme}, no estilo "${CAPTION_STYLE_LABEL[input.style]}".`,
    input.ownContent ? "O vídeo é material próprio/licenciado de quem publica." : "",
    "Base (metadados do vídeo):",
    describeCandidate(input.candidate),
    "",
    BASE_RULES,
    "Descreva só o que os metadados permitem; se for rumor ou teoria, diga isso no texto.",
    `Hashtags preferidas: ${input.hashtags.join(" ") || "(nenhuma)"}`,
    'Formato: {"headline": string (até 60 caracteres, para a capa), "title": string (até 90), "description": string (até 300), "instagramCaption": string (até 1500, com quebras de linha), "facebookCaption": string (até 1500), "hashtags": string[] (3 a 8, começando com #), "cta": string (chamada para comentários, até 100)}',
  ]
    .filter(Boolean)
    .join("\n");
}

export interface GeneratedCaption {
  headline: string;
  title: string;
  description: string;
  instagramCaption: string;
  facebookCaption: string;
  hashtags: string[];
  cta: string;
}

function hashtagList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((tag): tag is string => typeof tag === "string").map((tag) => tag.trim().replace(/\s+/g, "")).filter((tag) => /^#[\p{L}\p{N}_]{1,60}$/u.test(tag)))].slice(0, 8);
}

/** Monta a legenda final (texto + CTA + hashtags) e garante os limites. null = resposta inutilizável. */
export function sanitizeCaption(raw: Record<string, unknown>, hasOfficialSource: boolean): GeneratedCaption | null {
  const soft = (value: unknown, max: number) => softenClaims(typeof value === "string" ? value.trim().slice(0, max) : "", hasOfficialSource);
  const hashtags = hashtagList(raw.hashtags);
  const cta = soft(raw.cta, 100);
  const compose = (body: string) => [body, cta, hashtags.join(" ")].filter(Boolean).join("\n\n").slice(0, 2200);
  const instagramBody = soft(raw.instagramCaption, 1500);
  if (!instagramBody) return null;
  const instagramCaption = compose(instagramBody);
  if (validateCaption(instagramCaption)) return null;
  const facebookBody = soft(raw.facebookCaption, 1500) || instagramBody;
  return {
    headline: soft(raw.headline, 60),
    title: soft(raw.title, 90),
    description: soft(raw.description, 300),
    instagramCaption,
    facebookCaption: compose(facebookBody),
    hashtags,
    cta,
  };
}

export interface TrustedHeadline {
  title: string;
  link: string | null;
  publishedAt: string | null;
  source: string;
}

export function buildBriefPrompt(input: { candidate: CandidateForAi; theme: string; style: CaptionStyle; headlines: TrustedHeadline[] }): string {
  const headlines = input.headlines.length
    ? input.headlines.map((item, index) => `[${index + 1}] ${clip(item.title, 160)} — ${item.source}${item.link ? ` — ${item.link}` : ""}`).join("\n")
    : "(nenhuma fonte oficial configurada — trate tudo como a verificar)";
  return [
    `Crie um ROTEIRO ORIGINAL para um Reel sobre ${input.theme}, inspirado apenas no ASSUNTO de um vídeo de terceiros que está em alta.`,
    "NÃO reproduza o vídeo, a narração, o roteiro nem as imagens do autor. Use só o tema/informação factual como ponto de partida.",
    "Vídeo de referência (metadados):",
    describeCandidate(input.candidate),
    "",
    "Fontes oficiais disponíveis para checagem (use o link exato para marcar algo como confirmado):",
    headlines,
    "",
    BASE_RULES,
    `Estilo: ${CAPTION_STYLE_LABEL[input.style]}.`,
    'Formato: {"topic": string, "angle": string (abordagem original, até 200), "hook": string (primeira frase, até 120), "script": string[] (3 a 8 falas/cenas curtas), "claims": [{"text": string, "status": "confirmado"|"rumor"|"teoria"|"a_verificar", "sourceLink": string|null}], "visuals": string[] (cenas a montar com material PRÓPRIO ou licenciado, nunca com o vídeo de referência), "title": string, "caption": string, "hashtags": string[], "warnings": string[]}',
  ].join("\n");
}

export interface ContentBrief {
  topic: string;
  angle: string;
  hook: string;
  script: string[];
  claims: Array<{ text: string; status: ClaimStatus; sourceLink: string | null }>;
  visuals: string[];
  title: string;
  caption: string;
  hashtags: string[];
  warnings: string[];
  referenceUrl: string;
  generatedWith: { headlines: number; officialLinks: string[] };
}

/** "Confirmado" só com link idêntico a uma fonte oficial configurada — o resto vira "a verificar". */
export function sanitizeBrief(raw: Record<string, unknown>, headlines: TrustedHeadline[], referenceUrl: string): ContentBrief {
  const officialLinks = headlines.map((item) => item.link).filter((link): link is string => Boolean(link));
  const list = (value: unknown, max: number, each: number) =>
    Array.isArray(value) ? value.filter((item): item is string => typeof item === "string").map((item) => item.trim().slice(0, each)).filter(Boolean).slice(0, max) : [];
  const claims = (Array.isArray(raw.claims) ? raw.claims : []).slice(0, 12).flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const claim = item as Record<string, unknown>;
    const text = str(claim.text, 300);
    if (!text) return [];
    const link = typeof claim.sourceLink === "string" && officialLinks.includes(claim.sourceLink) ? claim.sourceLink : null;
    let status: ClaimStatus = CLAIM_STATUSES.includes(claim.status as ClaimStatus) ? (claim.status as ClaimStatus) : "a_verificar";
    if (status === "confirmado" && !link) status = "a_verificar";
    return [{ text, status, sourceLink: link }];
  });
  const hasOfficial = claims.some((claim) => claim.status === "confirmado");
  const warnings = list(raw.warnings, 6, 200);
  if (!hasOfficial) warnings.push("Nenhuma informação foi confirmada por fonte oficial: revise antes de publicar.");
  return {
    topic: str(raw.topic, 120),
    angle: softenClaims(str(raw.angle, 200), hasOfficial),
    hook: softenClaims(str(raw.hook, 120), hasOfficial),
    script: list(raw.script, 8, 300).map((line) => softenClaims(line, hasOfficial)),
    claims,
    visuals: list(raw.visuals, 8, 200),
    title: softenClaims(str(raw.title, 90), hasOfficial),
    caption: softenClaims(typeof raw.caption === "string" ? raw.caption.trim().slice(0, 2000) : "", hasOfficial),
    hashtags: hashtagList(raw.hashtags),
    warnings,
    referenceUrl,
    generatedWith: { headlines: headlines.length, officialLinks },
  };
}
