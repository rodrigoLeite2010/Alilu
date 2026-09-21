import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Criptografia em repouso para segredos do módulo Instagram (Fase 3,
 * segurança de tokens) — hoje, o access token de cada conta conectada.
 *
 * AES-256-GCM: cifra autenticada (detecta adulteração do texto cifrado),
 * com IV aleatório por chamada. A chave nunca fica no código nem no
 * frontend — só na variável de ambiente INSTAGRAM_TOKEN_ENCRYPTION_KEY,
 * lida apenas por módulos marcados "server-only".
 *
 * Formato armazenado (uma única string, para caber numa coluna text):
 *   base64(iv) + "." + base64(authTag) + "." + base64(ciphertext)
 */

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH_BYTES = 12; // recomendado para GCM
const KEY_LENGTH_BYTES = 32; // AES-256

function loadEncryptionKey(): Buffer {
  const raw = process.env.INSTAGRAM_TOKEN_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "INSTAGRAM_TOKEN_ENCRYPTION_KEY não está configurada. Gere uma chave com " +
        "`node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\"` " +
        "e configure-a como variável de ambiente apenas no servidor (nunca no " +
        "frontend, nunca versionada).",
    );
  }

  const key = Buffer.from(raw, "base64");
  if (key.length !== KEY_LENGTH_BYTES) {
    throw new Error(
      `INSTAGRAM_TOKEN_ENCRYPTION_KEY deve decodificar (base64) para exatamente ` +
        `${KEY_LENGTH_BYTES} bytes; recebeu ${key.length}. Gere uma nova com o comando ` +
        "descrito no comentário deste arquivo.",
    );
  }

  return key;
}

export function encryptSecret(plaintext: string): string {
  const key = loadEncryptionKey();
  const iv = randomBytes(IV_LENGTH_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf-8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [iv.toString("base64"), authTag.toString("base64"), ciphertext.toString("base64")].join(
    ".",
  );
}

export function decryptSecret(payload: string): string {
  const key = loadEncryptionKey();
  const parts = payload.split(".");
  if (parts.length !== 3) {
    throw new Error("Formato inválido de segredo criptografado (esperado 3 partes separadas por '.').");
  }

  const [ivB64, authTagB64, ciphertextB64] = parts;
  const iv = Buffer.from(ivB64, "base64");
  const authTag = Buffer.from(authTagB64, "base64");
  const ciphertext = Buffer.from(ciphertextB64, "base64");

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString("utf-8");
}
