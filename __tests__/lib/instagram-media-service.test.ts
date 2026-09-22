// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  ALLOWED_MEDIA_CONTENT_TYPES,
  MAX_MEDIA_UPLOAD_BYTES,
  buildMediaPathnamePrefix,
  buildMediaTokenPayload,
  isPathnameAllowedForUser,
  parseMediaTokenPayload,
  sanitizeOriginalFilename,
} from "@/lib/instagram/backend/media-service";

describe("buildMediaPathnamePrefix / isPathnameAllowedForUser", () => {
  it("aceita um pathname dentro da pasta do próprio usuário", () => {
    expect(isPathnameAllowedForUser("instagram-media/user-1/foto.png", "user-1")).toBe(true);
  });

  it("rejeita um pathname na pasta de outro usuário", () => {
    expect(isPathnameAllowedForUser("instagram-media/user-2/foto.png", "user-1")).toBe(false);
  });

  it("rejeita um pathname que tenta sair do próprio diretório", () => {
    expect(isPathnameAllowedForUser("instagram-media/user-1/../user-2/foto.png", "user-1")).toBe(false);
  });

  it("rejeita o prefixo sozinho, sem nome de arquivo depois", () => {
    expect(isPathnameAllowedForUser(buildMediaPathnamePrefix("user-1"), "user-1")).toBe(false);
  });

  it("rejeita quando falta o userId", () => {
    expect(isPathnameAllowedForUser("instagram-media/user-1/foto.png", "")).toBe(false);
  });

  it("rejeita um pathname vazio", () => {
    expect(isPathnameAllowedForUser("", "user-1")).toBe(false);
  });
});

describe("sanitizeOriginalFilename", () => {
  it("mantém um nome de arquivo simples", () => {
    expect(sanitizeOriginalFilename("foto-do-post.png")).toBe("foto-do-post.png");
  });

  it("mantém só o nome do arquivo, descartando qualquer caminho", () => {
    expect(sanitizeOriginalFilename("C:\\Users\\rodrigo\\Desktop\\foto.png")).toBe("foto.png");
    expect(sanitizeOriginalFilename("/etc/passwd")).toBe("passwd");
  });

  it("remove caracteres de controle", () => {
    expect(sanitizeOriginalFilename("foto\u0000.png")).toBe("foto.png");
  });

  it("trunca nomes muito longos", () => {
    const long = `${"a".repeat(300)}.png`;
    const result = sanitizeOriginalFilename(long);
    expect(result).not.toBeNull();
    expect(result!.length).toBe(200);
  });

  it("retorna null para entradas vazias ou ausentes", () => {
    expect(sanitizeOriginalFilename(null)).toBeNull();
    expect(sanitizeOriginalFilename(undefined)).toBeNull();
    expect(sanitizeOriginalFilename("   ")).toBeNull();
    expect(sanitizeOriginalFilename("")).toBeNull();
  });
});

describe("buildMediaTokenPayload / parseMediaTokenPayload", () => {
  it("faz o round-trip completo com clientPayload válido", () => {
    const clientPayload = JSON.stringify({ originalFilename: "foto.png", fileSizeBytes: 12345 });
    const token = buildMediaTokenPayload("user-1", clientPayload);
    const parsed = parseMediaTokenPayload(token);

    expect(parsed).toEqual({ userId: "user-1", originalFilename: "foto.png", fileSizeBytes: 12345 });
  });

  it("ignora um clientPayload malformado, mantendo só o userId", () => {
    const token = buildMediaTokenPayload("user-1", "isso não é json");
    const parsed = parseMediaTokenPayload(token);

    expect(parsed).toEqual({ userId: "user-1", originalFilename: null, fileSizeBytes: null });
  });

  it("ignora um clientPayload nulo", () => {
    const token = buildMediaTokenPayload("user-1", null);
    const parsed = parseMediaTokenPayload(token);

    expect(parsed).toEqual({ userId: "user-1", originalFilename: null, fileSizeBytes: null });
  });

  it("descarta um fileSizeBytes negativo ou não numérico", () => {
    const token = buildMediaTokenPayload(
      "user-1",
      JSON.stringify({ originalFilename: "foto.png", fileSizeBytes: -5 }),
    );
    expect(parseMediaTokenPayload(token)!.fileSizeBytes).toBeNull();
  });

  it("parseMediaTokenPayload retorna null para entradas ausentes, vazias ou sem userId", () => {
    expect(parseMediaTokenPayload(null)).toBeNull();
    expect(parseMediaTokenPayload(undefined)).toBeNull();
    expect(parseMediaTokenPayload("")).toBeNull();
    expect(parseMediaTokenPayload("não é json")).toBeNull();
    expect(parseMediaTokenPayload(JSON.stringify({ originalFilename: "foto.png" }))).toBeNull();
  });
});

describe("constantes exportadas", () => {
  it("permite só os 3 formatos de imagem aceitos pelo editor", () => {
    expect(ALLOWED_MEDIA_CONTENT_TYPES).toEqual(["image/jpeg"]);
  });

  it("usa o mesmo limite de 15 MB do editor local", () => {
    expect(MAX_MEDIA_UPLOAD_BYTES).toBe(15 * 1024 * 1024);
  });
});
