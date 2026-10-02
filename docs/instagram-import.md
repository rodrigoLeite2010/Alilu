# Vídeos › Importar do Instagram

O usuário cola o link de um Reel, vídeo (`/tv/`) ou post **público** do Instagram. O Alilu mostra a prévia e, se o usuário confirmar, importa o arquivo para o storage do Alilu. De lá, o arquivo pode ir para **o Split-Screen**, para **o Reels** ou ser **baixado**. A experiência foi inspirada no SaveClip, mas nenhum código, layout ou mecanismo dele foi copiado e nenhum site de *downloader* é usado como backend.

## Regras (inegociáveis)

- **Só conteúdo público.** Nada de login no Instagram, cookie, senha, token pessoal, sessão do usuário, perfil privado, Selenium/Playwright ou endpoint privado.
- **Declaração obrigatória** ("o conteúdo é meu ou tenho autorização"). A data fica gravada em `authorized_at`.
- **Aviso fixo na tela:** "Utilize apenas conteúdo próprio ou para o qual você tenha autorização."
- **Risco conhecido:** o provedor (Apify) obtém o conteúdo público do Instagram sem login. Nos EUA, *Meta v. Bright Data* (2024) entendeu que raspar dados públicos sem login não viola os termos da Meta. Ainda assim, a responsabilidade por direitos autorais (no Brasil, a Lei 9.610) é de quem usa o conteúdo. Por isso existem a declaração e o aviso, e o fluxo fica restrito a conteúdo próprio ou autorizado.

## Arquitetura

```
Tela (components/instagram-import/InstagramImporter.tsx)
  │ POST /api/videos/instagram-import/resolve { url, authorized, force? }
  ▼
import-service.ts → url.ts (valida/normaliza) → duplicidade → limite diário
                  → InstagramMediaImportProvider.resolve()  (providers/, hoje Apify)
                  → status READY + itens (URLs temporárias ficam SÓ no servidor)
  │ GET  …/[id]/thumbnail?item=N   (miniatura via proxy seguro do Alilu)
  │ POST …/[id]/import { itemIndex }
  ▼
safe-download.ts (SSRF + tipo + tamanho + tempo) → media-probe.ts (ffprobe / decodificação)
  → Vercel Blob videos/imports/{userId}/… → COMPLETED (URLs do provedor descartadas)
  ▼
?importacao=<id> → Split-Screen (vídeo principal) | Reels (vídeo do post) | Baixar
```

### Provedor

A interface é `InstagramMediaImportProvider` (`lib/instagram-import/backend/providers/provider.ts`). Para trocar de fornecedor, basta uma nova implementação registrada em `provider-registry.ts`. O provedor atual é **Apify, "Instagram Downloader API"** (`snapinsta~instagram-downloader-api`):

- endpoint `POST https://api.apify.com/v2/acts/{actor}/run-sync-get-dataset-items`, com `Authorization: Bearer $APIFY_TOKEN`;
- entrada `{ "url": "…" }`;
- saída `[{ status, media: [{ url, thumbnail, fileType }], requestId }]` ou `[{ status: false, error: { code, message } }]`;
- preço de US$ 0,43 a 1,20 por 1.000 pedidos, cobrado por URL válida;
- só conteúdo público, um link por execução;
- o Actor pode ser trocado por `APIFY_INSTAGRAM_ACTOR`, desde que tenha a mesma entrada e saída.

Como os erros do provedor são tratados:

| Erro do provedor | Status | Mensagem |
|---|---|---|
| `INVALID_INSTAGRAM_URL` | `INVALID_URL` | "Esse link do Instagram não foi reconhecido." |
| privado / login / restrito | `PRIVATE_CONTENT` | "Esse conteúdo não está disponível publicamente." |
| não encontrado / apagado | `PRIVATE_CONTENT` (código `NOT_FOUND`) | mesma acima |
| não suportado | `UNSUPPORTED` | "Esse formato ainda não é suportado." |
| HTTP 402/401/5xx, rede, timeout | `FAILED` | "Não conseguimos importar agora. Tente novamente ou faça upload manual." |

### Links aceitos (`lib/instagram-import/url.ts`)

- Domínios: só `instagram.com` e `www.instagram.com`; `http` é normalizado para `https`.
- Caminhos: `/reel/`, `/reels/`, `/p/` e `/tv/`, com ou sem `/{perfil}/` antes.
- Query string (`igsh`, `utm_*`), fragmento, usuário/senha na URL e portas são descartados ou recusados.
- **Ainda não suportados:** Stories, perfis e encurtadores (`instagr.am`, `l.instagram.com`).

### Segurança do download (`safe-download.ts`)

- Só `http` e `https`, nas portas 80 e 443, sem credenciais na URL.
- O IP é verificado **no momento da conexão** (`lookup` próprio do socket, o que resiste a DNS rebinding). Ficam bloqueados:
  - loopback;
  - redes privadas (10/8, 172.16/12, 192.168/16);
  - link-local 169.254/16, que inclui os metadados de nuvem;
  - CGNAT 100.64/10, multicast e faixas reservadas;
  - IPv6 `::1`, ULA `fc00::/7`, `fe80::/10`, IPv4 mapeado em IPv6 e NAT64;
  - nomes `localhost`, `*.internal` e `*.local`.
- Redirecionamentos: no máximo 3, cada um revalidado.
- `Content-Type` permitido: MP4/MOV para vídeo, JPEG/PNG/WebP para imagem, e `application/octet-stream`, que é validado depois pelo conteúdo.
- Tamanho máximo checado no cabeçalho **e** durante o streaming; o download é cortado se passar.
- Limite de tempo, e detecção de download interrompido (corpo incompleto).

### Validação do arquivo (`media-probe.ts`)

Nunca pela extensão:

- **Vídeo**, com `ffprobe`: precisa ter trilha de vídeo; codec h264, hevc, vp9, av1 ou mpeg4; duração maior que 0 e até o limite; resolução; presença de áudio.
- **Imagem**: decodificação real, para obter as dimensões.

### Banco (`0022_instagram_media_imports.sql`)

- **`instagram_media_imports`** guarda:
  - URLs original e normalizada, tipo do link, shortcode, status, provedor e request id;
  - itens resolvidos (temporários; apagados ao concluir), tipo de mídia e miniatura;
  - URL e caminho do arquivo no Blob, `content_type`, tamanho, duração, largura, altura, codec e áudio;
  - custo do provedor, erro, `authorized_at`, `execution_ms` e datas.
- **Status:** `PENDING`, `RESOLVING`, `READY`, `IMPORTING`, `COMPLETED`, `FAILED`, `UNSUPPORTED`, `PRIVATE_CONTENT` e `INVALID_URL`.
- **`instagram_import_settings`** (editável em `/admin/instagram-import`):

| Configuração | Padrão |
|---|---|
| `max_imports_per_day` | 20 |
| `max_imported_video_size_mb` | 100 |
| `max_imported_duration_minutes` | 10 |
| `provider_cost_usd` | 0,0012 por consulta (só registro, **não cobra créditos**) |

### Comportamentos

- **Duplicidade:** se o link já foi importado, a tela mostra "Este conteúdo já foi importado." com as opções **Abrir existente** e **Importar novamente** (`force`).
- **Clique duplo em "Importar para o Alilu":** a transição atômica `READY` → `IMPORTING` garante que o arquivo seja baixado uma vez só.
- **Upload manual (fallback):** aparece quando a importação falha. O arquivo vai direto do navegador para `videos/imports/{userId}/manual/`, e o servidor valida com ffprobe e registra com o provedor `manual`. Depois seguem as mesmas 3 opções.
- **Histórico:** `/videos/importacoes-instagram`, com miniatura, data, tipo, status, origem e as ações Split-Screen, Reels, Baixar e Excluir. Excluir apaga também o arquivo.
- **Observabilidade:** cada evento gera um log JSON (`scope: "instagram-import"`) com importId, userId, provedor, tipo de mídia, duração, bytes, tempo de execução, status e código de erro. Não registra URLs com token nem conteúdo.

## Configuração

1. `npm run db:migrate` (migração `0022`).
2. Em **Apify**, crie a conta, vá em *Settings → API & Integrations*, copie o token e configure `APIFY_TOKEN` na Vercel. Adicione saldo ou escolha um plano. Opcional: `APIFY_INSTAGRAM_ACTOR`.
3. Deploy. O `next.config.ts` inclui o ffprobe na rota `**/api/videos/instagram-import`.

## Testes

| Arquivo | Cobre |
|---|---|
| `__tests__/lib/instagram-import-url-provider.test.ts` | Links aceitos e recusados (outro domínio, porta, credenciais, Stories, perfil) e o provedor Apify (token no cabeçalho, vídeo, imagem, carrossel, erros, HTTP 402/503, rede, sem token). |
| `__tests__/lib/instagram-import-safe-download.test.ts` | IPs bloqueados, URLs bloqueadas, DNS interno, arquivo grande demais (declarado e em streaming), tipo errado, download interrompido, redirecionamento para 169.254.169.254, link expirado (403), servidor local recusado em produção. |
| `__tests__/lib/instagram-import-service.test.ts` | Declaração obrigatória, Reel válido, URL inválida e de outro domínio, privado, removido, não suportado, provedor fora do ar, limite diário, importação de vídeo (ffprobe real) e de imagem, arquivo grande, vídeo inválido, vídeo longo, download interrompido, SSRF, clique duplo, acesso de outro usuário, duplicidade, exclusão e upload manual. |
