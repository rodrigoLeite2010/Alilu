# ALILU — Painel Administrativo (admin-web)

Painel web administrativo do ALILU — implementado na **Etapa 12** (PROMPT
12). Uso exclusivo de `CondominiumAdmin` (administra o próprio condomínio)
e `SuperAdmin` (administra todos). **Não é o app do morador/profissional**
— esse é o `mobile/` (Expo/React Native); moradores e profissionais nunca
usam este painel.

Ver [`backend/ARCHITECTURE.md`](../backend/ARCHITECTURE.md), seção "Etapa
12 — administração (Administration)", para o design completo (autorização
por escopo, endpoints consumidos, decisões de composição).

## Stack

- [Vite](https://vitejs.dev/) + [React 19](https://react.dev/) + TypeScript
- [react-router-dom](https://reactrouter.com/) v7 (rotas)
- [axios](https://axios-http.com/) (cliente HTTP, com renovação automática de token)

## Como rodar

Pré-requisitos: [Node.js](https://nodejs.org/) e o backend ALILU rodando
localmente (ver [`../README.md`](../README.md), "Como rodar o backend").

```bash
npm install
cp .env.example .env.local   # ajuste VITE_API_URL se a Api não estiver em localhost:5205
npm run dev
```

Abre em `http://localhost:5173`.

```bash
npm run build     # tsc -b && vite build — gera dist/
npm run preview   # serve o build de produção localmente
npm run lint       # oxlint
```

> **CORS:** o backend só aceita chamadas de browser vindas de origens
> listadas em `Cors:AdminWebOrigins`
> (`backend/src/Api/Alilu.Api/appsettings*.json`). Em desenvolvimento,
> `http://localhost:5173` já vem liberado por padrão. Em produção, adicione
> a URL real deste painel publicado em `appsettings.json`.

> **⚠️ Pendência operacional antes do primeiro login:** não existe seed de
> `CondominiumAdmin`. Um `SuperAdmin` precisa primeiro vincular um usuário
> a um condomínio via
> `POST /api/admin/condominium-administrators { "userId": "...", "condominiumId": "..." }`
> (ver [`backend/src/Modules/Administration/README.md`](../backend/src/Modules/Administration/README.md)).
> Sem isso, o login funciona mas o seletor de condomínio fica vazio e
> nenhuma tela mostra dados.

## Autenticação e autorização

Mesmo backend/JWT do app mobile (`POST /api/auth/login`), mas com uma
checagem extra: no login (e na renovação automática de token), se o papel
do usuário não for `CondominiumAdmin` nem `SuperAdmin`, o painel revoga o
par de tokens e recusa a sessão — um morador ou profissional com
credenciais válidas não consegue abrir este painel. Token de acesso fica
só em memória; o token de renovação fica em `localStorage`
(`src/utils/webStorage.ts`).

## Escopo por condomínio

`CondominiumScopeProvider` (`src/modules/condominium/CondominiumScopeContext.tsx`)
carrega `GET /api/admin/condominiums` ao entrar: um `CondominiumAdmin`
sempre recebe exatamente um item (seleção automática, sem seletor visível);
um `SuperAdmin` recebe todos e escolhe pelo seletor no cabeçalho. O
`condominiumId` escolhido aqui é só uma conveniência de navegação — quem
decide de verdade o que cada admin pode ver/alterar é sempre o backend,
resolvendo o escopo a partir do usuário autenticado (nunca confiando no que
o frontend envia).

## Estrutura

```
src/
├── services/       # api.ts (axios + interceptors), authTokenStore.ts
├── utils/          # webStorage.ts (localStorage)
├── modules/
│   ├── auth/               # login, AuthProvider, tipos
│   ├── administration/     # dashboard, administradores de condomínio
│   ├── condominium/        # unidades, CondominiumScopeContext
│   ├── resident/           # moradores (memberships)
│   ├── professional/       # profissionais (vínculo com condomínio)
│   └── recommendations/    # recomendações
├── components/     # Layout, ProtectedRoute, CondominiumPicker, StatusBadge
└── pages/          # LoginPage, DashboardPage, MoradoresPage, UnidadesPage,
                     # ProfissionaisPage, RecomendacoesPage
```

## Páginas

- **Login** — autenticação (só `CondominiumAdmin`/`SuperAdmin`).
- **Dashboard** — contagens do condomínio selecionado (moradores, unidades,
  profissionais, agendamentos, solicitações pendentes, recomendações
  pendentes).
- **Moradores** — listar, visualizar, aprovar, rejeitar, bloquear vínculos.
- **Unidades** — criar, editar, bloquear, visualizar morador vinculado.
- **Profissionais** — aprovar, rejeitar, bloquear, associar diretamente ao
  condomínio, visualizar histórico de atendimentos.
- **Recomendações** — aprovar, rejeitar, bloquear.
