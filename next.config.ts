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

  // ffmpeg-static (binário de vídeo do editor split-screen — ver
  // lib/videos/backend/video-processing-service.ts) e ffprobe-static (mede
  // duração/faixas reais dos vídeos enviados) embutem binários nativos
  // fora de node_modules/<pacote>/*.js — o "file tracing" do Next.js (que
  // decide quais arquivos entram no bundle de output de CADA rota, para a
  // Vercel não subir o node_modules inteiro) segue só imports estáticos de
  // JS: como esses pacotes resolvem o caminho do binário em runtime (a
  // partir de __dirname/uma tabela de plataforma), o tracer não enxerga o
  // binário como dependência e ele fica de fora do output de produção —
  // resultando em "ENOENT"/binário ausente ao rodar na Vercel, mesmo com
  // tudo funcionando localmente. outputFileTracingIncludes força a
  // inclusão, escopada só à rota que realmente usa os binários (nunca
  // globalmente, para não inflar toda função da Vercel com ~144MB de
  // binários que as outras rotas não usam). Só o binário linux/x64 do
  // ffprobe-static entra — é o único que a Vercel roda (Node.js Functions
  // rodam em Linux x64); os binários darwin/win32 do pacote (uso local em
  // dev) ficariam de fora à toa se incluídos aqui.
  outputFileTracingIncludes: {
    "app/api/videos/split-screen/route": [
      "./node_modules/ffmpeg-static/ffmpeg",
      "./node_modules/ffprobe-static/bin/linux/x64/ffprobe",
    ],
  },

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
