export type Base64ToolMode =
  | "decode-text"
  | "decode-ascii"
  | "decode-basic-auth"
  | "decode-hex"
  | "decode-file"
  | "decode-image"
  | "decode-pdf"
  | "decode-audio"
  | "decode-video"
  | "encode-text"
  | "encode-hex"
  | "encode-file";

export interface Base64ToolConfig {
  id: string;
  mode: Base64ToolMode;
  inputLabel: string;
  inputPlaceholder?: string;
  defaultMimeType?: string;
  accept?: string;
  maxFileBytes?: number;
  outputFileName?: string;
  securityNotice?: string;
  showDataUri?: boolean;
  uppercaseOption?: boolean;
}

const MB = 1024 * 1024;

export const base64ToolConfigs: Record<string, Base64ToolConfig> = {
  "base64-para-ascii": {
    id: "base64-para-ascii",
    mode: "decode-ascii",
    inputLabel: "Base64",
    inputPlaceholder: "QWxpbHU=",
  },
  "base64-para-audio": {
    id: "base64-para-audio",
    mode: "decode-audio",
    inputLabel: "Base64 ou Data URI de áudio",
    defaultMimeType: "audio/mpeg",
    outputFileName: "audio-convertido",
  },
  "basic-auth-decode": {
    id: "basic-auth-decode",
    mode: "decode-basic-auth",
    inputLabel: "Cabeçalho Basic Auth",
    inputPlaceholder: "Basic dXNlcjpwYXNzd29yZA==",
    securityNotice: "Não use senhas reais ou credenciais sensíveis em computadores públicos.",
  },
  "base64-para-arquivo": {
    id: "base64-para-arquivo",
    mode: "decode-file",
    inputLabel: "Base64 ou Data URI do arquivo",
    defaultMimeType: "application/octet-stream",
    outputFileName: "arquivo-convertido",
  },
  "base64-para-hex": {
    id: "base64-para-hex",
    mode: "decode-hex",
    inputLabel: "Base64",
    uppercaseOption: true,
  },
  "base64-para-imagem": {
    id: "base64-para-imagem",
    mode: "decode-image",
    inputLabel: "Base64 ou Data URI da imagem",
    defaultMimeType: "image/png",
    outputFileName: "imagem-convertida",
  },
  "base64-para-pdf": {
    id: "base64-para-pdf",
    mode: "decode-pdf",
    inputLabel: "Base64 ou Data URI do PDF",
    defaultMimeType: "application/pdf",
    outputFileName: "documento-convertido.pdf",
  },
  "base64-para-texto": {
    id: "base64-para-texto",
    mode: "decode-text",
    inputLabel: "Base64",
    inputPlaceholder: "U8OjbyBKb3PDqSBkb3MgQ2FtcG9z",
  },
  "base64-para-video": {
    id: "base64-para-video",
    mode: "decode-video",
    inputLabel: "Base64 ou Data URI de vídeo",
    defaultMimeType: "video/mp4",
    outputFileName: "video-convertido",
  },
  "audio-para-base64": {
    id: "audio-para-base64",
    mode: "encode-file",
    inputLabel: "Arquivo de áudio",
    accept: "audio/*",
    maxFileBytes: 50 * MB,
    showDataUri: true,
  },
  "css-para-base64": {
    id: "css-para-base64",
    mode: "encode-text",
    inputLabel: "CSS",
    inputPlaceholder: "body { color: #111827; }",
    defaultMimeType: "text/css",
    showDataUri: true,
  },
  "arquivo-para-base64": {
    id: "arquivo-para-base64",
    mode: "encode-file",
    inputLabel: "Arquivo",
    maxFileBytes: 100 * MB,
    showDataUri: true,
  },
  "hex-para-base64": {
    id: "hex-para-base64",
    mode: "encode-hex",
    inputLabel: "Hexadecimal",
    inputPlaceholder: "416c696c75",
  },
  "html-para-base64": {
    id: "html-para-base64",
    mode: "encode-text",
    inputLabel: "HTML",
    inputPlaceholder: "<h1>Alilu</h1>",
    defaultMimeType: "text/html",
    showDataUri: true,
  },
  "imagem-para-base64": {
    id: "imagem-para-base64",
    mode: "encode-file",
    inputLabel: "Imagem",
    accept: "image/png,image/jpeg,image/gif,image/webp,image/svg+xml",
    maxFileBytes: 20 * MB,
    showDataUri: true,
  },
  "pdf-para-base64": {
    id: "pdf-para-base64",
    mode: "encode-file",
    inputLabel: "PDF",
    accept: "application/pdf,.pdf",
    maxFileBytes: 50 * MB,
    showDataUri: true,
  },
  "texto-para-base64": {
    id: "texto-para-base64",
    mode: "encode-text",
    inputLabel: "Texto",
    inputPlaceholder: "Olá, mundo!",
    defaultMimeType: "text/plain;charset=utf-8",
  },
  "url-para-base64": {
    id: "url-para-base64",
    mode: "encode-text",
    inputLabel: "Texto da URL",
    inputPlaceholder: "https://alilu.com.br",
    defaultMimeType: "text/plain;charset=utf-8",
  },
  "video-para-base64": {
    id: "video-para-base64",
    mode: "encode-file",
    inputLabel: "Vídeo",
    accept: "video/mp4,video/webm,video/ogg",
    maxFileBytes: 100 * MB,
    showDataUri: true,
  },
};
