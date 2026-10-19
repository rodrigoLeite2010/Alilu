# Relatório — Vídeos › Importar do YouTube

Data: 18/10/2026 · Branch: `main` (alterações **não commitadas**, sem deploy, sem migração aplicada em nenhum banco).

## Resumo

A nova tela **Vídeos › Importar YouTube** (`/videos/importar-youtube`) faz três coisas:

1. **Consulta os dados públicos** do vídeo pelo link, usando só a API oficial: título, canal, miniatura, duração, tipo (vídeo, Short ou live) e situação.
2. **Mostra a prévia** no player oficial incorporado (`youtube-nocookie.com`, que só carrega quando a pessoa clica).
3. **Recebe o arquivo original** que o usuário tem direito de usar. O arquivo é validado no servidor e só então vai para o **Split-Screen** ou para o **Reels**, pelo mesmo caminho dos vídeos enviados normalmente.

A Alilu **nunca baixa o arquivo do YouTube**: não há scraping, extração de stream, contorno de assinatura ou DRM, nem dependência de downloader. A tela só diz "Importação concluída" depois que o servidor confirma que o arquivo existe, foi validado com ffprobe e está gravado.

---

## 1. Arquitetura identificada

| Item | O que existe no projeto |
|---|---|
| Stack | Next.js 16.3 (App Router, `params` assíncrono), React 19, TypeScript, Tailwind 4, Vitest 5 com PGlite (Postgres em memória) |
| Autenticação | NextAuth v5 (`auth.ts`); administrador definido por `ADMIN_EMAILS` (`lib/admin/admin-access.ts`) |
| Banco | Neon/Postgres via `@neondatabase/serverless` (`lib/db/client.ts`); migrações SQL em `db/migrations`, aplicadas com `npm run db:migrate` |
| Armazenamento | Vercel Blob, com upload direto do navegador por token pré-assinado (`handleUploadPresigned` / `uploadPresigned`) |
| Processamento | FFmpeg/ffprobe estáticos (`ffmpeg-static`, `ffprobe-static`) dentro das functions; binários incluídos via `outputFileTracingIncludes` em `next.config.ts` |
| Página de Vídeos | `app/videos/page.tsx`; catálogo em `data/videos.ts` |
| Editor Split-Screen | `components/videos/VideoSplitScreenEditor.tsx` + `app/api/videos/split-screen` (entrada até 100 MB, saída até 150 s, `maxDuration` de 200 s) |
| Upload do editor | `app/api/videos/upload` (prefixo `videos/uploads/`, apagado depois do processamento) |
| Miniaturas | Para o Instagram, proxy próprio (`[id]/thumbnail`). No YouTube usamos a miniatura oficial `i.ytimg.com`, que vem da API |
| Limites e créditos | O importador do Instagram é exclusivo dos planos pagos (`canUseImporter`) e tem cota diária. Limites de tamanho e duração ficam em `instagram_import_settings` e são editáveis em `/admin/instagram-import` |
| Limpeza | `lib/storage-cleanup` (cron `storage-cleanup`): retenção de importações e apagamento de arquivos órfãos, com modo simulação |
| Observabilidade | Logs JSON com `scope`, sem URLs com token |

## 2. Como funciona a importação do Instagram

1. O usuário cola o link (`lib/instagram-import/url.ts`) e marca a declaração de autorização.
2. `POST /resolve` passa por checagem de plano pago, duplicidade, cota diária e pelo provedor **Apify**, que resolve conteúdo público. O registro fica em `instagram_media_imports` com status `READY` e as URLs temporárias guardadas só no servidor.
3. `POST /[id]/import` baixa o arquivo com `safe-download.ts` (proteção contra SSRF e DNS rebinding, além de checagem de tipo, tamanho e tempo), valida com `media-probe.ts` (ffprobe) e grava no Blob em `videos/imports/{userId}/…`. O status vira `COMPLETED`.
4. Se a importação falhar, o usuário pode enviar o arquivo manualmente para `videos/imports/{userId}/manual/`.
5. O vídeo chega ao editor por `?importacao=<id>`: `imported-media-client.ts` busca o registro e entrega um `File` ao Split-Screen ou ao Reels.
6. O armazenamento é **temporário**: a limpeza apaga o arquivo depois de `instagram_import_days` (padrão de 7 dias) e marca a importação como `EXPIRED`.

## 3. Solução escolhida para o YouTube

A API pública do YouTube **não oferece download** do arquivo, e as *YouTube API Services Developer Policies* proíbem baixar, armazenar ou fazer cache do conteúdo audiovisual (III.E.1), além de separar ou modificar o áudio e o vídeo (III.I.7). Por isso o fluxo separa as etapas:

| Etapa | Implementação |
|---|---|
| 1. Metadados por URL | **YouTube Data API v3** `videos.list` (`part=snippet,contentDetails,status`, custa 1 unidade). Sem chave, usa o **oEmbed oficial** (título, canal e miniatura, sem duração) |
| 2. Pré-visualização | iframe `https://www.youtube-nocookie.com/embed/{id}`, carregado só depois do clique. Não aparece se o dono desativou a incorporação |
| 3. Importação autorizada do arquivo | **Não existe pelo YouTube.** A tela explica isso e não simula sucesso |
| 4. Envio do original pelo usuário | Upload direto navegador → Blob para `videos/imports/{userId}/youtube/{importId}/`, seguido de validação no servidor |
| 5. Edição | Só o arquivo enviado e validado. Abre com `?youtube=<id>` no Split-Screen ou no Reels |

A tela orienta o usuário: se o vídeo é dele, baixar pelo **YouTube Studio** (*Conteúdo › ⋮ › Baixar*); se é de terceiros, pedir o arquivo e a autorização por escrito ao titular dos direitos.

**Situação do vídeo:**

| Situação | Como é detectada |
|---|---|
| `AVAILABLE` | Vídeo encontrado e público |
| `PRIVATE` | A Data API devolve lista vazia e o oEmbed responde 401/403. Também cobre vídeos com a incorporação desativada |
| `NOT_FOUND` | A Data API devolve lista vazia e o oEmbed responde 404, ou `uploadStatus=deleted` |
| `UNAVAILABLE` | `uploadStatus` rejected/failed |
| `AGE_RESTRICTED` | `ytRating=ytAgeRestricted` |
| `LIVE_NOW` / `UPCOMING` | Campo `liveBroadcastContent` |
| `UNKNOWN` | Falha de cota, chave ou rede. O usuário vê um aviso claro e ainda pode enviar o original |

A restrição de região no Brasil aparece como aviso, sem bloquear o uso.

## 4. Arquivos criados e alterados

**Criados**

- `lib/youtube-import/url.ts`: validação e normalização dos links (módulo puro).
- `lib/youtube-import/types.ts`: tipos, mensagens, DTO e utilitários de duração.
- `lib/youtube-import/backend/youtube-api.ts`: cliente da Data API v3 e do oEmbed, mapeamento dos erros e sanitização.
- `lib/youtube-import/backend/import-repository.ts`: SQL.
- `lib/youtube-import/backend/import-service.ts`: regras de negócio (limites, cache, registro e validação do upload, exclusão).
- `lib/youtube-import/backend/import-dto.ts` e `route-helpers.ts`.
- `app/api/videos/youtube-import/analyze/route.ts`, `upload/route.ts`, `[id]/route.ts` e `[id]/file/route.ts`.
- `app/videos/importar-youtube/page.tsx` e `components/youtube-import/YoutubeImporter.tsx`.
- `db/migrations/0044_youtube_video_imports.sql`.
- Testes:
  - `__tests__/lib/youtube-import-url.test.ts`
  - `youtube-import-api.test.ts`
  - `youtube-import-service.test.ts`
  - `youtube-import-routes.test.ts`
  - `youtube-import-cleanup.test.ts`
  - `__tests__/components/YoutubeImporter.test.tsx`
- Este relatório.

**Alterados** (só acréscimos pontuais)

- `data/videos.ts`: nova ferramenta `importar-youtube`, `indexable: false`, fora do sitemap.
- `app/videos/page.tsx`: FAQ sobre login e plano.
- `components/ui/Icon.tsx`: ícone `youtube` (`MonitorPlay`).
- `components/instagram-import/imported-media-client.ts`: `loadYoutubeImportedVideoFile`, `youtubeImportIdFromLocation` e `loadImportedVideoFromLocation`.
- `components/videos/VideoSplitScreenEditor.tsx` e `components/instagram/ReelsComposer.tsx`: aceitam `?youtube=<id>` além de `?importacao=<id>`. O Reels recusa WEBM com uma mensagem.
- `lib/storage-cleanup/backend/cleanup-service.ts`: regra `youtube_imports_expired`, os uploads do YouTube passam a contar como referência na regra de órfãos, e `purgeStaleYoutubeMetadata` aplica o prazo de 30 dias.
- `components/storage-cleanup/StorageCleanupAdmin.tsx`: rótulo da nova regra.
- `lib/client/upload-telemetry.ts`: ferramenta `youtube-import`.
- `next.config.ts`: inclui o ffprobe na rota `**/api/videos/youtube-import`.
- `.env.example`: novas variáveis.

## 5. Endpoints

Todos exigem login (401 sem sessão) e só operam sobre registros do próprio usuário (404 para registros de outros).

| Método | Rota | Função |
|---|---|---|
| POST | `/api/videos/youtube-import/analyze` | Corpo `{ url, authorized: true, force? }`. Valida o link, aplica os limites, consulta a API e cria o registro `ANALYZED`. Devolve `{ import, duplicate, quota }` |
| POST | `/api/videos/youtube-import/upload` | Emite o token de upload direto. Só vale para `videos/imports/{userId}/youtube/{importId}/{arquivo}` de uma importação do usuário ainda sem arquivo, só aceita MP4/MOV/WEBM, respeita o limite de tamanho do admin e expira em 10 min |
| POST | `/api/videos/youtube-import/{id}/file` | Corpo `{ blobUrl, authorized: true }`. Faz `head()` no store da Alilu, confere tipo, tamanho e ffprobe (codec, duração, resolução, áudio) e marca `COMPLETED` |
| GET | `/api/videos/youtube-import/{id}` | Uma importação, usada pelo editor e pelo Reels |
| DELETE | `/api/videos/youtube-import/{id}` | Apaga o registro e o arquivo |

## 6. Componentes de interface

`YoutubeImporter` segue o padrão visual do importador do Instagram (teal, `Button`/`LinkButton`/`Badge`, cartões `rounded-lg border`) e tem:

- campo de link com validação imediata e declaração obrigatória;
- botão **Analisar vídeo**, com contador de consultas do dia;
- cartão com miniatura, título, canal, tipo, duração, selo de situação, explicação, avisos de cota/chave/rede, restrição de região e link "Abrir no YouTube";
- player oficial que carrega só depois do clique (proporção 9:16 para Shorts);
- bloco "Como usar este vídeo na Alilu" (o que é permitido e o que não é), com instruções do YouTube Studio;
- **Enviar arquivo original**, com progresso, depois "Validando o vídeo…" e por fim a tela de conclusão;
- tela de conclusão com player do arquivo, aviso se a duração for diferente da do YouTube (mais de 5 s ou 5%) e as ações *Editar no Split-Screen*, *Publicar no Reels*, *Baixar meu arquivo* e *Importar outro*;
- histórico "Seus vídeos enviados", com opção de excluir;
- links para os Termos do YouTube, a Política de Privacidade do Google e a Política da Alilu;
- layout responsivo (campo com `min-h-11` e botão principal em largura total no celular).

## 7. Integração com o editor

Não foi criado um editor paralelo. `loadImportedVideoFromLocation()` busca a importação, baixa o arquivo **do Blob da Alilu** e entrega um `File` igual ao do seletor de arquivos:

- o Split-Screen coloca o vídeo como principal;
- o Reels o usa como vídeo do post.

Daí em diante valem as validações e limites de cada ferramenta: o Split-Screen aceita até 100 MB por entrada e 150 s de saída (corte, loop, proporções 9:16, 1:1 e 16:9, áudio, enquadramento); o Reels aceita MP4 ou MOV.

## 8. Configurações necessárias

1. **Migração:** `npm run db:migrate` aplica a `0044`, que é aditiva (cria só `youtube_video_imports` e `youtube_import_usage`). **Não foi executada em nenhum banco.**
2. **Chave da API** (recomendada; sem ela a consulta funciona em modo básico via oEmbed, sem duração):
   1. No **Google Cloud Console**, crie ou escolha um projeto.
   2. Em *APIs e serviços › Biblioteca*, habilite a **YouTube Data API v3**.
   3. Em *APIs e serviços › Credenciais › Criar credenciais › Chave de API*, gere a chave.
   4. **Restrinja a chave:** em *Restrições de API*, deixe só a "YouTube Data API v3". Em *Restrições de aplicativo*, use "Nenhum": a chamada sai do servidor da Vercel, que não tem IP fixo, e a restrição por referenciador HTTP quebraria a chamada de servidor. Nunca use a chave no navegador.
   5. Na Vercel, abra *Project › Settings › Environment Variables*, crie `YOUTUBE_API_KEY` para Production e Preview e faça um novo deploy.
   6. **Para testar sem expor a chave:** abra `/videos/importar-youtube` logado, cole um link público e veja se aparece a duração (só a Data API informa a duração). Nos logs da Vercel, procure `scope:"youtube-import"`: `event:"analyzed"` com `source:"data_api"` confirma o uso da chave. Se aparecer `metadata_failed` com `errorCode:"API_AUTH_FAILED"`, a chave é inválida, está restrita ou a API não foi habilitada. A chave não aparece em URL, log nem resposta.
3. **Cota:** o padrão é 10.000 unidades por dia por projeto, e cada análise custa 1 unidade. Um cache de 10 minutos evita gastar cota com o mesmo vídeo. Para aumentar a cota, o Google exige o *quota extension / compliance audit*.

## 9. Variáveis de ambiente

| Variável | Obrigatória | Padrão | Uso |
|---|---|---|---|
| `YOUTUBE_API_KEY` | Não (recomendada) | vazio, usa oEmbed | Data API v3, só no servidor |
| `YOUTUBE_IMPORT_MAX_ANALYSES_PER_DAY` | Não | 50 | Consultas por usuário por dia (dia de São Paulo). Admin não tem limite |
| `YOUTUBE_IMPORT_MAX_ANALYSES_PER_MINUTE` | Não | 10 | Limite de rajada |
| `YOUTUBE_IMPORT_REQUIRES_PAID_PLAN` | Não | desligado | Com `true`, exige plano pago (mesma regra do Instagram) |

Tamanho e duração máximos do arquivo **reaproveitam** `instagram_import_settings` (100 MB e 10 min, editáveis em `/admin/instagram-import`). Os prazos de retenção seguem `storage_cleanup_settings.instagram_import_days`.

## 10. Dependências adicionadas

**Nenhuma.** O recurso usa só `@vercel/blob`, `ffprobe-static`, `lucide-react` e `fetch`, que já estavam no projeto.

## 11. Limitações da API oficial

- Não há download nem stream do arquivo. A importação depende do arquivo enviado pelo usuário.
- Com chave de API, vídeos privados e removidos voltam iguais (`items: []`). A distinção é feita pelo oEmbed (401 = privado ou incorporação desativada, 404 = não existe), o que é uma heurística.
- Sem OAuth não é possível **provar a posse** do vídeo. Hoje a garantia é a declaração do usuário (registrada em `authorized_at`) somada ao fato de que só ele tem o arquivo original.
- O oEmbed não informa duração, situação de live nem restrição de idade.
- Os metadados podem ser guardados por no máximo 30 dias (III.E.4). `purgeStaleYoutubeMetadata` apaga título, canal, miniatura, duração, situação e flags depois desse prazo, em toda execução da limpeza (mesmo com ela desligada ou em modo simulação). Isso só altera o banco.

## 12. Requisitos de autorização dos vídeos

- A declaração "o vídeo é meu ou tenho autorização do titular" é obrigatória na análise **e** no envio. O servidor confere; não basta a tela.
- O usuário deve usar só o próprio vídeo (por exemplo, baixado do YouTube Studio) ou material com licença ou autorização por escrito. A responsabilidade por direitos autorais (Lei 9.610/98) é de quem publica.
- A Alilu não deve oferecer, nem por texto, caminhos para baixar vídeos de terceiros.

## 13. Custos potenciais

| Item | Custo |
|---|---|
| YouTube Data API | Gratuita dentro da cota. Não há custo recorrente novo |
| Vercel Blob | Armazenamento e tráfego dos arquivos enviados (até 100 MB cada). Ficam no máximo `instagram_import_days` (padrão de 7 dias) e depois a limpeza apaga. Uploads nunca registrados são apagados após a carência de órfãos (padrão de 24 h) |
| Functions | `file` (até 120 s) lê o arquivo inteiro na memória para o ffprobe, como no upload manual do Instagram. Com o limite atual de 100 MB isso cabe na memória da function |
| Serviço externo pago | Nenhum foi introduzido |

## 14. Testes executados e resultados

Os testes rodaram no Linux, com uma cópia isolada do projeto e `node_modules` Linux, e a suíte completa foi rodada também no Windows do projeto (ver a seção 18).

| Arquivo | Testes | Cobre |
|---|---|---|
| `youtube-import-url.test.ts` | 37 | Link normal, curto (`youtu.be`), Shorts, live, embed, nocookie; recusa de domínios falsos, credenciais, portas, `javascript:`, IP de metadados e localhost; canal e playlist como não suportados; durações ISO |
| `youtube-import-api.test.ts` | 26 | Vídeo existente, Short, privado, inexistente, removido, rejeitado, restrição de idade, live, agendado, região, incorporação desativada; erros de cota, rate limit, chave inválida, API desabilitada, 5xx e rede/timeout; chave só no cabeçalho; ausência de chave (oEmbed); sanitização de texto e miniatura |
| `youtube-import-service.test.ts` | 37 | Contra Postgres em memória e ffprobe real: autorização, URL inválida sem registro, cota e chave e conexão viram `UNKNOWN` com aviso, cache, limites por minuto e por dia, exclusão não devolve cota, dia de São Paulo, plano pago opcional, upload válido, arquivo inválido, tipo errado, arquivo grande demais, vídeo longo demais, falha de armazenamento, blob inexistente, URLs maliciosas (domínio, http, traversal, query, fragmento, outra importação), acesso de outro usuário, envios simultâneos, URL canônica, exclusão |
| `youtube-import-routes.test.ts` | 10 | Não autenticado (401 em todas as rotas), corpo inválido, `isAdmin` nunca vem do corpo, 500 genérico, token de upload restrito (sem login, outro usuário, outra pasta, traversal, importação já concluída) |
| `youtube-import-cleanup.test.ts` | 3 | Arquivos vencidos e órfãos apagados, recentes e referenciados preservados, purga de 30 dias mesmo em simulação e com a limpeza desligada |
| `YoutubeImporter.test.tsx` | 14 | Validação, prévia (título, canal, duração, miniatura, player só depois do clique), privado, erros 429/400/401/conexão, aviso de cota, upload concluído só com `COMPLETED`, upload recusado, falha de upload, formato e tamanho errados, duplicidade, layout de celular (375 px) |

**Integração com o editor:** os testes existentes de `VideoSplitScreenEditor`, do importador do Instagram e da limpeza continuam passando. O uso do `?youtube=` pelo editor está coberto pelo carregador compartilhado e pelos links gerados pela tela.

**Verificações:**

- **TypeScript (`tsc --noEmit`):** sem erros no código novo. O único erro é pré-existente: `LayoutProps` em `app/layout.tsx`, tipo gerado pelo `next typegen`/`next build` que some depois do build.
- **ESLint:** 0 erros e 0 avisos nos arquivos novos e alterados.
- **Suíte completa, build e revisão independente:** ver a seção 18.

## 15. Pendências

1. Aplicar a migração `0044` (homologação e depois produção) e configurar `YOUTUBE_API_KEY`.
2. **Decisões suas:**
   - exigir plano pago (`YOUTUBE_IMPORT_REQUIRES_PAID_PLAN`)?
   - os limites diários estão bons?
   - quer prazos de retenção próprios para o YouTube? Hoje são os mesmos do Instagram.
3. **Jurídico e conformidade:** a Política de Privacidade da Alilu deve mencionar o uso dos *YouTube API Services* e linkar a do Google (Developer Policies III.A). A tela já mostra os links, mas o texto da política é decisão sua. Para aumentar a cota, o Google faz uma auditoria de conformidade.
4. **Melhorias futuras:**
   - **OAuth do YouTube** (`youtube.readonly`) para confirmar que o canal é do usuário;
   - limitar a emissão de tokens de upload por usuário, porque um usuário logado pode pedir tokens repetidos para uma importação ainda sem arquivo e o arquivo fica público até a carência de órfãos (o importador do Instagram tem o mesmo comportamento);
   - validar com ffprobe por *range* em vez de ler o arquivo inteiro, se o limite de tamanho aumentar;
   - upload *multipart* para arquivos maiores.
5. O vídeo continua sujeito ao limite de 150 s de saída do Split-Screen. Para vídeos longos do YouTube, o usuário escolhe o trecho no próprio editor.

## 16. Instruções de homologação

1. Em Preview ou local: `npm run db:migrate` (banco de homologação), configure `YOUTUBE_API_KEY` e `npm run dev`.
2. Entre na sua conta e abra **Vídeos › Importar YouTube**.
3. Teste os links:
   - `https://www.youtube.com/watch?v=<id público>`, `https://youtu.be/<id>`, `https://www.youtube.com/shorts/<id>` e um `/live/<id>`;
   - um vídeo privado ou removido;
   - um link de canal (deve dar "não suportado");
   - `https://evil.com/watch?v=…` (deve dar "não reconhecido").
4. Confira miniatura, título, canal, duração e situação. Clique em **Ver prévia** e veja se o player oficial abre.
5. Marque a declaração, envie um MP4 seu e aguarde "Validando…" e depois "Importação concluída". Clique em **Editar no Split-Screen** e veja se o vídeo aparece como principal. Gere um resultado curto. Teste também **Publicar no Reels**.
6. Casos de erro:
   - enviar um `.png` renomeado para `.mp4` (deve ser recusado);
   - enviar um arquivo acima de 100 MB (barrado antes do envio);
   - fazer 11 análises em menos de 1 minuto (deve dar limite de requisições);
   - remover a chave e analisar de novo (modo básico, com aviso).
7. Repita no celular (iOS/Android): campo, botão e seletor de arquivo da galeria.
8. Exclua uma importação no histórico e veja se o arquivo some do Blob.
9. Em `/admin/armazenamento`, rode a limpeza em simulação e procure a nova linha "Importações do YouTube vencidas".

## 17. Antes do deploy

- [ ] Revisar o diff e commitar. **Nenhum commit foi feito.**
- [ ] Aplicar a `0044` em produção, numa janela combinada.
- [ ] Criar `YOUTUBE_API_KEY` (restrita à YouTube Data API v3) em Production e Preview.
- [ ] Decidir sobre `YOUTUBE_IMPORT_REQUIRES_PAID_PLAN` e os limites.
- [ ] Atualizar a Política de Privacidade (uso dos YouTube API Services).
- [ ] Rodar `npm run build` e `npm test` no CI e conferir o deploy de Preview.
- [ ] Depois do deploy, acompanhar os logs `scope:"youtube-import"` e o consumo de cota no Google Cloud.

## 18. Resultado da suíte completa e do build

| Verificação | Onde | Resultado |
|---|---|---|
| `next build` (Turbopack + TypeScript) | Windows, no projeto | ✅ **Sucesso** (exit 0, ~85 s). As 5 rotas novas foram geradas: `/videos/importar-youtube` e `/api/videos/youtube-import/*`. O build recriou a pasta `.next`, que é saída de build e está no `.gitignore` |
| `eslint .` | Windows | ✅ 0 erros. Há 7 avisos pré-existentes em arquivos que não foram tocados (`no-unused-vars`) |
| Testes do YouTube (6 arquivos, 127 testes) | Linux, cópia isolada | ✅ 127/127 |
| Suíte completa (373 arquivos, 4.064 testes) | Linux, em lotes | ✅ Todos os lotes executados passaram, incluindo Split-Screen, importador do Instagram e limpeza |
| Suíte completa | Windows, numa só execução | 4.053/4.064 passaram. As 11 falhas são **timeouts por carga** ("Hook timed out in 10000ms" / "Test timed out in 5000ms") em testes que usam o PGlite. Ao repetir, as falhas mudaram de teste, sinal de oscilação da máquina e não de defeito. Todos esses arquivos passam no Linux. Recomendação: rodar no CI ou aumentar o `hookTimeout` no Windows |

### Revisão independente

Um agente revisor fez uma leitura independente, só leitura, com foco em segurança, conformidade e corretude. Os achados corrigidos:

- **URL com `?query` ou `#fragmento`** poderia ser guardada de um jeito que a limpeza não reconheceria, e o arquivo seria apagado por engano. Agora essas URLs são recusadas e o registro guarda a URL canônica devolvida pelo `head()` do Blob.
- **Limite diário contornável** (excluir uma importação "devolvia" a cota). Agora os limites usam a tabela `youtube_import_usage`, que registra a consulta antes de contar, o que também impede que pedidos simultâneos furem o limite.
- **A purga de 30 dias dependia da limpeza estar ligada.** Agora roda sempre e também zera situação e flags.
- **`maxResults` junto com `id`** (não suportado pela API) foi removido.
- **Links obrigatórios:** a tela agora mostra os Termos do YouTube, a Política do Google e a da Alilu.
- O token de upload não devolve mais mensagens de erro internas, e o GET/DELETE tem tratamento de erro.
- O rótulo "Privado" ficou mais neutro, porque o oEmbed também devolve 401 quando a incorporação está desativada.
- O `metadata_fetched_at` usa o horário real da consulta, mesmo quando o dado vem do cache.
- O dia do limite segue o horário de São Paulo.
- O Reels recusa WEBM vindo do `?youtube=`.

Ficaram como pendência documentada (seção 15): limitar a emissão de tokens de upload (o importador do Instagram tem o mesmo comportamento) e validar o arquivo por *range* em vez de lê-lo inteiro.
