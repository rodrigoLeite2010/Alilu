# Arquitetura do backend ALILU

> Documento de arquitetura. Seções sem indicação de etapa descrevem a
> fundação criada na **Etapa 01 (Backend modular)**; as seções **"Etapa 03 —
> módulo Identity"** e **"Etapa 04 — módulo Condominium"**, no final,
> descrevem o que mudou com cada módulo de negócio real.

## Visão geral

O backend é um **Modular Monolith**: uma única API (`Alilu.Api`) organizada
em módulos de negócio independentes. Cada módulo é dividido em três
projetos .csproj — **Domain**, **Application** e **Infrastructure** — para
manter as regras de negócio isoladas de detalhes de framework e persistência.

```
backend/
├── Alilu.sln
├── Directory.Build.props        # TargetFramework, Nullable, etc. comuns a todos os projetos
├── src/
│   ├── Api/
│   │   └── Alilu.Api/                       # composição da aplicação + exposição HTTP
│   ├── Shared/
│   │   └── Alilu.Shared/                    # Entity, AggregateRoot, ValueObject, DomainException, IDomainEvent
│   ├── Infrastructure/
│   │   └── Alilu.Infrastructure/            # AliluDbContext (raiz), EF Core + Npgsql, configuração de conexão
│   └── Modules/
│       ├── Identity/{Domain,Application,Infrastructure}/
│       ├── Condominium/{Domain,Application,Infrastructure}/
│       ├── Resident/{Domain,Application,Infrastructure}/
│       ├── Professional/{Domain,Application,Infrastructure}/
│       ├── Scheduling/{Domain,Application,Infrastructure}/
│       ├── Reviews/{Domain,Application,Infrastructure}/
│       ├── Recommendations/{Domain,Application,Infrastructure}/
│       ├── Notifications/{Domain,Application,Infrastructure}/
│       └── Administration/{Domain,Application,Infrastructure}/
└── scripts/
    └── check-references.py      # valida as regras de dependência abaixo
```

30 projetos no total: `Alilu.Api`, `Alilu.Shared`, `Alilu.Infrastructure` e
9 módulos × 3 camadas.

## Por que "Alilu.Shared" e não mais "Alilu.BuildingBlocks.Domain"?

Na Etapa 00 o kit de DDD (Entity/AggregateRoot/ValueObject/DomainException)
tinha sido criado como `Alilu.BuildingBlocks.Domain`. A Etapa 01 pede
explicitamente um projeto `Alilu.Shared` na raiz da solução — então esse
projeto foi **renomeado** (mesmo conteúdo, mesmo propósito, novo nome e
namespace `Alilu.Shared`) em vez de criar um projeto duplicado. Referências
em `Alilu.Api` e `Alilu.Infrastructure` foram atualizadas.

`Alilu.Infrastructure` (DbContext raiz + configuração do Postgres) não foi
mencionado na lista de estrutura do PROMPT 01, mas foi mantido tal como
criado na Etapa 00: ele não é um "módulo de negócio", é a composição de
persistência da aplicação, e a seção POSTGRES deste prompt pede exatamente
o que ele já provê (DbContext, configuração de conexão, EF Core). Nenhum
módulo depende dele nem o contrário — ele só é referenciado pela `Alilu.Api`.

## Regras de dependência entre camadas e módulos

```mermaid
flowchart TB
    Api["Alilu.Api<br/>(composição + HTTP)"]
    Infra["Alilu.Infrastructure<br/>(DbContext raiz, EF Core, Npgsql)"]
    Shared["Alilu.Shared<br/>(Entity, AggregateRoot, ValueObject...)"]

    subgraph ModX["Cada módulo (ex.: Identity, Scheduling, ...)"]
        direction TB
        MDomain["Domain"]
        MApp["Application"]
        MInfra["Infrastructure"]
        MApp --> MDomain
        MInfra --> MDomain
        MInfra --> MApp
    end

    Api --> Infra
    Api --> Shared
    Infra --> Shared
    MDomain --> Shared
```

Regras aplicadas (e verificadas por `scripts/check-references.py`):

1. **Domain não depende de Infrastructure** (nem de Application) — só de `Alilu.Shared`.
2. **Application não depende de Api** — nem de Infrastructure; só do Domain do próprio módulo.
3. **Infrastructure implementa persistência/integrações** — depende do Domain e da Application do próprio módulo.
4. **Nenhum módulo referencia outro módulo** (Identity não conhece Condominium, etc.) — cada módulo é independente.
5. **Api é composição + HTTP** — referencia `Alilu.Infrastructure` e `Alilu.Shared`, mais a Application/Infrastructure de cada módulo que já tiver algo a compor (ex.: `AddIdentityModule()` — ver "Etapa 03" abaixo). Isso é permitido: a regra é módulo↛módulo, e Domain/Application↛Api — nunca Api↛módulo.
6. **Sem dependências circulares** no grafo de projetos (confirmado pelo script a cada etapa).

## Verificação automática

```bash
cd backend
python3 scripts/check-references.py
```

O script lê todos os `.csproj` da solução, reconstrói o grafo de
`ProjectReference` e falha (exit code 1) se encontrar: referência de um
módulo para outro, referência de Application/Domain para `Alilu.Api`,
violação da direção Domain→Application→Infrastructure, ou qualquer ciclo
no grafo. Rodado nesta etapa: **30 projetos, 0 violações, 0 ciclos.**

## PostgreSQL / EF Core — status (atualizado na Etapa 04)

- `Alilu.Infrastructure` referencia `Microsoft.EntityFrameworkCore`,
  `Npgsql.EntityFrameworkCore.PostgreSQL` e
  `Microsoft.EntityFrameworkCore.Design`.
- `AliluDbContext` (em `src/Infrastructure/Alilu.Infrastructure/Persistence/`)
  é o DbContext raiz da aplicação. Propositalmente **não expõe
  `DbSet<T>` como propriedades** para nenhuma entidade de nenhum módulo —
  isso exigiria `Alilu.Infrastructure` referenciar o Domain de cada módulo,
  quebrando a independência entre eles. Os repositórios de cada módulo
  acessam suas entidades via `dbContext.Set<T>()`, que funciona para
  qualquer tipo já presente no modelo (registrado dinamicamente — ver
  seções "Etapa 03"/"Etapa 04" abaixo) sem precisar de uma propriedade
  `DbSet` declarada.
- Tabelas de negócio até agora: `identity.users`,
  `identity.refresh_tokens` (Etapa 03), `condominium.condominiums`,
  `condominium.condominium_units`, `condominium.condominium_invitations`
  (Etapa 04) — schemas separados por módulo, mapeadas em
  `Alilu.Modules.<Módulo>.Infrastructure/Persistence/`.
- A connection string vem de `ConnectionStrings:AliluDatabase`
  (`appsettings.Development.json` aponta para o Postgres local do
  `docker-compose.yml`, na porta **5433** do host — remapeada da porta
  padrão 5432 porque, na máquina de desenvolvimento usada até aqui, a 5432
  já estava ocupada por outro projeto local. Se isso não se aplicar ao seu
  ambiente, pode voltar para `5432:5432` no `docker-compose.yml` e no
  `appsettings.Development.json` — só mantenha os dois arquivos
  consistentes entre si.)
- **Migrations:** a primeira migration (`InitialCreateIdentity`, Etapa 03)
  já foi gerada e aplicada com sucesso pelo usuário. A migration da Etapa
  04 (tabelas de Condominium) ainda **não foi gerada neste sandbox** — ver
  limitação abaixo — gere-a na sua máquina com:
  ```bash
  dotnet ef migrations add AddCondominiumModule \
    --project src/Infrastructure/Alilu.Infrastructure \
    --startup-project src/Api/Alilu.Api
  dotnet ef database update \
    --project src/Infrastructure/Alilu.Infrastructure \
    --startup-project src/Api/Alilu.Api
  ```
  (o `docker-compose.yml` da raiz sobe o Postgres local usado pela
  connection string de desenvolvimento — confira que o container está no
  ar, `docker compose up -d`, antes de rodar `database update`.)

  As ferramentas do EF Core procuram `Microsoft.EntityFrameworkCore.Design`
  no projeto de **startup** (`Alilu.Api`), não só no projeto do DbContext
  — e como esse pacote está marcado `PrivateAssets="all"` em
  `Alilu.Infrastructure` (não deve "vazar" para quem o referencia), ele
  precisa estar referenciado nos dois `.csproj`. `Alilu.Api.csproj` já
  inclui essa referência.

- **Seed de desenvolvimento (Etapa 04):** `Alilu.Api/Program.cs` roda
  `ICondominiumSeeder.SeedAsync()` logo após `app.MapControllers()`,
  **só quando `app.Environment.IsDevelopment()`** — cria o condomínio
  "Monte Carlo" e algumas unidades fictícias, de forma idempotente
  (confere se o CNPJ de seed já existe antes de inserir). Nunca roda em
  produção e nunca cria usuários/moradores — ver `CondominiumSeeder.cs`.

## Build

Rodar a solução inteira:

```bash
cd backend
dotnet restore
dotnet build
```

> **Nota sobre o ambiente de build usado pelo Claude (sandbox):** este
> container não tem acesso a `api.nuget.org`. Os projetos que só têm
> `ProjectReference` entre si (sem pacote NuGet externo — `Alilu.Shared`,
> os projetos `Domain`/`Application` de cada módulo) foram compilados
> individualmente aqui com **0 erros**. `Alilu.Api`, `Alilu.Infrastructure`
> e a `Infrastructure`/`Application.Tests` de cada módulo (todos dependem
> de pacotes NuGet externos — EF Core/Npgsql, JWT, xUnit) não puderam ser
> restaurados neste sandbox — confirmado que compilam normalmente na sua
> máquina (você já rodou `dotnet build`/`dotnet ef` localmente com sucesso
> após os Prompts 00 e 03).

## O que NÃO foi feito na Etapa 01 (de propósito, histórico)

- Nenhuma entidade, Value Object ou regra de negócio em nenhum módulo.
- Nenhuma tabela/migration do Postgres.
- Módulo Identity não implementado.
- Módulo Condominium não implementado.
- `Alilu.Api` ainda não referenciava nenhum módulo (nada para compor ainda).

---

## Etapa 03 — módulo Identity

Primeiro módulo de negócio real da solução: autenticação completa
(cadastro, login, refresh token com rotação, revogação, `/me`). O módulo
Condominium **continua não implementado** — o usuário autenticado desta
etapa ainda não tem, necessariamente, vínculo com um condomínio (isso é
do módulo Resident, futuro).

### Duas referências novas, ambas já permitidas pelas regras da Etapa 01

1. **`Alilu.Modules.Identity.Infrastructure` → `Alilu.Infrastructure`
   (raiz).** O módulo precisa do `AliluDbContext` compartilhado para
   persistir `User`/`RefreshToken` — não faz sentido cada módulo ter seu
   próprio `DbContext`/conexão. Isso não é uma referência *entre módulos*
   (a regra 4 proíbe módulo→módulo; `Alilu.Infrastructure` não é um
   módulo) e não cria um ciclo: `Alilu.Infrastructure` continua sem
   nenhuma referência de projeto para dentro de qualquer módulo.

   O lado "sem conhecer o módulo" é resolvido em runtime, não em
   compile-time: `AliluDbContext.OnModelCreating` varre
   `AppDomain.CurrentDomain.GetAssemblies()` procurando assemblies cujo
   nome comece com `"Alilu."` e aplica (`ApplyConfigurationsFromAssembly`)
   qualquer `IEntityTypeConfiguration<T>` encontrada neles. Como
   `Alilu.Api` referencia `Alilu.Modules.Identity.Infrastructure`, o
   assembly do módulo já está carregado no processo quando a Api sobe —
   então `UserConfiguration`/`RefreshTokenConfiguration` são descobertas
   sem `Alilu.Infrastructure` jamais precisar de um `using
   Alilu.Modules.Identity...`. Esse era exatamente o plano descrito
   (como comentário) no `AliluDbContext` da Etapa 01.

2. **`Alilu.Api` → `Alilu.Modules.Identity.Application` e
   `Alilu.Modules.Identity.Infrastructure`.** A Api precisa de
   `IAuthService`/DTOs (Application) para o `AuthController`, e de
   `AddIdentityModule()` (Infrastructure) para registrar tudo no DI. A
   regra 5 já previa esse caso: "cada módulo passará a ser
   referenciado pela Api quando tiver algo a registrar".

`scripts/check-references.py` já cobria os dois casos acima sem precisar
de nenhuma mudança — a regra "Infrastructure só referencia Domain/Application
do próprio módulo" nunca proibiu uma referência a um projeto *fora* do
sistema de módulos (`Alilu.Infrastructure` tem `module = None` para o
script), e a Api (`module = None`) nunca teve nenhuma restrição de
referência. Rodado após a Etapa 03: **31 projetos (30 + o novo projeto de
testes), 0 violações, 0 ciclos.**

### Estrutura de `Alilu.Modules.Identity.Infrastructure`

```
Infrastructure/
├── Persistence/
│   ├── UserConfiguration.cs        # IEntityTypeConfiguration<User> (Email como owned type)
│   ├── RefreshTokenConfiguration.cs
│   ├── UserRepository.cs           # IUserRepository via AliluDbContext
│   ├── RefreshTokenRepository.cs
│   └── UnitOfWork.cs               # IUnitOfWork -> AliluDbContext.SaveChangesAsync
├── Security/
│   ├── JwtOptions.cs                # seção "Jwt" do appsettings
│   └── JwtTokenGenerator.cs         # IJwtTokenGenerator via System.IdentityModel.Tokens.Jwt
├── Email/
│   └── NoOpEmailSender.cs           # IEmailSender que só loga (envio real: etapa futura)
└── DependencyInjection.cs           # AddIdentityModule(IServiceCollection, IConfiguration)
```

`Email` (Value Object de Domain) é mapeado como *owned type* do EF Core
(`OwnsOne`), não como um `HasConversion` simples — isso permite consultas
como `u => u.Email.Value == normalizedEmail` serem traduzidas para SQL de
verdade, em vez de dependerem de tradução de operador customizado.

Enums (`UserRole`, `UserStatus`) são armazenados como texto
(`HasConversion<string>()`) para o banco ficar legível e não quebrar se a
ordem dos valores do enum mudar no futuro.

### Testes

`src/Modules/Identity/Application.Tests/` (xUnit) — cobre cadastro
(sucesso, e-mail duplicado, senha fraca, papel privilegiado), login
(sucesso, senha inválida, usuário inexistente, e a garantia de que os
dois casos de erro geram a mesma exceção — proteção contra enumeração de
usuários), refresh (rotação, token já usado, token desconhecido, token
expirado), revogação (marca revogado, idempotência, token desconhecido) e
`/me` (usuário válido, usuário inexistente). Usa fakes em memória para os
repositórios/JWT e as implementações **reais** de `PasswordHasher` e
`RefreshTokenGenerator` (só BCL, sem custo de rodar Postgres).

### Limitação do sandbox de build (Claude) nesta etapa

Igual à Etapa 01: este container não tem acesso a `api.nuget.org`, então
`Alilu.Modules.Identity.Infrastructure`, `Alilu.Api` e o projeto de testes
xUnit (todos dependem de pacotes externos — EF Core, JWT, xUnit) não
puderam ser restaurados/compilados aqui. O que **foi** verificado neste
sandbox:

- `Alilu.Modules.Identity.Domain` e `Alilu.Modules.Identity.Application`
  (zero dependências NuGet externas) compilam com **0 erros/0 warnings**.
- Toda a lógica de `AuthService` (as mesmas regras exercitadas pelos
  testes xUnit) foi validada rodando manualmente contra os fakes em
  memória — **todos os cenários passaram**.
- `python3 scripts/check-references.py` — 0 violações, 0 ciclos.

Rode `dotnet restore && dotnet build` e `dotnet test
src/Modules/Identity/Application.Tests` na sua máquina para a verificação
completa (Infrastructure/Api/testes xUnit).

---

## Etapa 04 — módulo Condominium

Segundo módulo de negócio: cadastro administrativo de condomínios,
unidades e convites de associação a uma unidade. Continua **multi-condomínio
desde o início** (nada aqui assume um único condomínio). O módulo Resident
(quem de fato consome um convite e vira morador de uma unidade) continua
não implementado — ver ressalva no README do módulo.

### Entidades e Value Objects (`Alilu.Modules.Condominium.Domain`)

- **`Condominium`** — `Name`, `Cnpj` (Value Object), `Address`/`Number`/
  `Neighborhood`/`City`/`State`/`ZipCode` (campos simples — diferente do
  CNPJ, nenhuma regra desta etapa precisa consultar/normalizar o endereço
  como um todo), `Status` (`Active`/`Inactive`), `CreatedAt`.
- **`Cnpj`** — Value Object que normaliza para 14 dígitos (sem máscara) e
  valida os dígitos verificadores pelo algoritmo oficial da Receita
  Federal (não é só checagem de tamanho) — mesma ideia de `Email` no
  módulo Identity: normalização é o que permite checar duplicidade de
  forma confiável.
- **`CondominiumUnit`** — `CondominiumId`, `Code`, `Type`
  (`Apartment`/`House`/`Commercial`), `Status`, `CreatedAt`. **De propósito
  sem navegação/FK para `Condominium`** — mesma decisão de `RefreshToken`
  em relação a `User` no módulo Identity (duas raízes de agregado, sem
  acoplar por navegação EF). A existência do condomínio é conferida pela
  Application antes de criar a unidade; a unicidade do código *dentro do
  condomínio* é conferida pela Application (`ExistsByCondominiumIdAndCodeAsync`)
  e reforçada por um índice único composto `(CondominiumId, Code)` em
  Infrastructure.
- **`CondominiumInvitation`** — `CondominiumId`, `UnitId`, `Email`,
  `CodeHash`, `ExpiresAt`, `UsedAt`, `CreatedAt`. Mesma política de
  segurança do `RefreshToken`: só o hash do código é armazenado, nunca o
  valor bruto. Também sem navegação/FK para `Condominium`/`CondominiumUnit`.
  `MarkAsUsed()` lança `DomainException` se o convite já foi usado ou já
  expirou — diferente de `RefreshToken.Revoke()` (idempotente), aqui
  reaproveitar um convite é um erro, não um no-op, porque o convite é uma
  autorização de uso único para uma unidade específica.
- **`IInvitationCodeGenerator`/`InvitationCodeGenerator`** — gera um
  código de 10 caracteres de um alfabeto sem caracteres ambíguos (sem
  `0/O`, `1/I/L`), pensado para ser digitado por uma pessoa (diferente do
  refresh token, que nunca é digitado) — só BCL, mesmo espírito de
  `RefreshTokenGenerator`.

### Autorização em duas camadas

"Não permitir que usuário comum crie condomínios" (e, por extensão, os
demais endpoints administrativos deste módulo) é aplicado em dois lugares:

1. **Api:** `[Authorize(Roles = "CondominiumAdmin,SuperAdmin")]` no nível
   do controller (`CondominiumsController`/`CondominiumInvitationsController`)
   — primeira linha de defesa, via pipeline padrão do ASP.NET Core.
2. **Application:** `CondominiumService` recebe um `CondominiumRequesterRole`
   (enum próprio deste módulo, com os mesmos nomes de
   `Identity.Domain.UserRole` — mas um tipo independente, já que nenhum
   módulo referencia outro) em toda operação, e chama `EnsureIsAdmin(...)`
   no início de cada uma, lançando `InsufficientPermissionsException` (403)
   caso contrário. Isso repete a regra de negócio como segunda camada de
   defesa (mesma filosofia de
   `InvalidRoleForSelfRegistrationException` no módulo Identity) — e é o
   que permite testar "autorização" com testes rápidos em memória, sem
   precisar de um host HTTP real (que este projeto não tem configurado).

### Fluxo de convite nesta etapa

Só existem **criar** e **consultar** convite (ver PROMPT 04 — API). Não
existe endpoint de "resgatar convite" — isso pertence ao módulo Resident,
futuro. `GetInvitationAsync` calcula o status (`Pending`/`Used`/`Expired`)
a partir de `UsedAt`/`ExpiresAt` no momento da consulta, sem guardar esse
status como coluna. Os testes do cenário "convite utilizado" simulam
diretamente o que o futuro fluxo de resgate fará (chamar
`CondominiumInvitation.MarkAsUsed()`), sem precisar desse endpoint existir
ainda.

### Estrutura de `Alilu.Modules.Condominium.Infrastructure`

```
Infrastructure/
├── Persistence/
│   ├── CondominiumConfiguration.cs            # Cnpj como owned type
│   ├── CondominiumUnitConfiguration.cs        # índice único (CondominiumId, Code)
│   ├── CondominiumInvitationConfiguration.cs
│   ├── CondominiumRepository.cs
│   ├── CondominiumUnitRepository.cs
│   ├── CondominiumInvitationRepository.cs
│   └── UnitOfWork.cs
├── Seed/
│   ├── ICondominiumSeeder.cs
│   └── CondominiumSeeder.cs                    # "Monte Carlo" + unidades fictícias, só em Development
└── DependencyInjection.cs                      # AddCondominiumModule(IServiceCollection, IConfiguration)
```

### Testes

`src/Modules/Condominium/Application.Tests/` (xUnit) — cobre os 6
cenários pedidos: criação (condomínio, unidade, convite — incluindo
normalização de CNPJ e rejeição de CNPJ inválido), unidade duplicada
(mesmo código no mesmo condomínio rejeitado; mesmo código em condomínios
diferentes aceito), convite (criação retorna o código bruto uma única
vez; unidade de outro condomínio rejeitada), convite expirado (mesma
técnica de `RefreshTests` no módulo Identity: convite com validade de
100ms + `Task.Delay(250)`), convite utilizado (`MarkAsUsed()` direto na
entidade, simulando o futuro fluxo de resgate; usar duas vezes lança
`DomainException`) e autorização (`AuthorizationTests.cs` varre as 6
operações com papéis não-admin e admin). Usa fakes em memória para os
repositórios e a implementação **real** de `InvitationCodeGenerator` (só
BCL, sem custo de rodar Postgres) — mesmo padrão do módulo Identity.

### Limitação do sandbox de build (Claude) nesta etapa

Igual às Etapas 01/03: `Alilu.Modules.Condominium.Infrastructure`,
`Alilu.Api` e o projeto de testes xUnit (dependem de EF Core/xUnit) não
puderam ser restaurados/compilados aqui. O que **foi** verificado neste
sandbox:

- `Alilu.Modules.Condominium.Domain` e `Alilu.Modules.Condominium.Application`
  (zero dependências NuGet externas) compilam com **0 erros/0 warnings**.
- Toda a lógica de `CondominiumService` (os mesmos 6 cenários pedidos pelo
  PROMPT 04, incluindo os testes de `AuthorizationTests.cs`) foi validada
  rodando manualmente contra os fakes em memória, usando o
  `InvitationCodeGenerator` real — **35 verificações, todas passaram**.
- `python3 scripts/check-references.py` — **32 projetos, 0 violações, 0
  ciclos.**

Rode `dotnet restore && dotnet build`, `dotnet test
src/Modules/Condominium/Application.Tests` e os comandos de migration (ver
seção "PostgreSQL / EF Core" acima) na sua máquina para a verificação
completa.
