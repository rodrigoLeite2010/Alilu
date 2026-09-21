import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

// Garante que cada teste de componente comece com o DOM limpo, evitando
// que elementos de um teste anterior "vazem" para o próximo.
afterEach(() => {
  cleanup();
});

// O pacote "server-only" existe para travar em tempo de BUILD (via o
// bundler do Next.js, que entende a condição de export "react-server")
// que nenhum componente cliente importe um módulo marcado com ele. Fora do
// Next (aqui no Vitest/Vite puro), a resolução cai no stub de navegador do
// pacote, que lança erro sempre — mesmo em teste de módulo server-only
// legítimo. Neutralizamos isso globalmente: o Next continua aplicando a
// checagem de verdade no build real; aqui só permitimos importar módulos
// "server-only" (lib/db/client.ts, lib/instagram/backend/*) nos testes.
vi.mock("server-only", () => ({}));
