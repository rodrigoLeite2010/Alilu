import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */

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
