import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

// Garante que cada teste de componente comece com o DOM limpo, evitando
// que elementos de um teste anterior "vazem" para o próximo.
afterEach(() => {
  cleanup();
});
