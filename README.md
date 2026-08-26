# ALILU

Plataforma de serviços de confiança para condomínios.

Fluxo inicial (MVP): **morador → encontra diarista → verifica disponibilidade → agenda → serviço é realizado → avalia.**

Condomínio de validação: **Monte Carlo**. O sistema nasce preparado para múltiplos condomínios.

> Status: **Etapa 01 — Backend modular.** Todos os 9 módulos já existem
> como projetos .csproj (Domain/Application/Infrastructure), com as regras
> de dependência entre camadas aplicadas e verificadas — mas **nenhuma
> entidade ou regra de negócio foi implementada ainda** (ver
> `backend/ARCHITECTURE.md` e `backend/src/Modules/*/README.md`).

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
│       └── Modules/                 # Domain/Application/Infrastructure por módulo (sem entidades ainda)
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
`src/Api/Alilu.Api/Properties/launchSettings.json`). Endpoints disponíveis
nesta etapa:

- `GET /` — informações básicas da aplicação
- `GET /health` — health check

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

- PostgreSQL, identificadores em UUID, datas armazenadas em UTC.
- Ainda não há migrations do EF Core: nenhuma entidade de módulo foi
  criada nesta etapa. As migrations começarão junto com o primeiro
  módulo (Identity).

## Regras de negócio importantes (para lembrar nas próximas etapas)

- O sistema é **multi-condomínio** desde o início.
- Um profissional **não é morador** só porque atende o condomínio.
- O vínculo do morador é uma associação (morador ↔ condomínio ↔ unidade).
- O profissional tem associação com os condomínios que atende.
- Histórico de atendimento de um profissional em um condomínio deve vir
  de dados reais do sistema (agendamentos concluídos), nunca inferido.

## Próxima etapa

Conforme o PROMPT 01, esta etapa **não implementa o módulo Identity nem o
módulo Condominium**. Aguardando autorização para a próxima etapa.
