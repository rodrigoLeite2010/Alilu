# Radar Viral Inteligente

Descoberta automática de conteúdos em alta (início: Games › GTA 6), classificação por **Viral Score**, controle de **direitos** e **reabastecimento automático** da fila de publicação — reaproveitando a Fila de vídeos, o importador, o agendador e as integrações com a Meta que já existiam. O radar não tem agendador nem publicador próprios.

## 1. Arquitetura

```
/radar-viral (lista + indicadores)   /radar-viral/novo   /radar-viral/[id] (painel)
          │  /api/viral-radars/…  (sessão; tudo filtrado por user_id)
          ▼
viral_radars ─┬─ viral_radar_sources (YouTube pesquisa/canal, RSS, Instagram hashtag*, TikTok*)
              ├─ viral_candidates ── viral_metric_snapshots (observações reais com data)
              ├─ viral_radar_executions / viral_radar_events (auditoria)
              └─ queue_id ──► video_queues (EXISTENTE: conta IG, Páginas FB, horários, legenda)

Disparador EXISTENTE ─► /api/cron/video-queue ─► runViralRadarTick() (orçamento ≤ 60 s, isolado)
                                                │  1. execuções RUNNING antigas → ABANDONED
                                                │  2. claim atômico (FOR UPDATE SKIP LOCKED) dos radares
                                                │     vencidos (SCHEDULE) ou com fila < mínimo (REFILL)
                                                │  3. por radar: fontes → candidatos + snapshots → score →
                                                │     critérios → direitos → destino A/B/C → fila
                                                │  4. métricas das publicações próprias
                                                ▼
                                      runQueueImports() (EXISTENTE) → planQueue() (EXISTENTE)
                                                ▼
                     instagram_posts + social_publication_destinations → /api/cron/instagram-publish (EXISTENTE)
```
\* desativados até haver autorização externa (ver §7).

`/api/cron/viral-radar` é opcional (mesmo segredo), para quem preferir um disparador separado (`VIRAL_RADAR_IN_QUEUE_CRON=false`).

## 2. Fluxo de uma execução (`lib/viral-radar/backend/radar-runner.ts`)

1. **Estoque** da fila ligada (`READY` + em importação + agendados). Execução agendada com fila já no tamanho ideal **não pesquisa** (custo).
2. **Fontes** ativas, cada uma isolada (falha de uma não afeta as outras):
   - `YOUTUBE_SEARCH`: `search.list` (100 un.) por palavra-chave, em rodízio diário, com cache (`viral_query_cache`) e **reserva de cota antes da chamada** (`viral_provider_usage`, teto `VIRAL_RADAR_YOUTUBE_DAILY_UNITS`); depois `videos.list` (1 un./50 vídeos). Chave só no cabeçalho `X-Goog-Api-Key`.
   - `YOUTUBE_CHANNEL`: feed oficial do canal (sem cota), com visualizações/curtidas do próprio feed.
   - `RSS`: feed RSS/Atom pelo `safeDownload` existente (SSRF, DNS rebinding, redirecionamentos, tipo, 2 MB, 15 s); parser sem DOCTYPE (XXE).
   - `INSTAGRAM_HASHTAG`: Graph API `ig_hashtag_search` + `top_media` (limite de 30 hashtags/7 dias controlado). **Desativado** sem `INSTAGRAM_HASHTAG_SEARCH_ENABLED=true`.
   - `TIKTOK`: **sempre desativado** (sem API autorizada para pesquisa comercial; nada de endpoints privados).
3. **Candidatos**: uma linha por `(radar, plataforma, ID externo)` — o mesmo vídeo achado por várias palavras-chave/fontes é um candidato só. Entre fontes diferentes prevalece a autorização mais forte; aprovação manual nunca é sobrescrita.
4. **Nova observação** dos vídeos do YouTube já acompanhados (até 150, 1 un./50).
5. **Viral Score** (`lib/viral-radar/score.ts`, fórmula `v1`, pesos por radar).
6. **IA opcional** (classificação de até 5 candidatos/execução, teto diário por radar).
7. **Critérios** (views/curtidas/comentários mínimos, idade máxima, score mínimo) e **seleção** dos melhores (até `maxSelectedPerRun` novas seleções).
8. **Destino**: A = elegível → fila; B = referência para conteúdo original; C = aguardando autorização/revisão.
9. **Fila**: elegíveis entram até completar o tamanho ideal, sob o lock de planejamento da fila; URL já usada na **mesma conta** do Instagram é bloqueada; prioridade por score com envelhecimento (+10 pontos/dia de espera) ou FIFO.

## 3. Viral Score v1

| Componente | Peso padrão | Cálculo | Sem dado |
|---|---|---|---|
| Crescimento | 35 | Δviews/Δhoras entre a observação mais recente e a anterior ≥ 30 min; escala log; referência = p90 do lote (piso 1.000 views/h) | só 1 observação → fica de fora ("aguardando 2ª observação") |
| Curtidas/views | 20 | taxa ÷ 6% (teto) | sem curtidas ou views < 500 (amostra pequena) |
| Comentários/views | 15 | taxa ÷ 0,8% (teto) | idem |
| Atualidade | 15 | 0,5^(idade/48 h) | sem data |
| Relevância | 15 | regras (palavras-chave/aliases do tema) ou IA | — |

`score = média_ponderada_dos_disponíveis × (0,5 + 0,5 × cobertura)`, 0–100; cobertura < 30% → sem score. Visualizações totais **nunca** são tratadas como por hora. Ficam gravados: métricas e data de cada observação, componentes, versão da fórmula e justificativa.

## 4. Direitos (o ponto central)

- Ser **público não é autorização**. Resultados de pesquisa (YouTube/Instagram/TikTok) são sempre de terceiros.
- Autorização automática só por **fonte** (canal próprio/feed licenciado) com declaração registrada (`license_declared_at`) e escopo completo: **edição + republicação + uso comercial**. Escopo incompleto → "em revisão".
- **Modo automático**: só autorizados vão para a fila. **Modo supervisionado**: terceiros ficam "Aguardando autorização"; o usuário pode **Aprovar** declarando a licença (escopo completo + descrição + confirmação) — registrado como `MANUAL_APPROVAL`.
- Vídeo do YouTube (mesmo próprio/aprovado) entra na fila como **"Aguardando arquivo"**: a API oficial não permite baixar; o usuário envia o arquivo (YouTube Studio). Nada é baixado do YouTube/TikTok.
- **Conteúdo original** (destino B): "Criar conteúdo original" gera, com IA, um roteiro a partir do **assunto** — nunca do arquivo. Afirmações só ficam "confirmado" com link idêntico a uma fonte RSS marcada como oficial; o resto vira "a verificar"/"rumor"/"teoria". Expressões como "trailer oficial", "vazamento", "data confirmada" são trocadas quando não há fonte.

## 5. Processamento do vídeo (na Fila de vídeos, opt-in)

Colunas novas em `video_queues` (padrão neutro — filas existentes não mudam): `block_duplicate_files`, `reframe_mode` (`NONE`/`FIT_9_16`), `max_duration_seconds`. Filas criadas pelo radar ligam `block_duplicate_files`.
- **Hash SHA-256** do arquivo (`video_queue_items.content_sha256`): mesmo arquivo já pronto/agendado/publicado na mesma conta → `ERROR DUPLICATE_FILE`.
- **9:16**: vídeo inteiro reduzido e centralizado sobre fundo desfocado do próprio vídeo (sem cortar, sem distorcer), 720×1280, H.264/AAC, faststart; corte de duração opcional. O **original é preservado** (`…-original.mp4`, `original_blob_url`). Tempo máximo 75 s; falha → segue no formato original com aviso. Roda dentro do worker de importação (mesmo orçamento/locks).
- Não implementado (documentado como limitação): headline sobreposta e legendas (STT) no vídeo.

## 6. Robustez

- Lock por radar (`run_lock_token`, 10 min) adquirido por claim atômico; "Executar agora" usa o mesmo lock.
- Execução que morre fica `RUNNING` → vira `ABANDONED` (15 min); o lock expira e o radar é retomado.
- Falha total da execução → backoff 15 min, 30, 60… (máx. 24 h). Reabastecimento sem resultado → espera 30 min, 1 h, 2 h… até a frequência (sem pesquisas infinitas). Radar continua ativo.
- Idempotência: candidato único por identidade; snapshot ignorado se repetido em < 10 min; `markCandidateQueued` só a partir de `ELIGIBLE`; índice único da fila por URL; índice único `instagram_posts.video_queue_item_id` (já existente).
- Publicação: as garantias existentes do agendador (Instagram e Facebook com status próprios; falha só no Facebook não republica o Instagram; reconciliação antes de repetir).
- Logs estruturados `{"scope":"viral-radar",…}` sem tokens.

## 7. Permissões e conectores pendentes

| Conector | Situação | O que falta |
|---|---|---|
| YouTube pesquisa | pronto | `YOUTUBE_API_KEY` (já usada no "Importar do YouTube") com YouTube Data API v3 habilitada |
| YouTube canal (feed) | pronto | nada (feed público oficial) |
| RSS/Atom | pronto | nada |
| Instagram hashtag | **desativado** | App Review da Meta: recurso *Instagram Public Content Access* + conta pelo Login do Facebook (`instagram_basic`); então `INSTAGRAM_HASHTAG_SEARCH_ENABLED=true`. A API não fornece visualizações |
| TikTok | **desativado** | não há API autorizada para pesquisa com uso comercial configurada |
| Métricas IG | curtidas/comentários prontos | views/alcance/salvamentos/compartilhamentos exigem `instagram_business_manage_insights` (Login do Instagram) ou `instagram_manage_insights` (Login do Facebook) — hoje ficam "indisponíveis" |
| Métricas FB | curtidas/comentários (pages_read_engagement) | views exigem `read_insights` |

## 8. Banco — migração `0056_viral_radar.sql` (aditiva)

Tabelas novas: `viral_radars`, `viral_radar_sources`, `viral_candidates`, `viral_metric_snapshots`, `viral_radar_executions`, `viral_radar_events`, `viral_provider_usage`, `viral_query_cache`, `viral_post_metrics`. Colunas novas com padrão neutro em `video_queues` (3) e anuláveis em `video_queue_items` (2). Nenhum dado existente é alterado.

## 9. Variáveis de ambiente (todas opcionais)

| Variável | Padrão | Uso |
|---|---|---|
| `YOUTUBE_API_KEY` | — (já existe) | sem ela a pesquisa do YouTube fica desativada |
| `VIRAL_RADAR_ENABLED` | `true` | `false` desliga o radar |
| `VIRAL_RADAR_IN_QUEUE_CRON` | `true` | radar dentro de `/api/cron/video-queue` |
| `VIRAL_RADAR_YOUTUBE_DAILY_UNITS` | `3000` | teto diário de cota do radar |
| `VIRAL_RADAR_YOUTUBE_SEARCHES_PER_RUN` | `2` | search.list por execução de cada radar |
| `VIRAL_RADAR_SEARCH_CACHE_HOURS` | `3` | cache das pesquisas |
| `VIRAL_RADAR_MAX_RADARS_PER_RUN` | `3` | radares por chamada do cron |
| `VIRAL_RADAR_MONITOR_PER_RUN` | `10` | publicações medidas por chamada |
| `INSTAGRAM_HASHTAG_SEARCH_ENABLED` | `false` | só após aprovação da Meta |
| `CONTENT_AI_*` | já existem | IA opcional (legendas, classificação, roteiros) |

## 10. Ativação em produção

1. `npm run db:migrate` (aplica `0056_viral_radar.sql`) **antes** do deploy.
2. Conferir `YOUTUBE_API_KEY` e, se quiser, ajustar `VIRAL_RADAR_YOUTUBE_DAILY_UNITS`.
3. Deploy (sem trigger novo: o disparador de `/api/cron/video-queue` já executa o radar; recomendado a cada 5 min).
4. Criar o radar em **/radar-viral/novo** (padrões do "Radar GTA 6 Brasil"), escolher a conta GTA 6 e, quando conectada, a Página GTA 6.
5. Cadastrar ao menos uma **fonte autorizada** (canal próprio ou feed licenciado com arquivos MP4). Sem ela, o radar só gera referências/aprovações.
6. Clicar em "Ativar publicação" e acompanhar o primeiro ciclo no painel.

## 11. Custos

Nenhum serviço pago novo. YouTube Data API: gratuita dentro da cota (10.000 un./dia por projeto); com o padrão, ≤ 3.000 un./dia. IA: mesmo provedor/plano do Piloto Automático, opcional, com teto diário por radar (padrão 20 chamadas) e custo registrado em `generation_usage` (`viral_radar`). Vercel: execução dentro do cron já existente (≤ 60 s por chamada para o radar); ffmpeg da adaptação 9:16 dentro do orçamento do worker. Blob: um arquivo adaptado + o original por vídeo adaptado.
