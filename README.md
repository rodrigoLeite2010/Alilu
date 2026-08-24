# ALILU

Plataforma de serviços de confiança para condomínios.

Fluxo inicial (MVP): **morador → encontra diarista → verifica disponibilidade → agenda → serviço é realizado → avalia.**

Condomínio de validação: **Monte Carlo**. O sistema nasce preparado para múltiplos condomínios.

> Status: **Etapa 0 — Fundação do projeto.** Nenhum módulo de negócio foi
> implementado ainda (ver `backend/src/Modules/*/README.md`). Este prompt
> apenas prepara solução, camadas e infraestrutura base.

## Stack

- **Backend:** ASP.NET Core (.NET 8) + C#, Entity Framework Core, PostgreSQL, JWT + Refresh Token
- **Mobile:** React Native + Expo + TypeScript (Android/iOS)

## Arquitetura

Modular Monolith (não microserviços). Uma única API organizada em módulos
independentes, cada um com separação entre Domain, Application e
Infrastructure. Módulos planejados: Identity, Condominium, Resident,
Professional, Scheduling, Reviews, Recommendations, Notifications,
Administration.

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
│       ├── BuildingBlocks/
│       │   └── Alilu.BuildingBlocks.Domain/   # Entity, AggregateRoot, ValueObject, DomainException
│       ├── Infrastructure/
│       │   └── Alilu.Infrastructure/          # DbContext raiz, configuração do EF Core + Npgsql
│       └── Modules/                 # um README por módulo, aguardando implementação
│           ├── Identity/
│           ├── Condominium/
│           ├── Resident/
│           ├── Professional/
│           ├── Scheduling/
│           ├── Reviews/
│           ├── Recommendations/
│           ├── Notifications/
│           └── Administration/
├── mobile/                          # app Expo (React Native + TypeScript)
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
> não puderam ser restaurados nem compilados aqui. O projeto
> `Alilu.BuildingBlocks.Domain` (sem dependências externas) foi compilado
> com sucesso. Na sua máquina, com internet normal, `dotnet restore` e
> `dotnet build` devem funcionar sem nenhuma alteração de código.

## Como rodar o mobile (Expo)

Pré-requisitos: [Node.js](https://nodejs.org/) e o app **Expo Go** no seu celular (ou emulador Android/iOS configurado).

```bash
cd mobile
npm install
npx expo start
```

Escaneie o QR code com o Expo Go, ou pressione `a`/`i` no terminal para
abrir em um emulador Android/iOS.

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

Conforme o PROMPT 00, esta etapa **não avança para o módulo Identity**.
Aguardando autorização para a próxima etapa.
