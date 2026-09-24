import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */

  // @napi-rs/canvas (renderização server-side de imagem do Piloto
  // Automático — AUTO_TEMPLATE, ver lib/instagram/backend/template-render-
  // service.ts) embute um binário nativo (.node) carregado via
  // js-binding.js. Bundlers de JS (Turbopack/Webpack) não sabem empacotar
  // um binário nativo como módulo ESM — sem isso, o build falha com
  // "non-ecmascript placeable asset". serverExternalPackages diz ao
  // Next.js pra não tentar empacotar esse pacote nas rotas de servidor;
  // ele é resolvido via require() normal do node_modules em runtime.
  serverExternalPackages: ["@napi-rs/canvas"],

  async redirects() {
    return [
      // A ferramenta "Simulador de Financiamento SAC x Price" já teve o
      // slug "sac-x-price" no catálogo (ver nota em data/tools.ts) antes de
      // ser publicada na URL canônica atual, /utilitarios/financeiro/
      // financiamento-sac-price. Redirect permanente para não deixar a URL
      // antiga como 404 e para não duplicar conteúdo indexável (a URL nova
      // continua sendo a única canonical/indexável).
      {
        source: "/utilitarios/financeiro/sac-x-price",
        destination: "/utilitarios/financeiro/financiamento-sac-price",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
