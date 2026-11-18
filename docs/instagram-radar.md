# Radar Instagram

Importação de vídeos por vários links e publicação **automática** numa conta do Instagram escolhida explicitamente, com 1 a 10 publicações por dia, intervalo mínimo fixo e janela de horário. Funciona com o navegador fechado.

Menu: **Instagram › Radar Instagram** (`/instagram/radar`, `/instagram/radar/novo`, `/instagram/radar/[id]`).

## 1. Arquitetura (nada paralelo)

```
Radar Instagram (tela)                                   ← components/instagram-radar/*
  → POST /api/instagram-radars (+ /preview, /[id], /[id]/links, /accounts)
  → lib/instagram-radar/backend/radar-service.ts         ← validação: conta do usuário, 1–10/dia, intervalo, janela
  → video_queues (kind = 'INSTAGRAM_RADAR') + video_queue_items   ← MESMA fila persistente dos Games
  → importador existente (lib/video-queue/backend/queue-processor.ts → safe-download / import-service do Instagram)
  → planejador existente (queue-planner.ts → ramo do radar: allocateRadarSlots + lock por conta)
  → instagram_posts (post_type 'reels', source 'VIDEO_QUEUE', video_queue_item_id)  ← agendador existente
  → cron existente /api/cron/video-queue (importa + planeja) e /api/cron/instagram-publish (publica)
  → publicador existente instagram-publish-service.ts (+ guarda de conta antes da Meta)
  → histórico: video_queue_events + instagram_posts + instagram_publish_attempts
```

Nenhum cron, importador ou publicador novo foi criado.

## 2. Regras de agendamento (`lib/instagram-radar/schedule.ts`, puro e testado)

- **Quantas publicações por dia?** inteiro de 1 a 10 (frontend, backend e `CHECK` no banco). É o limite do radar, não o limite oficial da Meta — os limites da Meta continuam valendo (erros da Meta são tratados pelo publicador).
- **Intervalo mínimo**: 30 min, 1 h, 2 h, 3 h, 4 h, 6 h, 8 h, 12 h ou 24 h (lista fechada).
- **Horários do dia** = início, início + intervalo, … (N horários). Ex.: 5/dia, 2 h, início 9h → 9h, 11h, 13h, 15h, 17h.
- **Janela**: horário inicial e final, dias da semana e fuso (padrão `America/Sao_Paulo`). Fim < início = janela que atravessa a meia-noite; o dia da semana é o do início da janela. Datas convertidas com o fuso (inclusive horário de verão).
- **Compatibilidade**: exige `(N − 1) × intervalo ≤ duração da janela` e `N × intervalo ≤ 24 h`. Se não couber, a configuração é **recusada** com o motivo e sugestões (menos publicações, intervalo menor, janela maior). Nada é redistribuído sem aprovação e o intervalo nunca é reduzido sozinho.
- **Limite por conta e por dia** (dia civil no fuso do radar): conta **todas** as publicações da conta (outros radares, filas de Games, Piloto, publicações antigas). O teto combinado é o **menor** limite entre os radares ativos da conta (nunca acima de 10).
- **Intervalo por conta**: um horário a menos do intervalo de qualquer outra publicação da mesma conta é **pulado** (não é deslocado). A prévia informa quantos foram pulados e por quê.
- **Coordenação**: lock por conta (`instagram_account_schedule_locks`) — dois radares (ou radar + fila de Games) da mesma conta nunca escolhem horários ao mesmo tempo, mesmo com crons simultâneos.
- As publicações são criadas no agendador com até 48 h de antecedência; a prévia mostra os próximos horários e a estimativa de duração (sem garantir sucesso).

## 3. Conta correta (requisito crítico)

- O radar grava `instagram_account_id` explicitamente; nada vem pré-selecionado; a conta não pode ser trocada depois (outra conta = outro radar).
- Só contas do usuário logado e conectadas aparecem no seletor (foto, nome e tipo vêm de `GET /me` da Meta; sem token na resposta).
- Conta desconectada/expirada → radar **pausado automaticamente** com o motivo; nunca troca de conta. Reconecte a mesma conta e clique em Retomar.
- **Imediatamente antes da API da Meta** (`publish-target-guard.ts`): a conta da publicação precisa ser do mesmo usuário e, para publicações de fila/radar, exatamente a conta da fila. Divergência → publicação `FAILED` com o motivo, **nenhuma** chamada à Meta.
- **Facebook**: o radar nunca grava destinos Facebook (`CHECK` no banco: `facebook_page_ids` vazio). Adicionar destino Facebook a uma publicação do radar é recusado, e um destino gravado à força é bloqueado na hora da publicação (`instagram_radar_only`), sem chamar a Meta.

## 4. Links, autorização e duplicidade

- Campo grande (linha, vírgula, espaço), importação de `.txt` (até 512 KB), contagem de reconhecidos, repetidos e inválidos, confirmação antes de enviar.
- Duas opções explícitas:
  - **Tenho autorização** (declaração obrigatória) → importador existente: Instagram pelo provedor autorizado já usado pelo Alilu (Apify, plano pago, cota diária); arquivo direto pelo download seguro (SSRF, tamanho, tipo, tempo).
  - **Só referência** → nada é baixado; o item fica "Aguardando autorização ou arquivo" até o envio do arquivo autorizado.
- YouTube/TikTok/outras plataformas sempre aguardam o arquivo autorizado (sem scraping, sem contorno de DRM, sem remover marca/autoria).
- Duplicidade: URL normalizada (na mesma fila e na mesma **conta** por outros radares/filas), hash do arquivo (`block_duplicate_files` ligado em todo radar), índice único `instagram_posts.video_queue_item_id` (uma publicação por vídeo), claims atômicos do agendador (cron duplicado não republica), container retomado em timeouts.

## 5. Legendas

Legenda padrão com `{titulo}`, `{tema}` (nome do radar), `{numero}`, `{total}` + hashtags fixas (sem repetir). Cada vídeo pode ter legenda própria, escrita ou **gerada por IA** pela rota existente `/api/instagram/ai-caption` (prompt que proíbe inventar fatos) e sempre revisada antes de salvar. Vídeo sem legenda própria: usar a legenda padrão (neutra) **ou** "enviar para revisão" (não é agendado até alguém revisar).

## 6. Fila, falhas e pausa

Estados dos itens: Pendente, Validando, Importando, Processando, Aguardando autorização ou arquivo, Pronto, Agendado, Publicado, Erro, Cancelado (+ "Aguardando revisão da legenda"). Pausado/Ativo/Rascunho/Arquivado são estados do radar.

- Falha de um vídeo não para a fila; "usar o próximo vídeo pronto" (padrão) ou "aguardar".
- Publicação só é "Publicado" depois da confirmação da Meta (container `FINISHED` + `media_publish`).
- Pausar desfaz só as publicações futuras que ainda não começaram; histórico e publicados ficam.
- "Cancelar radar" = arquivar (mesma regra).

## 7. Banco — `0059_instagram_radar.sql` (aditiva)

- `video_queues`: `kind` (padrão `VIDEO_QUEUE` — todas as filas existentes continuam iguais), `window_start`, `window_end`, `hashtags`, `missing_caption_policy`; `CHECK` das regras do radar; índice `(instagram_account_id, kind, status)`.
- Nova tabela `instagram_account_schedule_locks` (token + expiração).
- Nenhum dado existente é alterado ou apagado.

## 8. Interface manual

- Saiu do menu e da página da categoria: grupo "Manual" (Criar post, Carrossel, Reels, Legendas), botões "Agendar nova publicação / Post viral / Novo carrossel / Novo Reel" em Minhas publicações, atalhos de criação no celular.
- `/instagram/painel/calendario/novo` e `/novo-carrossel` (compositor manual autenticado): **restritos ao admin** (ADMIN_EMAILS) como ferramenta de teste; os demais vão para o Radar.
- Mantidos: páginas públicas `/instagram/criar-post`, `/carrossel`, `/reels`, `/legendas`, `/posts-virais` (SEO/AdSense, downloads e destino dos botões do importador, do vídeo com IA e do split screen), serviços de publicação, Minhas publicações (histórico, cancelar/editar agendamentos existentes), `/admin/meta-app-review`, OAuth, callbacks, tokens e escopos (sem alteração).

## 9. Ativação em produção

1. `npm run db:migrate` (aplica a `0059_instagram_radar.sql`) **antes** do deploy.
2. Deploy.
3. Nenhum disparador novo: os já existentes `POST /api/cron/video-queue` (5 min) e `POST /api/cron/instagram-publish` (1 min) atendem o radar.
4. Teste real só com vídeo próprio: criar radar com 1 link, conferir a prévia, ativar e acompanhar no painel.
