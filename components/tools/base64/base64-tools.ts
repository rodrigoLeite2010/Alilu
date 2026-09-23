/**
 * Configuração das 19 ferramentas do Conversor Base64.
 *
 * Todas usam o mesmo componente (Base64Tool) e os mesmos helpers
 * (lib/base64/converters.ts); aqui fica só o que muda entre elas. Nome,
 * slug, descrição e SEO continuam centralizados em data/tools.ts — as
 * chaves deste objeto são os ids do catálogo.
 */

export type Base64ToolMode =
  | "decode-text"
  | "decode-ascii"
  | "decode-basic-auth"
  | "decode-hex"
  | "decode-blob"
  | "encode-text"
  | "encode-hex"
  | "encode-file"
  | "encode-url";

/** Tipo de mídia tratado pelas ferramentas de arquivo (preview, validação e MIME). */
export type Base64Media = "image" | "audio" | "video" | "pdf" | "file";

export type Base64ToolGroup = "decode" | "encode";

export interface Base64ToolConfig {
  id: string;
  group: Base64ToolGroup;
  mode: Base64ToolMode;
  media?: Base64Media;
  inputLabel: string;
  inputPlaceholder?: string;
  /** MIME usado quando não há Data URI nem assinatura reconhecível */
  defaultMimeType?: string;
  accept?: string;
  acceptDescription?: string;
  maxFileBytes?: number;
  outputFileName?: string;
  securityNotice?: string;
  showDataUri?: boolean;
  uppercaseOption?: boolean;
  /** Mostra os campos "Nome do arquivo" e "MIME type" no decoder genérico */
  allowCustomMime?: boolean;
}

export const MB = 1024 * 1024;

/** A partir deste tamanho, avisamos que a conversão pode demorar. */
export const LARGE_FILE_WARNING_BYTES = 10 * MB;

/** Limite para exibir o resultado inteiro em textarea (acima disso, prévia + download). */
export const MAX_INLINE_RESULT_CHARS = 1_000_000;

/** Limite de download no modo "conteúdo da URL" (feito pelo navegador do usuário). */
export const MAX_REMOTE_URL_BYTES = 20 * MB;

export const base64ToolConfigs: Record<string, Base64ToolConfig> = {
  // DECODIFICAR BASE64
  "base64-para-ascii": {
    id: "base64-para-ascii",
    group: "decode",
    mode: "decode-ascii",
    inputLabel: "Base64",
    inputPlaceholder: "QWxpbHUgVXRpbGl0w6FyaW9z",
  },
  "base64-para-audio": {
    id: "base64-para-audio",
    group: "decode",
    mode: "decode-blob",
    media: "audio",
    inputLabel: "Base64 ou Data URI do áudio",
    inputPlaceholder: "data:audio/mpeg;base64,SUQzBAAAAAAA...",
    defaultMimeType: "audio/mpeg",
    outputFileName: "audio-convertido",
  },
  "basic-auth-decode": {
    id: "basic-auth-decode",
    group: "decode",
    mode: "decode-basic-auth",
    inputLabel: "Cabeçalho Basic Auth ou Base64",
    inputPlaceholder: "Basic dXNlcjpwYXNzd29yZA==",
    securityNotice: "Não use senhas reais ou credenciais sensíveis em computadores públicos.",
  },
  "base64-para-arquivo": {
    id: "base64-para-arquivo",
    group: "decode",
    mode: "decode-blob",
    media: "file",
    inputLabel: "Base64 ou Data URI do arquivo",
    inputPlaceholder: "UEsDBBQAAAAIA...",
    defaultMimeType: "application/octet-stream",
    outputFileName: "arquivo-convertido",
    allowCustomMime: true,
  },
  "base64-para-hex": {
    id: "base64-para-hex",
    group: "decode",
    mode: "decode-hex",
    inputLabel: "Base64",
    inputPlaceholder: "QWxpbHU=",
    uppercaseOption: true,
  },
  "base64-para-imagem": {
    id: "base64-para-imagem",
    group: "decode",
    mode: "decode-blob",
    media: "image",
    inputLabel: "Base64 ou Data URI da imagem",
    inputPlaceholder: "data:image/png;base64,iVBORw0KGgo...",
    defaultMimeType: "image/png",
    outputFileName: "imagem-convertida",
  },
  "base64-para-pdf": {
    id: "base64-para-pdf",
    group: "decode",
    mode: "decode-blob",
    media: "pdf",
    inputLabel: "Base64 ou Data URI do PDF",
    inputPlaceholder: "data:application/pdf;base64,JVBERi0xLjcK...",
    defaultMimeType: "application/pdf",
    outputFileName: "documento-convertido",
  },
  "base64-para-texto": {
    id: "base64-para-texto",
    group: "decode",
    mode: "decode-text",
    inputLabel: "Base64",
    inputPlaceholder: "U8OjbyBKb3PDqSBkb3MgQ2FtcG9z",
  },
  "base64-para-video": {
    id: "base64-para-video",
    group: "decode",
    mode: "decode-blob",
    media: "video",
    inputLabel: "Base64 ou Data URI do vídeo",
    inputPlaceholder: "data:video/mp4;base64,AAAAIGZ0eXBpc29t...",
    defaultMimeType: "video/mp4",
    outputFileName: "video-convertido",
  },

  // CONVERTER PARA BASE64
  "audio-para-base64": {
    id: "audio-para-base64",
    group: "encode",
    mode: "encode-file",
    media: "audio",
    inputLabel: "Arquivo de áudio",
    accept: "audio/*",
    acceptDescription: "MP3, WAV, OGG, M4A, WEBM e outros formatos de áudio",
    maxFileBytes: 50 * MB,
    showDataUri: true,
  },
  "css-para-base64": {
    id: "css-para-base64",
    group: "encode",
    mode: "encode-text",
    inputLabel: "Código CSS",
    inputPlaceholder: "body { color: #111827; font-family: system-ui; }",
    defaultMimeType: "text/css",
    accept: ".css,text/css",
    acceptDescription: "Arquivo .css",
    maxFileBytes: 5 * MB,
    showDataUri: true,
  },
  "arquivo-para-base64": {
    id: "arquivo-para-base64",
    group: "encode",
    mode: "encode-file",
    media: "file",
    inputLabel: "Arquivo",
    acceptDescription: "Qualquer tipo de arquivo",
    maxFileBytes: 100 * MB,
    showDataUri: true,
  },
  "hex-para-base64": {
    id: "hex-para-base64",
    group: "encode",
    mode: "encode-hex",
    inputLabel: "Hexadecimal",
    inputPlaceholder: "41 6C 69 6C 75",
  },
  "html-para-base64": {
    id: "html-para-base64",
    group: "encode",
    mode: "encode-text",
    inputLabel: "Código HTML",
    inputPlaceholder: "<h1>Olá, Alilu!</h1>",
    defaultMimeType: "text/html;charset=utf-8",
    showDataUri: true,
  },
  "imagem-para-base64": {
    id: "imagem-para-base64",
    group: "encode",
    mode: "encode-file",
    media: "image",
    inputLabel: "Imagem",
    accept: "image/png,image/jpeg,image/gif,image/webp,image/svg+xml,.png,.jpg,.jpeg,.gif,.webp,.svg",
    acceptDescription: "PNG, JPG, GIF, WEBP ou SVG",
    maxFileBytes: 20 * MB,
    showDataUri: true,
  },
  "pdf-para-base64": {
    id: "pdf-para-base64",
    group: "encode",
    mode: "encode-file",
    media: "pdf",
    inputLabel: "PDF",
    accept: "application/pdf,.pdf",
    acceptDescription: "Arquivo PDF",
    maxFileBytes: 50 * MB,
    showDataUri: true,
  },
  "texto-para-base64": {
    id: "texto-para-base64",
    group: "encode",
    mode: "encode-text",
    inputLabel: "Texto",
    inputPlaceholder: "Olá, mundo! 🚀",
    defaultMimeType: "text/plain;charset=utf-8",
  },
  "url-para-base64": {
    id: "url-para-base64",
    group: "encode",
    mode: "encode-url",
    inputLabel: "URL",
    inputPlaceholder: "https://alilu.com.br",
    maxFileBytes: MAX_REMOTE_URL_BYTES,
    showDataUri: true,
  },
  "video-para-base64": {
    id: "video-para-base64",
    group: "encode",
    mode: "encode-file",
    media: "video",
    inputLabel: "Vídeo",
    accept: "video/mp4,video/webm,video/ogg,video/quicktime,.mp4,.webm,.ogv,.mov",
    acceptDescription: "MP4, WEBM, OGV ou MOV",
    maxFileBytes: 100 * MB,
    showDataUri: true,
  },
};

export function getBase64ToolConfig(id: string): Base64ToolConfig | undefined {
  return base64ToolConfigs[id];
}
