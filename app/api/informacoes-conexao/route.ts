/**
 * Route Handler de informações de conexão — usado pelas ferramentas "Meu
 * IP", "Meu Navegador" e "Meu Sistema Operacional" (categoria Rede e
 * Internet).
 *
 * Primeira API route do projeto. Deliberadamente NÃO usa nenhum serviço
 * externo: lê apenas os headers da própria requisição, usando
 * infraestrutura nativa do Next.js.
 *
 * - IP: lido do header `x-forwarded-for` (padrão em proxies/CDNs, incluindo
 *   a Vercel) e, como alternativa, `x-real-ip`. Nada é persistido — a
 *   resposta é calculada a cada requisição e não passa por nenhum banco de
 *   dados, log ou serviço de analytics.
 * - Navegador / engine / SO / dispositivo: o helper `userAgent()` nativo do
 *   `next/server` faz o parse do header `User-Agent` da própria
 *   requisição. Nenhuma técnica de fingerprinting invasivo (canvas, fontes,
 *   plugins, etc.) é usada — apenas o que o próprio navegador já declara.
 *
 * Observações importantes (documentadas para as ferramentas exibirem os
 * devidos avisos ao usuário):
 * - `x-forwarded-for` só é preenchido quando a requisição passa por um
 *   proxy/CDN que define esse header (é o caso da Vercel em produção). Em
 *   ambiente local sem proxy, o IP pode vir como `null`.
 * - Navegadores modernos podem reduzir ou "congelar" o User-Agent (User-Agent
 *   Reduction), então nome/versão podem não refletir 100% a versão real.
 */

import { headers } from "next/headers";
import { NextResponse, userAgent } from "next/server";

export interface ConnectionInfo {
  ip: string | null;
  ipVersion: "IPv4" | "IPv6" | null;
  isBot: boolean;
  userAgentString: string;
  language: string | null;
  browser: {
    name: string | null;
    version: string | null;
  };
  engine: {
    name: string | null;
    version: string | null;
  };
  os: {
    name: string | null;
    version: string | null;
  };
  device: {
    type: string | null;
    vendor: string | null;
    model: string | null;
  };
  cpu: {
    architecture: string | null;
  };
}

function extractIp(headersList: Awaited<ReturnType<typeof headers>>): string | null {
  const forwardedFor = headersList.get("x-forwarded-for");
  if (forwardedFor) {
    // x-forwarded-for pode conter uma lista "cliente, proxy1, proxy2" —
    // o primeiro endereço é o do cliente original.
    const first = forwardedFor.split(",")[0]?.trim();
    if (first) return first;
  }

  const realIp = headersList.get("x-real-ip");
  if (realIp) return realIp.trim();

  return null;
}

function detectIpVersion(ip: string | null): "IPv4" | "IPv6" | null {
  if (!ip) return null;
  return ip.includes(":") ? "IPv6" : "IPv4";
}

export async function GET() {
  const headersList = await headers();

  const ip = extractIp(headersList);
  const { browser, device, engine, os, cpu, isBot, ua } = userAgent({
    headers: headersList,
  });
  const language = headersList.get("accept-language")?.split(",")[0]?.trim() ?? null;

  const payload: ConnectionInfo = {
    ip,
    ipVersion: detectIpVersion(ip),
    isBot,
    userAgentString: ua,
    language,
    browser: {
      name: browser.name ?? null,
      version: browser.version ?? null,
    },
    engine: {
      name: engine.name ?? null,
      version: engine.version ?? null,
    },
    os: {
      name: os.name ?? null,
      version: os.version ?? null,
    },
    device: {
      type: device.type ?? null,
      vendor: device.vendor ?? null,
      model: device.model ?? null,
    },
    cpu: {
      architecture: cpu.architecture ?? null,
    },
  };

  return NextResponse.json(payload);
}
