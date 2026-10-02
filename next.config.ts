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
  // Além de @napi-rs/canvas: ffmpeg-static e ffprobe-static (editor de
  // vídeo split-screen) resolvem o caminho do próprio binário nativo em
  // tempo de execução com `path.join(__dirname, "bin", plataforma, ...)`
  // (código-fonte deles, confirmado lendo node_modules/ffprobe-static/
  // index.js e node_modules/ffmpeg-static/index.js) — exatamente o mesmo
  // padrão problemático do @napi-rs/canvas. Sem listar aqui, o
  // Webpack/Turbopack empacota (bundla) o pacote e reescreve esse
  // `__dirname` para um caminho de build que não existe de verdade no
  // ambiente da function na Vercel — foi exatamente essa a causa raiz do
  // erro em produção "spawn /ROOT/.../ffprobe ENOENT" depois do primeiro
  // deploy desta ferramenta (ver relatório da Fase A e o adendo de
  // correção). Listar aqui faz o Next.js usar `require()` normal do
  // Node.js para esses pacotes (sem bundlar/reescrever), deixando o
  // próprio `__dirname` deles resolver certo em runtime.
  serverExternalPackages: ["@napi-rs/canvas", "ffmpeg-static", "ffprobe-static"],

  // ffmpeg-static/ffprobe-static embutem binários nativos fora de
  // node_modules/<pacote>/*.js. Escopado só à rota que realmente usa os
  // binários (nunca globalmente, para não inflar toda função da Vercel
  // com ~144MB de binários que as outras rotas não usam). Só o binário
  // linux/x64 do ffprobe-static entra — é o único que a Vercel roda
  // (Node.js Functions rodam em Linux x64); os binários darwin/win32 do
  // pacote (uso local em dev) ficariam de fora à toa se incluídos aqui.
  // Rede de segurança complementar ao serverExternalPackages acima: o
  // "file tracing" da Vercel (@vercel/nft) decide, por análise estática,
  // quais arquivos de node_modules entram no pacote de deploy de cada
  // rota — os binários nativos destes 2 pacotes ficam fora do node_modules
  // que ele já rastreia, garantindo que entrem mesmo assim.
  //
  // A CHAVE deste objeto é comparada (picomatch, contains:true — ver
  // node_modules/next/dist/build/collect-build-traces.js) contra a rota já
  // normalizada por normalizeAppPath(entryName), que PRESERVA o segmento
  // "app" literal no início para uma API route (confirmado lendo o código
  // fonte do Next.js 16.3.5 instalado: o entryName real de uma route.ts é
  // "app/api/.../route", e normalizeAppPath só remove segmentos de grupo
  // "(nome)", segmentos paralelos "@slot" e o último segmento quando ele é
  // literalmente "page"/"route" — "app" continua no resultado). Por isso
  // NÃO usamos "/api/videos/split-screen" (não bate) nem o entryName cru
  // "app/api/videos/split-screen/route" (o "/route" final já foi removido
  // antes da comparação) — usamos um glob com "**/" na frente, que
  // funciona nesta versão E continuaria funcionando se esse detalhe de
  // normalização mudar numa versão futura do Next.js.
  outputFileTracingIncludes: {
    "**/api/videos/split-screen": [
      "./node_modules/ffmpeg-static/ffmpeg",
      "./node_modules/ffprobe-static/bin/linux/x64/ffprobe",
    ],
    // Fontes embutidas do Piloto Automático (lib/instagram/backend/
    // template-render-service.ts, AUTO_TEMPLATE) — lidas via
    // GlobalFonts.registerFromPath(path.join(process.cwd(), ...)), não
    // via require/import estático, então o "file tracing" da Vercel
    // (@vercel/nft) não as descobre sozinho — mesmo motivo/mesmo padrão
    // já documentado acima para os binários do ffmpeg-static/ffprobe-
    // static. Sem isso, o arquivo .ttf não entra no bundle da function
    // e registerFromPath falha silenciosamente em produção (retorna
    // null, só loga um console.error) — o texto voltaria a não aparecer
    // mesmo com o código correto.
    "**/api/content-automation/media/preview-art": ["./lib/instagram/backend/fonts/*.ttf"],
    "**/api/content-automation/media/preview-carousel-art": ["./lib/instagram/backend/fonts/*.ttf"],
    "**/api/cron/content-automation": ["./lib/instagram/backend/fonts/*.ttf"],
    // Imagem para vídeo com IA: pós-processamento (validação ffprobe +
    // overlays de texto/logo via FFmpeg) roda no cron e nas rotas de
    // geração (consulta da tela e "reportar problema") — mesmo motivo dos
    // binários do split-screen e das fontes acima.
    "**/api/cron/ai-video": [
      "./node_modules/ffmpeg-static/ffmpeg",
      "./node_modules/ffprobe-static/bin/linux/x64/ffprobe",
      "./lib/ai-video/backend/fonts/*.ttf",
    ],
    // Importar do Instagram: validação do arquivo baixado com ffprobe.
    "**/api/videos/instagram-import": ["./node_modules/ffprobe-static/bin/linux/x64/ffprobe"],
    "**/api/ai-video/generations": [
      "./node_modules/ffmpeg-static/ffmpeg",
      "./node_modules/ffprobe-static/bin/linux/x64/ffprobe",
      "./lib/ai-video/backend/fonts/*.ttf",
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
