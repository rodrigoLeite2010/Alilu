# Meta App Review — Instagram (appalilu · App ID 1631956071610441)

Guia para gravar o novo screencast e reenviar `instagram_business_basic` e `instagram_business_content_publish`.

A Meta recusou o envio anterior com o motivo "Screencast não alinhado com detalhes do caso de uso": o caso de uso é permitido, mas o vídeo não mostrou a experiência completa. O painel **`/admin/meta-app-review`** existe para gravar o fluxo **real e completo**, na ordem que a Meta pede.

> Nada aqui garante a aprovação. O painel não simula nada: a autorização, a consulta à conta e a publicação são as reais.

---

## 1. Diagnóstico da integração (auditoria)

| Item | O que existe no Alilu |
|---|---|
| Arquitetura | Next.js (App Router) na Vercel, Postgres (Neon), Vercel Blob, NextAuth |
| **Fluxo usado na revisão** | **Instagram API with Instagram Login** (Business Login for Instagram): `www.instagram.com/oauth/authorize` → `api.instagram.com/oauth/access_token` → token longo em `graph.instagram.com/access_token` |
| Permissões pedidas | Somente `instagram_business_basic` e `instagram_business_content_publish` (`lib/instagram/backend/instagram-oauth-config.ts`). Nenhuma permissão de Facebook Login é misturada neste fluxo |
| Fluxo separado | "Contas gerenciadas pela Meta" (Facebook Login for Business com `config_id`, `instagram_basic`, `instagram_content_publish`, `graph.facebook.com`). Tem credenciais, callback e tokens próprios (`auth_provider = facebook_login`). **Não faz parte desta revisão** e não foi alterado |
| Início do OAuth | `GET /api/instagram/oauth/start`: exige login no Alilu; `state` assinado (HMAC com `AUTH_SECRET`) preso ao usuário; cookie HttpOnly; página-ponte para o celular não abrir o app nativo |
| Callback | `https://alilu.com.br/api/instagram/oauth/callback` (**mantido**). Confere o `state` com o cookie (CSRF), trata cancelamento e erros da Meta, troca o código, troca pelo token longo, confere o ID da conta e salva |
| Tokens | Cifrados com AES (`INSTAGRAM_TOKEN_ENCRYPTION_KEY`) e nunca enviados às telas. Renovação automática do token longo; contas vencidas viram `expired` e pedem reconexão |
| Publicação | `instagram-publish-service.ts`: trava contra duplicidade, cria o contêiner (`POST /{ig-user-id}/media`, `media_type=REELS`), consulta `status_code`, publica (`POST /{ig-user-id}/media_publish`), grava o `meta_media_id`, retoma sem recriar o contêiner e repete com espera em falhas temporárias |
| Agendador | `/api/cron/instagram-publish` publica apenas o que está **agendado**. Rascunhos nunca são publicados sozinhos |
| Logs | `instagram_oauth_events` (cada etapa do OAuth) e logs estruturados de publicação, sempre sem token |

### O que foi corrigido/acrescentado

1. **Retorno do OAuth para o painel:** o callback só aceitava voltar para páginas `/instagram…`. Agora também aceita `/admin/meta-app-review`, continuando a recusar endereços externos (sem *open redirect*).
2. **Tela de conexão em inglês:** quando a conexão sai do painel em inglês, a tela de resultado mostra "Instagram connected successfully" e "Continue".
3. **Consultas de conferência na Graph API:** `GET /me` com os campos de `instagram_business_basic` e `GET /{media-id}` (id, permalink, data, tipo) para confirmar a publicação.
4. **Painel `/admin/meta-app-review`** com os 6 passos, checklist, diagnóstico, roteiro e textos de envio.

O OAuth existente já estava correto e testado (state, CSRF, cancelamento, conta diferente, token expirado, reconexão) e **não foi substituído**.

---

## 2. Antes de gravar (preparação, uma vez só)

### 2.1 Publicar o código
```
cd C:\Alilu\Utilitarios
npm run db:migrate
git add -A
git commit -m "Meta App Review: painel de demonstração do Instagram"
git push origin main
```
A migração `0057_meta_app_review.sql` só **cria** a tabela `meta_app_review_sessions`. Nada existente é alterado.

### 2.2 Conferir na Meta (developers.facebook.com › appalilu)
1. **App settings › Basic:** Privacy Policy `https://alilu.com.br/privacidade`, Terms `https://alilu.com.br/termos-de-uso`, Data deletion `https://alilu.com.br/exclusao-de-dados`, ícone 1024×1024, categoria e e-mail de contato.
2. **Use cases › Manage messaging & content on Instagram › API setup with Instagram login:**
   - permissões `instagram_business_basic` e `instagram_business_content_publish` adicionadas;
   - **Business login settings › OAuth redirect URIs:** `https://alilu.com.br/api/instagram/oauth/callback` (exatamente assim).
   - O **Instagram App ID / Secret** desta tela são os valores de `INSTAGRAM_APP_ID` / `INSTAGRAM_APP_SECRET` na Vercel. Eles são **diferentes** do App ID 1631956071610441 do app na Meta.
3. **Business Verification** concluída (normalmente exigida para Acesso Avançado).

### 2.3 Conta profissional de teste
1. Conta do Instagram **profissional** (Criador ou Empresa), sua, com conteúdo próprio.
2. Enquanto não houver Acesso Avançado, a conta precisa ter função no app: **App roles › Roles › Instagram Testers** → adicione o @usuário → aceite em Instagram › Configurações › Apps e sites › Convites de teste.
3. Uma conta do Alilu cujo e-mail esteja em `ADMIN_EMAILS` (é quem enxerga o painel).
4. Um vídeo **seu**, vertical 9:16, MP4, de 5 a 60 segundos.

### 2.4 Deixar a tela de permissões aparecer de novo
Se a conta já autorizou o Alilu antes, a Meta pode pular a lista de permissões. Para o vídeo mostrar tudo:
- Instagram › Configurações › **Apps e sites › Ativos › Alilu › Remover**;
- o botão **Connect Instagram** do painel já usa `force_reauth=true` (força novo login no Instagram).

---

## 3. O painel

Endereço: **`https://alilu.com.br/admin/meta-app-review?lang=en`**. Também aparece em **/admin › Instagram**. Só abre para e-mails em `ADMIN_EMAILS`; para os demais usuários, a página "não existe".

| Área | O que faz |
|---|---|
| Português / English | Troca toda a interface (botões, títulos, mensagens) |
| Start a new recording session | Zera o checklist. Só conta o que acontecer a partir desse clique |
| Step 1 — Sign in to Alilu | Orienta a começar desconectado e leva ao login real |
| Step 2 — Connect your Instagram account | **Connect Instagram** → OAuth real → tela oficial da Meta |
| Step 3 — Connected Instagram Account | **Retrieve account information from the API** → `GET /me` real; mostra só os campos devolvidos (usuário, ID, tipo, foto, status) |
| Step 4 — Create Instagram Content | Enviar ou escolher vídeo, prévia, legenda, conta, declaração; **Prepare publication** cria um **rascunho** no Agendador existente |
| Step 5 — Publish Instagram Reel | **Publish Reel** usa o publicador existente; mostra "Publishing in progress..." e **só** mostra "Reel published successfully." depois de a API confirmar |
| Step 6 — View Published Reel | ID, status, data e URL vindos da API + **View on Instagram** |
| Recording checklist | Itens técnicos marcados só com evidência real; itens humanos com botão "Confirm" |
| Permission diagnostics | Fluxo, App ID, ID da conta, status, expiração do token, última consulta, última publicação, último erro da Meta. Separa: solicitada / concedida pelo usuário / nível de acesso / aprovada (os dois últimos: "check in Meta for Developers") |
| Meta Review Recording Guide | Roteiro em inglês, com botões para copiar o roteiro e as legendas |
| App Review Submission | Descrição de cada permissão com **Copy Description** |

---

## 4. Passo a passo da gravação

**Configuração do vídeo:** 1080p, navegador em inglês se possível, zoom 110–125%, barra de endereço visível (a Meta precisa ver `instagram.com`), sem cortes no meio do fluxo, sem dados sensíveis.

**Antes de apertar REC:**
1. Abra `/admin/meta-app-review?lang=en`, clique em **Start a new recording session** e confira no diagnóstico: redirect URI correto e nenhum erro.
2. Remova o app Alilu do Instagram (item 2.4).
3. Saia do Alilu e abra uma **janela anônima**.

**Gravando:**

| # | Cena | Narração / legenda (inglês) | O que fazer na tela |
|---|---|---|---|
| 1 | Scene 1 — Alilu Login | "This is Alilu, a platform that allows users to create, schedule and publish content on their Instagram professional accounts." | Abrir `alilu.com.br/entrar`, fazer login, abrir `/admin/meta-app-review?lang=en` |
| 2 | Scene 2 — Instagram Authorization | "The user connects their own Instagram professional account and explicitly grants the requested permissions through the official Meta authorization flow." | Clicar em **Connect Instagram** → mostrar a URL instagram.com e a lista de permissões → **Allow** → "Instagram connected successfully" → **Continue** |
| 3 | Scene 3 — Account Information | "Alilu retrieves and displays the connected Instagram account information using the instagram_business_basic permission." | Clicar em **Retrieve account information from the API** e mostrar usuário, ID, tipo e foto |
| 4 | Scene 4 — Content Creation | "The user selects an original video and prepares the caption for an Instagram Reel." | Enviar o vídeo, mostrar a prévia, escrever a legenda, conferir a conta, marcar a declaração, **Prepare publication** |
| 5 | Scene 5 — Publishing | "Alilu uses the instagram_business_content_publish permission to publish the Reel on the connected Instagram account." | **Publish Reel** → continuar gravando durante "Publishing in progress..." → "Reel published successfully." |
| 6 | Scene 6 — Verification | "The application confirms the publication, and the user opens the Reel directly on Instagram." | Mostrar ID, status, data e URL → **View on Instagram** → mostrar o Reel no perfil |

**Depois de gravar:**
1. No checklist, confirme os itens manuais: *Alilu login shown*, *Reel viewed on Instagram* e *Recording reviewed and legible*. Todos os automáticos devem estar ✓.
2. Assista ao vídeo inteiro e confira se dá para ler os textos, se não houve cortes e se a URL do instagram.com aparece.
3. Acrescente as legendas em inglês (o botão **Copy subtitles** copia as 6 falas).

Se o Instagram ainda estiver processando o vídeo, o painel avisa e o botão **Publish Reel** pode ser clicado de novo. A mesma publicação é retomada, sem duplicar.

---

## 5. Como cada permissão aparece

| Permissão | Onde aparece | Evidência real |
|---|---|---|
| `instagram_business_basic` | Cenas 2 e 3 | Consentimento na tela oficial + `GET graph.instagram.com/me?fields=user_id,username,name,account_type,profile_picture_url,media_count` |
| `instagram_business_content_publish` | Cenas 4, 5 e 6 | `POST /{ig-user-id}/media` (REELS) → `status_code` → `POST /{ig-user-id}/media_publish` → `GET /{media-id}` com `permalink` → Reel aberto no Instagram |

## 6. Conferir a publicação
- **Painel (Step 6):** status `PUBLISHED`, ID e permalink vindos da API.
- **Instagram:** o Reel aparece no perfil da conta conectada.
- **/instagram/painel › Minhas publicações:** o mesmo registro aparece como publicado.

## 7. Desconectar e reconectar com segurança
- **Desconectar:** /instagram/painel › conta › Desconectar. Apaga o token só daquela conta; outras contas e agendamentos não são afetados.
- **Reconectar a mesma conta:** "Reconnect this account" no Step 3. O servidor confere o ID da conta antes de salvar e nunca troca de perfil sem você pedir.
- **Conectar do zero (para o vídeo):** remova o app no Instagram (2.4) e use **Connect Instagram**.

---

## 8. Reenviar a análise na Meta
1. developers.facebook.com › **appalilu** › **App Review › Permissions and features**.
2. Em `instagram_business_basic` e `instagram_business_content_publish`: **Request advanced access** (ou editar o envio recusado).
3. Cole as descrições do painel (**App Review Submission › Copy Description**), uma por permissão.
4. Envie o screencast novo. O mesmo vídeo serve para as duas permissões.
5. **Testing instructions** (exemplo):
   > 1. Go to https://alilu.com.br/entrar and sign in with: [e-mail] / [senha da conta de teste].
   > 2. Open https://alilu.com.br/admin/meta-app-review?lang=en.
   > 3. Click "Connect Instagram" and authorize with an Instagram professional account.
   > 4. Click "Retrieve account information from the API".
   > 5. Upload a video, write a caption, click "Prepare publication" and then "Publish Reel".
   > 6. Click "View on Instagram".

   A conta de teste do Alilu informada aqui precisa estar em `ADMIN_EMAILS` para o revisor abrir o painel.
6. Envie e acompanhe o status em App Review.

### Checklist do novo envio
- [ ] `npm run db:migrate` (0057) e deploy feitos
- [ ] Redirect URI `https://alilu.com.br/api/instagram/oauth/callback` cadastrado em *Business login settings*
- [ ] `INSTAGRAM_APP_ID` / `INSTAGRAM_APP_SECRET` = Instagram App ID / Secret (não o App ID 1631956071610441)
- [ ] Política de privacidade, termos, exclusão de dados, ícone e categoria preenchidos
- [ ] Business Verification concluída
- [ ] Conta profissional com função de Instagram Tester (convite aceito)
- [ ] App removido do Instagram antes de gravar (tela de permissões completa)
- [ ] Sessão de gravação iniciada; todos os itens automáticos ✓ ao final
- [ ] Vídeo mostra: login → instagram.com com permissões → Allow → conta conectada → dados da conta → vídeo + legenda → Publish → confirmação → Reel no Instagram
- [ ] Legendas em inglês
- [ ] Descrições coladas por permissão
- [ ] Testing instructions com uma conta do Alilu para o revisor

---

## 9. Testes

**Automatizados** (rede da Meta simulada; Postgres real em memória):
- `__tests__/lib/meta-app-review-pure.test.ts` cobre:
  - checklist: nada marcado sem evidência; eventos anteriores à sessão ignorados; permissão parcial, Facebook Login e publicação não confirmada não contam;
  - permissões nunca afirmadas como aprovadas;
  - textos em PT e EN;
  - retorno do OAuth sem *open redirect*;
  - `GET /me` (só os campos devolvidos; token inválido vira erro);
  - `GET /{media-id}` (permalink validado; ID inválido recusado).
- `__tests__/lib/meta-app-review-flow.test.ts` cobre:
  - fluxo completo com o publicador existente;
  - duplicidade: o segundo clique não republica;
  - processamento da Meta (`IN_PROGRESS` → retomada sem novo contêiner);
  - falha da Meta (`ERROR`) mostrada como falha, nunca como sucesso;
  - token expirado (código 190) e conta desconectada;
  - isolamento entre usuários; API só para administradores; nenhum token na resposta.
- `__tests__/components/meta-app-review-panel.test.tsx` cobre:
  - troca de idioma;
  - link do OAuth real;
  - "Publish Reel" bloqueado sem publicação preparada;
  - nenhum sucesso exibido antes da hora.
- **Já existentes e mantidos:** OAuth (start, callback, state/CSRF, cancelamento, conta diferente, token expirado), cliente da Graph API, upload de mídia e publicador.

**Manuais** (com conta autorizada; não são executados automaticamente):
1. Login em janela anônima.
2. Connect → tela oficial → Allow → volta com sucesso. No checklist: OAuth iniciado, autorização exibida, permissões concedidas e conta conectada.
3. Connect → **Cancel** na Meta → tela "cancelado", nada salvo.
4. Retrieve account information → campos reais.
5. Remover o app no Instagram e consultar de novo → erro da Meta em "Last Meta error"; reconectar resolve.
6. Enviar um arquivo que não é vídeo → recusado.
7. Prepare publication → rascunho, nada no Instagram.
8. Publish Reel → "Publishing in progress..." → "Reel published successfully." → Reel no perfil.
9. Clicar de novo em Publish → nenhum Reel duplicado.
10. View on Instagram abre o Reel.

---

## 10. Variáveis de ambiente
Nenhuma variável nova. As que o painel usa já existem: `INSTAGRAM_APP_ID`, `INSTAGRAM_APP_SECRET`, `INSTAGRAM_TOKEN_ENCRYPTION_KEY`, `AUTH_SECRET`, `NEXT_PUBLIC_SITE_URL` (ou `INSTAGRAM_OAUTH_REDIRECT_URI`), `ADMIN_EMAILS`, `DATABASE_URL` e as do Vercel Blob.

## 11. Pendências na Meta (fora do código)
- Acesso Avançado de `instagram_business_basic` e `instagram_business_content_publish`: depende da análise.
- Business Verification.
- Modo **Live** depois da aprovação.
- O nível de acesso e o status de aprovação **não podem ser consultados por esta API**; o painel mostra "check in Meta for Developers".
- A pesquisa por hashtag (Instagram Public Content Access, usada no Radar Viral) é **outro processo**, continua desligada e **não** entra neste envio.
