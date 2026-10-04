# Instagram / Meta em produção — passo a passo

O Alilu usa **Instagram API with Instagram Login** ("Business Login for Instagram"): a pessoa entra **direto pelo Instagram**, sem Facebook e sem Página. Toda a configuração no código fica em `lib/instagram/backend/instagram-oauth-config.ts`.

## Por que aparece "Função de desenvolvedor é insuficiente"

O erro em inglês é "Insufficient developer role". A Meta mostra essa mensagem na **própria tela dela**, antes de voltar para o Alilu, quando duas coisas acontecem juntas:

1. O app está em **modo Desenvolvimento** (ou as permissões ainda estão só com **Acesso Padrão**);
2. A conta do Instagram que tentou entrar **não tem função no app** (administrador, desenvolvedor ou testador do Instagram).

No computador funciona porque você entra com a conta que tem função no app. No celular, o app do Instagram costuma estar logado em **outra conta**, e por isso o erro aparece. **Código nenhum contorna isso.** A solução é colocar o app em produção, seguindo os passos abaixo.

## Fluxo

| Etapa | Endereço |
|---|---|
| Botão "Conectar Instagram" | `GET /api/instagram/oauth/start?returnTo=/instagram/...` |
| Tela oficial | `https://www.instagram.com/oauth/authorize` (redirect normal, sem popup) |
| Volta da Meta (redirect_uri) | `https://alilu.com.br/api/instagram/oauth/callback` |
| Tela de resultado | `/instagram/conectado?resultado=sucesso\|cancelado\|conta-nao-profissional\|sem-permissao\|sessao\|expirado\|erro` |
| Diagnóstico (admin) | `/admin/instagram` |

## Permissões pedidas (só o necessário)

| Permissão | Para quê |
|---|---|
| `instagram_business_basic` | Identificar a conta (id, @usuário, tipo de conta). Obrigatória. |
| `instagram_business_content_publish` | Publicar post, carrossel, Reels e Stories (Agendador e Piloto Automático). |

**Não** pedimos `instagram_business_manage_messages` nem `instagram_business_manage_comments`, porque o Alilu não usa.

## Passo a passo no Meta Developers

> Os nomes dos menus mudam de vez em quando. Se algum não bater exatamente, procure pelo termo em negrito.

### 1. Configurações básicas

Vá em **App settings › Basic** (Configurações do app › Básico) e preencha:

- **Privacy Policy URL:** `https://alilu.com.br/privacidade`
- **Terms of Service URL:** `https://alilu.com.br/termos-de-uso`
- **User data deletion › Data deletion instructions URL:** `https://alilu.com.br/exclusao-de-dados`
- **App domains:** `alilu.com.br`
- **App icon** (1024×1024), **Category** (ex.: Business and pages) e **Contact email**.

### 2. Login do Instagram

Vá em **Use cases** (Casos de uso) › **Manage messaging & content on Instagram** › **API setup with Instagram login**.

1. Confirme que as permissões `instagram_business_basic` e `instagram_business_content_publish` estão adicionadas.
2. Em **Set up Instagram business login › Business login settings**, configure:
   - **OAuth redirect URIs:** `https://alilu.com.br/api/instagram/oauth/callback`. Precisa ser **exatamente** isso: sem `www`, sem barra no fim e com https. Se quiser testar localmente, adicione também `http://localhost:3000/api/instagram/oauth/callback`.
   - **Deauthorize callback URL** e **Data deletion request URL:** se o campo for obrigatório, use `https://alilu.com.br/exclusao-de-dados`.
3. Anote o **Instagram App ID** e o **Instagram App Secret** dessa tela. São eles que vão em `INSTAGRAM_APP_ID` e `INSTAGRAM_APP_SECRET`, e não o App ID do Facebook.

### 3. Verificação da empresa

Vá em **Business Verification** (Verificação da empresa), pelo Meta Business Suite ou pelo painel do app.

- Envie o CNPJ e um comprovante de endereço e telefone.
- Para servir contas que **não são suas**, a Meta exige **Acesso Avançado**, e o Acesso Avançado normalmente exige empresa verificada.

### 4. App Review: Acesso Avançado

Vá em **App Review › Permissions and features**. Peça **Advanced Access** para:

- `instagram_business_basic`
- `instagram_business_content_publish`

Para cada permissão, a Meta pede:

- **Descrição de uso** (exemplo: "O Alilu permite que criadores e empresas agendem e publiquem posts, carrosséis, Reels e Stories na própria conta profissional do Instagram. Usamos instagram_business_basic para identificar a conta conectada e instagram_business_content_publish para publicar o conteúdo que o usuário cria e agenda no Alilu.");
- **Screencast** mostrando o fluxo completo:
  1. login no Alilu;
  2. toque em "Conectar Instagram";
  3. tela de autorização;
  4. volta para "Instagram conectado ✓";
  5. criação de um post;
  6. publicação aparecendo no Instagram.
- **Instruções de teste:** uma conta do Alilu para o revisor e, se pedirem, uma conta de Instagram de teste.

Até a aprovação, só contas com função no app conseguem conectar (passo 6).

### 5. Colocar em produção

No topo do painel, mude **App Mode: Development → Live** (ou clique em **Publish**). O modo Live exige os itens do passo 1 preenchidos.

### 6. Testar antes da aprovação

Vá em **App roles › Roles › Instagram Testers** e adicione o @usuário.

A pessoa precisa **aceitar** o convite no Instagram, em **Configurações › Apps e sites › Convites de teste** (no navegador: instagram.com › Configurações › Apps e sites).

> Ao testar pelo celular, confira em qual conta o app do Instagram está logado. Precisa ser a conta testadora.

## Variáveis de ambiente (Vercel)

| Variável | Obrigatória | Valor |
|---|---|---|
| `INSTAGRAM_APP_ID` | sim | Instagram App ID (passo 2.3) |
| `INSTAGRAM_APP_SECRET` | sim | Instagram App Secret |
| `INSTAGRAM_TOKEN_ENCRYPTION_KEY` | sim (já existe) | chave AES dos tokens |
| `AUTH_SECRET` | sim (já existe) | também assina o `state` do OAuth |
| `NEXT_PUBLIC_SITE_URL` | recomendado | `https://alilu.com.br`. Define o redirect_uri de produção. |
| `INSTAGRAM_OAUTH_REDIRECT_URI` | não | só para forçar outro redirect_uri (ex.: domínio de homologação) |
| `INSTAGRAM_OAUTH_STATE_SECRET` | não | segredo próprio para o `state`; se vazio, usa `AUTH_SECRET` |

Rode também `npm run db:migrate` para aplicar a `0025_instagram_oauth_events.sql`, que guarda o diagnóstico do login.

## Segurança

- **State:** 24 bytes aleatórios, com validade de 10 minutos.
  - É assinado com HMAC e preso ao usuário do Alilu que começou o fluxo.
  - Também fica guardado num cookie HttpOnly, `SameSite=Lax`, válido só no caminho `/api/instagram/oauth`.
- **Domínio:** o fluxo inteiro roda no domínio do redirect_uri. Quem entra por `www.alilu.com.br` é levado para `alilu.com.br` antes de começar, para não perder o cookie.
- **Token:** a troca do code por token acontece só no servidor.
  - O token de 60 dias é guardado **cifrado**, nunca vai na URL e nunca vai para o navegador.
  - Os logs nunca registram token, code nem state.
- **Renovação:** o cron do agendador (`/api/cron/instagram-publish`) renova os tokens que estão a menos de 15 dias de vencer.
  - Segue a regra da Meta: o token precisa ter ao menos 24 h e ainda estar válido.
  - Se a Meta recusar a renovação (erro 190), a conta vira "expirada" e a tela pede para reconectar.
- **Desconectar:** apaga o token na hora (`DELETE /api/instagram/account`). Publicações e automações ficam guardadas, mas não publicam até reconectar.

## Logs

Os logs aparecem na Vercel com o prefixo `[InstagramOAuth]`:

- Iniciando autenticação
- Callback recebido
- State válido; authorization code recebido
- Token obtido
- Conta Instagram encontrada
- Integração concluída

Em caso de erro, o log traz `error`, `errorCode`, `errorSubcode`, `errorType` e `errorMessage`. A mesma informação aparece em `/admin/instagram`, em "Últimos erros".

## Checklist de produção

- [ ] Instagram App ID e Secret na Vercel (os do **Instagram**, não os do Facebook)
- [ ] Redirect URI `https://alilu.com.br/api/instagram/oauth/callback` cadastrado exatamente assim
- [ ] Privacy, Terms e Data deletion URLs preenchidas; ícone e categoria
- [ ] Verificação da empresa aprovada
- [ ] Acesso Avançado aprovado para as 2 permissões
- [ ] App em **Live**
- [ ] `npm run db:migrate` (0025)
- [ ] `/admin/instagram` todo ✓ depois de conectar a sua conta
- [ ] Teste com uma conta que **não** tem função no app (celular Android e iPhone)
