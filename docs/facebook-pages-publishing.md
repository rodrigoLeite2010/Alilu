# Publicação simultânea no Instagram e em Páginas do Facebook

Uma publicação do Alilu (imagem, carrossel ou Reel) pode ir para o **Instagram**, para uma ou mais **Páginas do Facebook**, ou para os dois, com um único agendamento. O Facebook é publicado **direto pela Graph API (Pages API)**. O Alilu não depende do compartilhamento automático do Instagram para o Facebook.

## 1. Arquitetura (o que já existia e o que foi adicionado)

| Item | Antes | Agora |
|---|---|---|
| Login do Instagram | *Instagram API with Instagram Login* (`graph.instagram.com`), mais o fluxo opcional *Instagram via Facebook Login* | **Sem mudança** |
| Publicação | `instagram_posts` é a publicação e o destino Instagram (status, container, tentativas, lock) | **Sem mudança** para o Instagram. Nova coluna `publish_to_instagram` (padrão `true`) |
| Facebook | — | `facebook_pages` (Páginas conectadas), `social_publication_destinations` (um destino por publicação × Página, com status, lock, ids e erro próprios) e `social_publication_attempts` (auditoria) |
| Agendador | `/api/cron/instagram-publish` | A mesma rota roda o Instagram e depois o Facebook, com claims e orçamentos de tempo separados |

Regras de isolamento entre as redes:

- O Facebook **nunca escreve** nas colunas do Instagram em `instagram_posts`. Uma falha no Facebook não reabre nem republica o Instagram.
- A única exceção é a publicação "somente Facebook" (`publish_to_instagram = false`). Nela, o `status` da publicação espelha o dos destinos, para que as telas existentes (lista, edição, cancelamento) continuem funcionando. O agendador e o "Publicar agora" do Instagram **ignoram** essas linhas.
- Falha no Instagram não bloqueia o Facebook. Cada rede tem seu próprio claim e o cron roda as duas.

### Arquivos novos

- `db/migrations/0053_facebook_pages_publishing.sql`
- `lib/facebook/facebook-media-rules.ts`: regras puras (specs de Reels, tipos suportados)
- `lib/facebook/destination-view.ts`: tipos e rótulos usados nas telas, e o status geral (Publicado/Parcial/Pendente)
- `lib/facebook/backend/facebook-graph-client.ts`: HTTP da Pages API e da Reels API
- `lib/facebook/backend/facebook-publish-errors.ts`: classificação de erros
- `lib/facebook/backend/facebook-media.ts`: conversão de imagem e ffprobe do Reel
- `lib/facebook/backend/facebook-pages-oauth.ts`: config, permissões e callback
- `lib/facebook/backend/facebook-pages-service.ts`: conectar, selecionar e verificar Páginas
- `lib/facebook/backend/facebook-page-repository.ts`
- `lib/facebook/backend/social-destination-repository.ts`: claim, lock, idempotência
- `lib/facebook/backend/social-destinations-service.ts`: validação de `destinations`
- `lib/facebook/backend/facebook-publish-service.ts`: camada única de publicação e agendador do Facebook
- Rotas: `app/api/facebook/pages/**`, `app/api/social/destinations/[id]/{retry,attempts}`
- Telas: `app/instagram/facebook-paginas` (escolha da Página), `components/instagram/{SocialDestinationsPicker,PublicationDestinationsStatus,FacebookPagesSection,FacebookPagePicker}.tsx`

## 2. Permissões da Meta

| Permissão | Para quê |
|---|---|
| `pages_show_list` | Listar as Páginas que a pessoa administra (`/me/accounts`) |
| `pages_read_engagement` | Ler dados da Página, os posts publicados (reconciliação contra duplicidade) e o status e os direitos autorais dos Reels |
| `pages_manage_posts` | Criar fotos, posts com várias fotos e Reels na Página |

As permissões do Instagram (`instagram_business_*`, `instagram_basic`, `instagram_content_publish`) **não** dão acesso de publicação no Facebook. Por isso existe uma conexão separada.

Além das permissões, a pessoa precisa ter a tarefa **CREATE_CONTENT** (ou **MANAGE**) na Página. O Alilu confere isso no campo `tasks` de `/me/accounts` e recusa Páginas sem essa tarefa.

## 3. Configuração no Meta for Developers (manual)

1. Abra o app Meta **que já é usado em `INSTAGRAM_FACEBOOK_APP_ID`**. É o app com o produto *Facebook Login for Business*. Não use as credenciais de *Instagram Business Login* (`INSTAGRAM_APP_ID`).
2. Em **Facebook Login for Business → Configurations → Create configuration**:
   - Tipo de token: **User access token**.
   - Permissões: `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`.
   - Ativos: Páginas.
   - Salve e copie o **Configuration ID** para `FACEBOOK_PAGES_LOGIN_CONFIG_ID`.
3. Em **Facebook Login for Business → Settings → Valid OAuth Redirect URIs**, **adicione** a URI abaixo **sem remover** as que já existem (`/api/instagram/facebook-oauth/callback` continua sendo usada):
   - `https://alilu.com.br/api/facebook/pages/oauth/callback`
   - para desenvolvimento local: `http://localhost:3000/api/facebook/pages/oauth/callback`
4. **App Review** (modo Live, para pessoas fora da equipe do app): solicite **Advanced Access** para `pages_show_list`, `pages_read_engagement` e `pages_manage_posts`. A análise costuma pedir:
   - um screencast do fluxo: Painel → "Conectar Página do Facebook" → login na Meta → escolha da Página → criar publicação marcando "Facebook" → publicação aparecendo na Página → histórico com "Ver publicação";
   - a justificativa de cada permissão (use a tabela da seção 2);
   - a política de privacidade e a página de exclusão de dados, que já existem em `/privacidade` e `/exclusao-de-dados`;
   - a verificação da empresa (Business Verification), se a Meta pedir.
   Antes da aprovação, a conexão funciona para quem tem papel no app (administradores, desenvolvedores, testadores). Isso basta para a conta Alilu.
5. A Página **Alilu** precisa estar no mesmo Business/portfólio que a pessoa que conecta, com a tarefa "Criar conteúdo".

## 4. Fluxo OAuth (separado do Instagram)

```
Painel → GET /api/facebook/pages/oauth/start
         state = HMAC(usuário Alilu) — só o SHA-256 é guardado (instagram_oauth_pending, purpose='facebook_pages')
       → facebook.com/v25.0/dialog/oauth?client_id&config_id&redirect_uri&state
       → GET /api/facebook/pages/oauth/callback
         confere state + sessão do MESMO usuário, troca code → token de usuário (60 dias),
         confere as permissões e guarda o token CIFRADO na tentativa
       → /instagram/facebook-paginas?attempt=…  (a pessoa MARCA as Páginas; nada pré-selecionado entre várias)
       → POST /api/facebook/pages/oauth/select
         o servidor consulta a Meta de novo e só aceita Páginas confirmadas para AQUELE login,
         com CREATE_CONTENT/MANAGE. Guarda o Page Access Token cifrado em facebook_pages.
```

- Callbacks do Instagram (`/api/instagram/oauth/callback`, `/api/instagram/facebook-oauth/callback`): **sem mudança**. Uma tentativa de Páginas nunca é aceita pelo fluxo do Instagram, e vice-versa (`purpose`).
- O token do Instagram **nunca** é sobrescrito: Páginas ficam em `facebook_pages`.
- O vínculo Página → Instagram (`instagram_business_account`) é só informativo. É associado apenas a uma conta Instagram **do próprio usuário**.
- Unicidade: `(user_id, page_id)`. Cada pessoa usa somente o token obtido pelo próprio login.
- Desconectar apaga o token. Erros 190 (token) ou 10/200 (permissão) marcam a Página como "Precisa reconectar".

## 5. Publicação

| Alilu | Facebook | Endpoint |
|---|---|---|
| Imagem | Foto publicada na Página | `POST /{page-id}/photos` (`url`, `message`, `published=true`) |
| Carrossel (2–10 fotos) | **Um** post com várias fotos, na mesma ordem | `POST /{page-id}/photos` (`published=false`), uma por vez, e depois `POST /{page-id}/feed` com `attached_media[i]={"media_fbid"}` |
| Reel | Reel da Página | `POST /{page-id}/video_reels` (`upload_phase=start`), depois `POST rupload.facebook.com/video-upload/v25.0/{video-id}` (header `file_url`), depois `upload_phase=finish&video_state=PUBLISHED`, e por fim `GET /{video-id}?fields=status` até `publishing_phase=complete` |

- Usa a mesma mídia do Instagram (URL pública do Vercel Blob) e a mesma legenda, ou a legenda específica do Facebook se ela foi preenchida.
- Imagens JPEG/PNG de até 4 MB seguem com o arquivo original, sem recompressão. Acima disso, o Alilu gera um JPEG de qualidade 90 com a mesma proporção e reduz a resolução só se for preciso.
- Antes do upload do Reel, o ffprobe confere proporção 9:16, resolução mínima 540×960, duração de 3 a 90 s, 24–60 fps e codec. Se algo não bate, a falha é permanente e a mensagem é clara.
- O Reel só fica "Publicado" quando a Meta confirma o `publishing_phase`. Se o processamento indicar erro, o Alilu consulta `copyright_check_information` e, se houver bloqueio, mostra a mensagem de direitos autorais. **Não há nenhum mecanismo para contornar** as verificações de conteúdo da Meta.

## 6. Agendamento, idempotência e duplicidade

- **Claim atômico** por destino (`UPDATE … FOR UPDATE SKIP LOCKED`, lock com expiração de 5 min). Dois workers nunca pegam o mesmo destino, e toda escrita exige o `lockToken`.
- O destino fica vencido quando o horário da publicação chega (publicação fora de rascunho e não cancelada) ou quando foi liberado por "Publicar agora"/"Tentar novamente".
- **POST não idempotente** (foto, post com várias fotos): `request_started_at` é gravado **antes** do envio. Se a resposta se perde (timeout, queda, 5xx sem corpo), a próxima tentativa **consulta a Página** (`/{page-id}/published_posts`, mesma legenda, desde o envio):
  - post encontrado: marca Publicado, **sem novo POST**;
  - dentro da carência de 2 min: espera;
  - não encontrado após a carência: envia de novo (uma vez);
  - sem legenda, não dá para distinguir com segurança. O agendador marca "Precisa de verificação" e só o "Tentar novamente" manual reenvia.
- **Reels**: o `video_id` é salvo na fase `start`. Toda retomada (upload, finish, status) usa o mesmo vídeo e nunca cria um segundo Reel.
- **Carrossel**: as fotos não publicadas são salvas uma a uma. Uma falha parcial retoma de onde parou. Uma falha definitiva remove as fotos não publicadas, para não deixar órfãs.
- Destino Publicado nunca volta a ser elegível.
- Erros temporários usam backoff de 5/15/60 min (os mesmos do Instagram). Erros permanentes ficam como Falhou, com motivo (`token`, `permission`, `media`, `copyright`, …).

## 7. Telas

- **Painel do Instagram → Facebook**: conectar Página, verificar status, reconectar, desconectar, permissões necessárias e Instagram vinculado.
- **Criar/agendar (post, carrossel, Reel)**: seção "Publicar nas redes sociais" com Instagram e Facebook (Página escolhida e legenda opcional do Facebook). Sem nenhuma rede marcada, não salva. Sem Página conectada, mostra "Conectar Página do Facebook". Story e carrossel com vídeo explicam por que o Facebook não está disponível.
- **Minhas publicações**: "Instagram: Publicado — Facebook (Alilu): Falhou — Reconectar Página", com "Ver publicação", "Tentar novamente" (**só aquele destino**, via `POST /api/social/destinations/{id}/retry`) e "Tentativas". Um selo "Parcial" ou "Facebook pendente" aparece quando nem todas as redes concluíram.

## 8. Variáveis de ambiente

| Variável | Obrigatória | Valor |
|---|---|---|
| `INSTAGRAM_FACEBOOK_APP_ID` | sim | App ID do app Meta (Facebook Login for Business), **já existente** |
| `INSTAGRAM_FACEBOOK_APP_SECRET` | sim | App Secret do mesmo app, **já existente** |
| `FACEBOOK_PAGES_LOGIN_CONFIG_ID` | sim | Configuration ID criado no passo 3.2 |
| `FACEBOOK_PAGES_OAUTH_REDIRECT_URI` | não | `https://alilu.com.br/api/facebook/pages/oauth/callback` (padrão em produção) |
| `INSTAGRAM_TOKEN_ENCRYPTION_KEY` | já existe | Cifra também os Page Access Tokens |
| `CRON_SECRET` / `INSTAGRAM_SCHEDULER_SECRET` | já existem | O mesmo cron processa o Facebook |

Sem `FACEBOOK_PAGES_LOGIN_CONFIG_ID`, o Facebook simplesmente não aparece como disponível, e o Instagram continua igual.

## 9. Deploy na Vercel

1. **Banco primeiro** (a migração é aditiva e não destrói nada): `npm run db:migrate` com o `DATABASE_URL` de produção. **Faça isso antes do deploy**: o código novo lê `publish_to_instagram`.
2. Configure as variáveis da seção 8 em *Production* (e em *Preview*, se quiser testar lá, com o callback do domínio de preview cadastrado na Meta).
3. Faça o deploy (`vercel --prod` ou merge na branch de produção). `next.config.ts` já inclui o binário do ffprobe nas rotas que publicam Reels no Facebook.
4. O disparador atual do cron (cron-job.org/GitHub Actions → `/api/cron/instagram-publish`) **não muda**. Recomenda-se a frequência de 1 min, porque os Reels do Facebook são conferidos a cada execução (cerca de 60 s entre verificações, sem esperas longas dentro da função serverless).
5. Teste com uma publicação real **somente quando autorizado**: no painel, conecte a Página Alilu, crie um post de teste com Instagram e Facebook, confira o histórico e apague o teste nas duas redes.

## 10. Limitações conhecidas

- Stories não são publicados no Facebook.
- Carrossel com vídeo não vai para o Facebook pela API. A tela sugere usar só fotos ou publicar o vídeo como Reel.
- Reels no Facebook: de 3 a 90 s, 9:16, e até 30 Reels via API por Página a cada 24 h (limite da Meta).
- Áudio com direitos autorais pode ser bloqueado ou silenciado pelo Facebook mesmo sendo aceito no Instagram.
- O post com várias fotos do Facebook não tem o mesmo visual de "deslizar" do carrossel do Instagram: as fotos aparecem em grade.
- Uma publicação "somente Facebook" ainda pertence a uma conta Instagram do usuário (o módulo de publicação é o do Instagram). Para usá-lo, é preciso ter um Instagram conectado.
- O "Repostar" continua publicando só no Instagram. O Piloto Automático publica também no Facebook (ver seção 11).
- Editar uma publicação mantém os destinos. Pela API, `PATCH … { action: "update", destinations }` também permite trocar as Páginas e a legenda do Facebook enquanto nada foi publicado.

## 11. Piloto Automático (publicações agendadas automaticamente)

**Problema corrigido:** as publicações automáticas vêm do Piloto Automático, que criava o post em `instagram_posts` **sem nenhum destino** em `social_publication_destinations`. O cron (`/api/cron/instagram-publish`) já processava o Facebook, mas não havia destino Facebook para publicar — por isso só o Instagram saía. A publicação manual funcionava porque a tela grava o destino quando a pessoa marca "Facebook".

**Correção (sem segundo agendador e sem nova lógica de publicação):**

- `content_automations.facebook_page_ids` (migração `0054`): `NULL` = automático (Páginas **conectadas** vinculadas à mesma conta Instagram da automação); `{}` = não publicar no Facebook; lista = Páginas escolhidas. Automações existentes ficam em `NULL` (automático).
- Ao criar a publicação, o cron do Piloto chama `attachAutomationFacebookDestinations` (`lib/content-automation/backend/automation-facebook.ts`) → `attachAutomaticFacebookDestinations` (`social-destinations-service.ts`), que grava os destinos com `addFacebookDestinationsIfMissing` (`on conflict do nothing`: retry nunca duplica). Vale para POST, CAROUSEL, REEL e Carrossel Inteligente (inclusive o post novo criado ao aprovar). Story e carrossel com vídeo são ignorados (a API não suporta).
- Daí em diante tudo é o fluxo já existente: `runFacebookScheduler` → `publishFacebookDestination` (a mesma função de "Publicar agora"), com status, tentativas e erros próprios por destino. Falha no Facebook nunca altera o Instagram, e falha ao preparar o destino nunca impede a criação do post.
- Nada retroativo: só publicações criadas **depois** do deploy recebem o destino Facebook.
- Tela: Piloto Automático → automação → Configurações → "Publicar também no Facebook" (Automático / Escolher as Páginas / Não publicar). API: `PATCH /api/content-automation/automations/{id}` com `{ "action": "update-facebook", "facebookPageIds": null | [] | [ids] }`.
- Cron: o Facebook só **começa** novos destinos se ainda sobrar tempo no `maxDuration` (`lib/facebook/facebook-scheduler-budget.ts`); caso contrário fica para o próximo disparo, evitando ser interrompido no meio de um envio.
