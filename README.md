# ALILU

Plataforma de serviços de confiança para condomínios.

Fluxo inicial (MVP): **morador → encontra diarista → verifica disponibilidade → agenda → serviço é realizado → avalia.**

Condomínio de validação: **Monte Carlo**. O sistema nasce preparado para múltiplos condomínios.

> Status: **Etapa 15 — Docker e ambiente.** Backend com os 9 módulos
> implementados (Identity → Administration, Etapas 03-12), auditado
> tecnicamente (Etapa 14) e agora preparado para desenvolvimento e deploy
> (Docker, ambientes Development/Staging/Production, configurações
> externalizadas, health check real — ver "Etapa 15" em
> `backend/ARCHITECTURE.md` para o detalhe completo). Histórico completo
> de cada etapa em `backend/ARCHITECTURE.md` e `backend/src/Modules/*/README.md`.

## Stack

- **Backend:** ASP.NET Core (.NET 8) + C#, Entity Framework Core, PostgreSQL, JWT + Refresh Token
- **Mobile:** React Native + Expo + TypeScript (Android/iOS)

## Arquitetura

Modular Monolith (não microserviços). Uma única API organizada em módulos
independentes, cada um em três projetos .csproj (Domain, Application,
Infrastructure). Módulos: Identity, Condominium, Resident, Professional,
Scheduling, Reviews, Recommendations, Notifications, Administration.

Detalhes das regras de dependência entre camadas/módulos, diagrama e
verificação automática: ver [`backend/ARCHITECTURE.md`](backend/ARCHITECTURE.md).

## Estrutura de pastas

```
Alilu/
├── backend/
│   ├── Alilu.sln
│   ├── Directory.Build.props        # configurações comuns (TargetFramework, Nullable, etc.)
│   ├── .editorconfig
│   ├── docker-compose.yml           # PostgreSQL local
│   └── src/
│       ├── Api/
│       │   └── Alilu.Api/           # host ASP.NET Core (composição raiz)
│       ├── Shared/
│       │   └── Alilu.Shared/                  # Entity, AggregateRoot, ValueObject, DomainException
│       ├── Infrastructure/
│       │   └── Alilu.Infrastructure/          # DbContext raiz, configuração do EF Core + Npgsql
│       └── Modules/                 # Domain/Application/Infrastructure por módulo (9 módulos implementados, Etapas 03-12)
│           ├── Identity/{Domain,Application,Infrastructure}/
│           ├── Condominium/{Domain,Application,Infrastructure}/
│           ├── Resident/{Domain,Application,Infrastructure}/
│           ├── Professional/{Domain,Application,Infrastructure}/
│           ├── Scheduling/{Domain,Application,Infrastructure}/
│           ├── Reviews/{Domain,Application,Infrastructure}/
│           ├── Recommendations/{Domain,Application,Infrastructure}/
│           ├── Notifications/{Domain,Application,Infrastructure}/
│           └── Administration/{Domain,Application,Infrastructure}/
├── mobile/                          # app Expo (React Native + TypeScript) — morador/profissional
├── admin-web/                       # painel administrativo web (Vite + React + TypeScript) — Etapa 12
└── docs/
```

## Como rodar o backend

Pré-requisitos: [.NET 8 SDK](https://dotnet.microsoft.com/download/dotnet/8.0) e Docker (para o PostgreSQL local).

```bash
# 1. Subir o PostgreSQL local
cd backend
docker compose up -d

# 2. Restaurar pacotes e compilar
dotnet restore
dotnet build

# 3. Rodar a API
dotnet run --project src/Api/Alilu.Api
```

A API sobe (por padrão) em `http://localhost:5205` (perfil `http` definido em
`src/Api/Alilu.Api/Properties/launchSettings.json`), em ambiente
`Development` (`ASPNETCORE_ENVIRONMENT`, ver "Ambientes" abaixo). Endpoints
sempre disponíveis:

- `GET /` — informações básicas da aplicação
- `GET /health` — health check (Etapa 15): verifica de verdade a conexão
  com o PostgreSQL, não só devolve "healthy" sempre. Resposta:
  `{ "status": "Healthy"|"Unhealthy", "durationMs": ..., "checks": [{ "name": "database", "status": "...", "description": "...", "durationMs": ... }] }`.
  Se o `docker compose up -d` do passo 1 não tiver sido feito (ou o
  Postgres ainda não aceitar conexões), este endpoint devolve `Unhealthy`
  em vez de erro 500.

> **Antes de rodar pela primeira vez:** a aplicação recusa subir se
> `Jwt:Secret` estiver vazio (guarda adicionada na Etapa 15) — em
> desenvolvimento local, `appsettings.Development.json` já tem um valor
> de exemplo pronto, então nenhuma ação extra é necessária. Em qualquer
> outro ambiente, defina `Jwt__Secret` como variável de ambiente antes de
> rodar (ver "Variáveis de ambiente" abaixo).

> **Nota sobre este ambiente de desenvolvimento (sandbox Claude):** este
> container de build não tem acesso à internet/NuGet.org, então os pacotes
> `Microsoft.EntityFrameworkCore`, `Npgsql.EntityFrameworkCore.PostgreSQL` e
> `Microsoft.EntityFrameworkCore.Design` (usados em `Alilu.Infrastructure`)
> não puderam ser restaurados nem compilados aqui. Todos os outros 28
> projetos da solução (`Alilu.Shared` + os 27 projetos de módulo, que não
> têm nenhum pacote NuGet externo) foram compilados aqui com sucesso. Na
> sua máquina, com internet normal, `dotnet restore` e `dotnet build`
> devem funcionar sem nenhuma alteração de código — e já funcionaram após
> a Etapa 00.

## Ambientes (Development / Staging / Production)

O backend segue a convenção padrão do ASP.NET Core: `ASPNETCORE_ENVIRONMENT`
escolhe qual `appsettings.{Environment}.json` é mesclado por cima de
`appsettings.json` (o arquivo base, com todo valor sensível vazio de
propósito). **Nenhum segredo de ambiente real (Staging/Production) fica
commitado no repositório** — o único valor de segredo presente em algum
desses arquivos é o de `appsettings.Development.json`, e mesmo esse é só
um valor de desenvolvimento local, sem uso fora da sua máquina.

| Ambiente | Arquivo | Observação |
|---|---|---|
| Development | `appsettings.Development.json` | Único com segredo de verdade — mas só um valor de desenvolvimento local, sem uso fora da sua máquina (comentário no próprio arquivo). Padrão ao rodar `dotnet run` sem definir `ASPNETCORE_ENVIRONMENT`. |
| Staging | `appsettings.Staging.json` | `ConnectionStrings:AliluDatabase` e `Jwt:Secret` vazios — defina por variável de ambiente/gerenciador de segredos no servidor de Staging. |
| Production | `appsettings.Production.json` | Mesma regra do Staging — nunca preencha estes valores no arquivo. |

Para rodar localmente como Staging/Production (só para testar a
configuração, não para "fazer deploy"):

```bash
ASPNETCORE_ENVIRONMENT=Staging \
Jwt__Secret="um-valor-qualquer-de-teste-local" \
ConnectionStrings__AliluDatabase="Host=localhost;Port=5433;Database=alilu;Username=alilu;Password=alilu" \
dotnet run --project src/Api/Alilu.Api
```

(Sem `Jwt__Secret` definido, a aplicação recusa subir — guarda adicionada
na Etapa 15, ver "Como rodar o backend" acima.)

## Como rodar o mobile (Expo)

Pré-requisitos: [Node.js](https://nodejs.org/) e o app **Expo Go** no seu celular (ou emulador Android/iOS configurado).

```bash
cd mobile
npm install
npx expo start
```

Escaneie o QR code com o Expo Go, ou pressione `a`/`i` no terminal para
abrir em um emulador Android/iOS.

> **Nota:** o projeto usa um `.npmrc` com `legacy-peer-deps=true` — algumas
> dependências transitivas do `expo-router` (suporte web) ainda têm
> conflitos de peer dependency não resolvidos pelo ecossistema. Isso é
> aplicado automaticamente pelo `npm install`, nenhuma flag extra é
> necessária.

**Stack de navegação e arquitetura (Etapa 02):** Expo Router (rotas em
`src/app`), com 4 stacks preparados — `(auth)`, `(resident)`,
`(professional)`, `(administration)` — hoje só com telas placeholder.
Arquitetura preparada (instalada, sem uso de negócio ainda) para TanStack
Query, Axios, Zustand, React Hook Form + Zod, Expo Secure Store e Expo
Notifications. Detalhes em [`mobile/src/README.md`](mobile/src/README.md).

Scripts disponíveis:

```bash
npm run lint        # ESLint (eslint-config-expo)
npm run typecheck    # tsc --noEmit
npm start            # expo start
```

### Configuração por ambiente (Etapa 15)

A URL da Api **nunca é fixa no código** — `src/services/api.ts` sempre lê
`process.env.EXPO_PUBLIC_API_URL` (o fallback `http://localhost:5205`
existe só para rodar sem nenhuma configuração, em desenvolvimento local).

Para desenvolvimento local, copie `mobile/.env.example` para `.env` (ou
`.env.local`) e ajuste se a Api não estiver em `localhost:5205`:

```bash
cd mobile
cp .env.example .env
```

Para builds (`eas build`), `mobile/eas.json` já define os 3 perfis
pedidos — `development`/`staging`/`production` — cada um injetando
`EXPO_PUBLIC_API_URL` automaticamente (convenção oficial do EAS Build para
ambientes nomeados). Os valores de `staging`/`production` em `eas.json`
são **placeholders** (`https://api-staging.alilu.com.br` /
`https://api.alilu.com.br`) — ainda não existe uma Api publicada nesses
ambientes; troque pela URL real assim que ela existir.

## Como criar build Android (EAS)

Pré-requisitos (passos manuais únicos, feitos pelo desenvolvedor — nunca
executados automaticamente por aqui):

```bash
npm install -g eas-cli   # ou: npx eas-cli (sem instalar globalmente)
eas login
cd mobile
eas init                 # cria/associa o projeto no EAS, grava o projectId em app.json
```

`mobile/app.json` ainda não tem `expo.android.package` definido (o
identificador do app, ex.: `com.alilu.app`) — é uma decisão de produto/
identidade do app, não algo que deva ser inventado aqui; defina-o antes do
primeiro build real (`eas build:configure` ajuda a preencher isso).

Com isso feito, o build em si usa os perfis já preparados em `eas.json`:

```bash
eas build --platform android --profile development   # .apk, cliente de desenvolvimento
eas build --platform android --profile staging        # .apk, ambiente de homologação
eas build --platform android --profile production      # .aab, para a Play Store
```

Nenhum destes comandos foi executado neste projeto — preparação de
configuração apenas, conforme pedido ("Não fazer deploy automaticamente").

## Como rodar o admin-web

Painel administrativo web (Etapa 12) — **não é o app mobile**: uso
exclusivo de `CondominiumAdmin`/`SuperAdmin` (moradores e profissionais
continuam usando só o app Expo).

Pré-requisitos: [Node.js](https://nodejs.org/) e o backend rodando
localmente (ver "Como rodar o backend" acima).

```bash
cd admin-web
npm install
cp .env.example .env.local   # ajuste VITE_API_URL se a Api não estiver em localhost:5205
npm run dev
```

Abre em `http://localhost:5173`. Para gerar o build de produção:

```bash
npm run build      # gera admin-web/dist
npm run preview    # serve o build gerado, localmente
```

> **Importante — CORS:** o backend só aceita chamadas de browser vindas de
> origens listadas em `Cors:AdminWebOrigins`
> (`backend/src/Api/Alilu.Api/appsettings*.json`). Em desenvolvimento,
> `http://localhost:5173` já vem liberado por padrão
> (`appsettings.Development.json`); em produção, adicione a URL real do
> admin-web publicado em `appsettings.json` (ou variável de ambiente
> equivalente).

> **⚠️ Pendência operacional antes do primeiro login:** não existe seed de
> `CondominiumAdmin` — um `SuperAdmin` precisa primeiro vincular um usuário
> a um condomínio via
> `POST /api/admin/condominium-administrators { "userId": "...", "condominiumId": "..." }`
> (ver `backend/src/Modules/Administration/README.md`). Sem isso, um
> usuário com papel `CondominiumAdmin` faz login mas não enxerga nenhum
> condomínio no seletor do painel.

Scripts disponíveis:

```bash
npm run dev       # servidor de desenvolvimento (Vite)
npm run build     # tsc -b && vite build
npm run lint      # oxlint
npm run preview   # serve o build de produção localmente
```

## Banco de dados

PostgreSQL, identificadores em UUID, datas armazenadas em UTC.

### Como executar migrations

Estado real na máquina do desenvolvedor (este sandbox não tem acesso a
`dotnet ef` — sem internet para restaurar a ferramenta): dos 9 módulos,
só **Identity, Condominium e Resident** têm migration gerada; os outros 6
(Professional, Scheduling, Reviews, Recommendations, Notifications,
Administration) têm o mapeamento EF Core completo e correto, só faltando
gerar a migration — comandos exatos em `backend/ARCHITECTURE.md`,
"Etapa 14" (seção de índices/FKs/constraints).

Aplicar as migrations já existentes (depois de `docker compose up -d`):

```bash
cd backend
dotnet ef database update \
  --project src/Infrastructure/Alilu.Infrastructure --startup-project src/Api/Alilu.Api
```

Gerar uma migration nova, depois de mudar o mapeamento de um módulo:

```bash
dotnet ef migrations add NomeDaMigration \
  --project src/Infrastructure/Alilu.Infrastructure --startup-project src/Api/Alilu.Api
```

(Requer a ferramenta `dotnet-ef`: `dotnet tool install --global dotnet-ef` se ainda não tiver.)

## Variáveis de ambiente

Nenhum segredo fica no código, em nenhum dos três projetos — resumo de
onde cada configuração vem:

| Projeto | Variável | Obrigatória? | Onde/como definir |
|---|---|---|---|
| Backend | `ConnectionStrings__AliluDatabase` | Sim, fora de Development | Env var, ou `ConnectionStrings:AliluDatabase` no appsettings (só Development tem valor real) |
| Backend | `Jwt__Secret` | Sim, sempre | Env var/user-secrets/gerenciador de segredos — a aplicação recusa subir se vazio (Etapa 15) |
| Backend | `Jwt__Issuer`, `Jwt__Audience` | Não | Default `"Alilu"`, raramente precisa mudar |
| Backend | `Auth__RefreshTokenLifetimeDays` | Não | Default 30 dias (Etapa 15) |
| Backend | `PushNotification__ExpoAccessToken` | Não | Só se o projeto Expo tiver "enhanced push security" habilitado (Etapa 15) |
| Backend | `Cors__AdminWebOrigins__0` (e `__1`, `__2`...) | Sim, fora de Development | Origem(ns) real(is) do admin-web publicado |
| Backend | `ASPNETCORE_ENVIRONMENT` | Não | `Development` (padrão)/`Staging`/`Production` — escolhe o `appsettings.{Environment}.json` |
| Mobile | `EXPO_PUBLIC_API_URL` | Não (tem fallback de dev) | `.env`/`.env.local` local, ou o bloco `env` de cada perfil em `eas.json` para builds |
| admin-web | `VITE_API_URL` | Não (tem fallback de dev) | `.env.local` (ver `admin-web/.env.example`) |

## Regras de negócio importantes (para lembrar nas próximas etapas)

- O sistema é **multi-condomínio** desde o início.
- Um profissional **não é morador** só porque atende o condomínio.
- O vínculo do morador é uma associação (morador ↔ condomínio ↔ unidade).
- O profissional tem associação com os condomínios que atende.
- Histórico de atendimento de um profissional em um condomínio deve vir
  de dados reais do sistema (agendamentos concluídos), nunca inferido.

## Próxima etapa

Etapa 15 (Docker e ambiente) concluída — aguardando validação e o próximo
PROMPT numerado antes de qualquer nova etapa.
