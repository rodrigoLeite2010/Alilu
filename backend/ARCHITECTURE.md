# Arquitetura do backend ALILU

> Documento de arquitetura. Seções sem indicação de etapa descrevem a
> fundação criada na **Etapa 01 (Backend modular)**; as seções **"Etapa 03 —
> módulo Identity"**, **"Etapa 04 — módulo Condominium"** e **"Etapa 05 —
> módulo Resident (validação do morador)"**, no final, descrevem o que
> mudou com cada módulo de negócio real.

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

## PostgreSQL / EF Core — status (atualizado na Etapa 05)

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
  (Etapa 04), `resident.condominium_memberships` (Etapa 05) — schemas
  separados por módulo, mapeadas em
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
  e a migration da Etapa 04 (`AddCondominiumModule`) já foram geradas e
  aplicadas com sucesso pelo usuário. A migration da Etapa 05 (tabela
  `resident.condominium_memberships`, incluindo o índice único filtrado —
  ver seção "Etapa 05" abaixo) ainda **não foi gerada neste sandbox** —
  ver limitação abaixo — gere-a na sua máquina com:
  ```bash
  dotnet ef migrations add AddResidentModule \
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
  O módulo Resident (Etapa 05) **não tem seed** — o vínculo nasce do fluxo
  real (resgatar um convite ou solicitar acesso), nunca de dado fictício.

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

## Etapa 05 — módulo Resident (validação do morador)

Terceiro módulo de negócio, e o primeiro que **liga** os outros dois: o
vínculo seguro morador↔condomínio↔unidade. Antes desta etapa, um usuário
autenticado (Identity) não tinha nenhuma ligação formal com um condomínio/
unidade (Condominium) — a partir de agora, essa ligação existe como sua
própria entidade, com seu próprio ciclo de vida. Diaristas/prestadores de
serviço continuam **fora de escopo**, de propósito (ver PROMPT 05).

### `CondominiumMembership` (`Alilu.Modules.Resident.Domain`)

Exatamente os campos pedidos no prompt — `Id`, `UserId`, `CondominiumId`,
`UnitId`, `Status`, `ValidatedAt`, `ValidatedBy`, `CreatedAt`, `UpdatedAt`
— e nada além disso. Em particular, **não tem `Name`/`Phone`**: esses
dados já existem em `Identity.User` (Etapa 03); duplicá-los aqui criaria
duas fontes de verdade para a mesma informação. A tela de solicitação
(FLUXO 2) não pede nome/telefone de novo — a Api já os tem a partir do
usuário autenticado.

`MembershipStatus`: `Pending`/`Active`/`Rejected`/`Blocked`. Mesma decisão
de design de `CondominiumUnit`/`CondominiumInvitation`: **sem
navegação/FK** para `User`/`Condominium`/`CondominiumUnit` — só os Ids
como valores simples (e, tecnicamente, nem haveria como declarar essa
navegação: nenhum módulo referencia outro). Dois construtores estáticos,
um para cada fluxo:

- `CreateActiveFromInvitation` (FLUXO 1) — nasce direto `Active`.
  `ValidatedBy` fica `null`: ninguém "aprovou" isto agora, a autorização
  já tinha sido concedida quando o administrador criou o convite (Etapa
  04); essa informação (quem criou o convite) pertence ao módulo
  Condominium e não é replicada aqui.
- `CreatePendingRequest` (FLUXO 2) — nasce `Pending`, aguardando
  `Approve`/`Reject` por um administrador.

`Block` só é válido a partir de `Active`; `Approve`/`Reject` só a partir
de `Pending` — cada um lança `DomainException` fora da transição válida.

### O problema central desta etapa: dois módulos que não podem se falar

O PROMPT 01 estabeleceu que nenhum módulo pode referenciar outro, em
nenhuma camada — regra verificada por `scripts/check-references.py` desde
a Etapa 01, e que continua valendo aqui: `Alilu.Modules.Resident.Application`
só referencia `Alilu.Modules.Resident.Domain`, nunca o módulo Condominium.

Só que o FLUXO 1 (convite) por definição precisa dos dois módulos ao
mesmo tempo: validar o convite é uma regra do módulo Condominium (código,
validade, uso, e-mail — dados que só existem em `CondominiumInvitation`);
criar o `CondominiumMembership` é uma regra do módulo Resident. Nenhum
dos dois pode chamar o outro para resolver isso sozinho.

A solução: a **Api é a composição raiz** (mesmo papel que já cumpre desde
a Etapa 01/03 — ver `Alilu.Api.csproj`, que pode referenciar a Application
e a Infrastructure de qualquer módulo, só os módulos entre si que não
podem). `ResidentMembershipsController.RedeemInvitation` injeta
`IInvitationRedemptionService`/`ICondominiumDirectoryService` (módulo
Condominium) **e** `IMembershipService` (módulo Resident) lado a lado, e
orquestra a sequência:

1. `IInvitationRedemptionService.ValidateInvitationAsync` (Condominium) —
   valida o convite e devolve `CondominiumId`/`UnitId` **resolvidos a
   partir do próprio convite**, nunca de nada que o corpo da requisição
   informe (o corpo só tem o código digitado, ver `RedeemInvitationBody`
   — sem nenhum campo de condomínio/unidade).
2. `IMembershipService.CreateMembershipFromInvitationAsync` (Resident) —
   recebe os Ids já resolvidos e cria o vínculo (`Active`).
3. Só depois do passo 2 ter sucesso, `IInvitationRedemptionService.MarkInvitationAsUsedAsync`
   (Condominium) marca o convite como usado.

Por que a ordem 1→2→3, e não marcar o convite como usado logo no passo 1:
se a criação do vínculo (passo 2) falhar por qualquer motivo — ex.:
`DuplicateMembershipException`, "usuário já vinculado" — um convite
"queimado" à toa deixaria a pessoa sem conseguir tentar de novo, mesmo
sem ter conseguido se vincular. Separar validar (só leitura, passo 1) de
marcar como usado (escrita, passo 3) evita esse problema — é por isso que
`IInvitationRedemptionService` tem os dois métodos separados em vez de um
`RedeemAsync` único.

O FLUXO 2 (solicitação) tem o mesmo formato, mais simples: `RequestAccess`
chama `ICondominiumDirectoryService.ValidateUnitAsync` (Condominium —
confirma que a unidade existe e pertence ao condomínio informado) antes
de chamar `IMembershipService.RequestResidentAccessAsync` (Resident).

### SEGURANÇA — "nunca confiar em condominiumId/unitId vindos do cliente"

Duas interpretações diferentes, dependendo do fluxo:

- **FLUXO 1 (convite):** o cliente **nunca envia** condomínio/unidade — só
  o código (`RedeemInvitationBody(string Code, string? Email)`). Segurança
  por construção: não existe parâmetro para o cliente "escolher" a
  unidade errada, porque o método nem aceita esse parâmetro.
  `InvitationRedemptionTests.ValidateInvitationAsync_NeverAcceptsCondominiumOrUnitFromTheCaller_...`
  prova isso.
- **FLUXO 2 (solicitação):** aqui o cliente necessariamente informa
  condomínio/unidade (é o próprio ato de "escolher minha unidade" no
  diretório público) — a defesa aqui é **revalidar no servidor**:
  `ICondominiumDirectoryService.ValidateUnitAsync` confirma que os dois
  Ids realmente existem e se relacionam antes de deixar o módulo Resident
  criar a solicitação, em vez de aceitar cegamente o que veio do corpo da
  requisição.

"Não permitir vínculo duplicado": checado em duas camadas, mesmo padrão
já usado nas Etapas 03/04 — `MembershipService`/`IMembershipRepository.ExistsActiveOrPendingAsync`
antes de persistir (`DuplicateMembershipException`), e reforçado por um
índice único **filtrado** em `MembershipConfiguration`
(`HasFilter("\"Status\" IN ('Pending','Active')")` — de propósito não
cobre `Rejected`/`Blocked`, para permitir uma nova tentativa depois de uma
rejeição).

**Regra explicitamente adiada** (PROMPT 05 já veio com essa ressalva: "se
essa for a regra definida para o condomínio"): "uma unidade não deve ter
dois moradores principais ativos" **não foi implementada** nesta etapa —
não há, ainda, o conceito de "morador principal" vs. "morador adicional"
em `CondominiumMembership`, nem configuração por condomínio para essa
regra. Fica para uma etapa futura, quando essa regra for de fato
especificada.

### Duas interfaces de Application por módulo (self-service vs. admin)

Mesmo padrão dos dois lados:

- **Condominium:** `ICondominiumService` (administrativo, Etapa 04) +
  `IInvitationRedemptionService`/`ICondominiumDirectoryService` (novos,
  públicos — sem checagem de papel, porque resgatar convite/consultar o
  diretório não é uma ação administrativa).
- **Resident:** `IMembershipService` (self-service — sempre restrito ao
  próprio usuário autenticado, nunca recebe um `userId` de fora; "seguro
  por construção") + `IMembershipAdministrationService` (aprovar/rejeitar/
  bloquear — recebe `ResidentRequesterRole` e chama `EnsureIsAdmin(...)`
  no início de cada operação, mesmo padrão de `CondominiumService`).

### Endpoints novos

- `GET /api/resident/memberships` — `[Authorize]`, lista os vínculos do
  usuário autenticado.
- `GET /api/resident/memberships/active` — `[Authorize]`, vínculo `Active`
  do usuário, ou `204 No Content` ("acesso sem vínculo").
- `POST /api/resident/memberships/redeem-invitation` — `[Authorize]`,
  FLUXO 1.
- `POST /api/resident/memberships/request-access` — `[Authorize]`, FLUXO 2.
- `GET /api/admin/memberships/pending` — `[Authorize(Roles = "CondominiumAdmin,SuperAdmin")]`.
- `POST /api/admin/memberships/{id}/approve` — idem.
- `POST /api/admin/memberships/{id}/reject` — idem.
- `POST /api/admin/memberships/{id}/block` — idem.
- `GET /api/directory/condominiums` — `[Authorize]`, diretório público
  (só condomínios `Active`).
- `GET /api/directory/condominiums/{id}/units` — `[Authorize]`, idem (só
  unidades `Active`).

`ClaimsPrincipalExtensions` ganhou `GetResidentRequesterRole()` (espelha
`GetCondominiumRequesterRole()`) e `GetUserId()` (extraído do claim de
subject do JWT — usado por todo endpoint self-service, para nunca confiar
em um `userId` vindo do corpo da requisição).

`ExceptionHandlingMiddleware`: como os módulos Condominium e Resident
definem, cada um, seu próprio `InsufficientPermissionsException` (mesmo
nome, namespaces diferentes — não têm como compartilhar um tipo comum),
o mapeamento usa o nome totalmente qualificado para essas duas linhas
específicas, para não gerar ambiguidade de nome no `switch`.

### Mobile — fluxo de validação (`mobile/src/modules/resident/`)

Cinco telas pedidas pelo prompt, mais o "gate" que decide entre elas
(`app/(resident)/index.tsx`, a partir de `useMyMemberships` — TanStack
Query sobre `GET /api/resident/memberships`):

- **Nenhum vínculo** (nem `Active`, nem `Pending`) → `ChooseCondominiumScreen`
  — o início do fluxo: botão "Tenho um código de convite" (→ `EnterInvitationCodeScreen`)
  ou a lista de condomínios do diretório público, para quem vai pelo
  FLUXO 2.
- Escolher um condomínio na lista → `RequestResidentAccessScreen`
  (recebe `condominiumId` via parâmetro de rota do expo-router) — lista as
  unidades daquele condomínio (`GET /api/directory/.../units`), o morador
  escolhe a sua e confirma; a solicitação nasce `Pending`.
- **Vínculo `Pending`** → `WaitingApprovalScreen` — tela de espera com um
  botão "Verificar novamente" (refaz a consulta) e logout.
- **Vínculo `Active`** → `ResidentHomeScreen` — área do morador (ainda só
  com os dados básicos do vínculo + logout; as demais telas do morador —
  buscar profissional, agendamentos, avaliações — continuam não
  implementadas, como já eram desde a Etapa 01).

`EnterInvitationCodeScreen` só pede o código — o e-mail enviado ao backend
(campo opcional de `POST .../redeem-invitation`) é sempre o do próprio
usuário autenticado (`useAuth().user.email`), nunca digitado de novo.

Todas as mutações (`useRedeemInvitation`/`useRequestResidentAccess`, em
`modules/resident/hooks.ts`) invalidam a query de "meus vínculos" ao
terminar — por isso basta `router.replace('/(resident)')` depois de uma
mutação com sucesso: o gate detecta o novo estado sozinho, sem precisar
de nenhuma lógica de navegação condicional espalhada pelas telas.

### Testes

- `Condominium.Application.Tests/InvitationRedemptionTests.cs` — convite
  válido (com e sem e-mail informado), e-mail que não bate
  (`InvitationEmailMismatchException`), código inexistente
  (`InvitationNotFoundException`), convite expirado (mesma técnica de
  100ms + `Task.Delay(250)` já usada na Etapa 04), convite já usado
  (`InvitationAlreadyUsedException`), "convite para outra unidade" (prova
  que o resultado sempre traz a unidade *real* do convite, nunca outra —
  a própria assinatura do método não aceita esse parâmetro) e o padrão de
  duas fases (validar não consome o convite; só `MarkInvitationAsUsedAsync`
  consome).
- `Condominium.Application.Tests/CondominiumDirectoryTests.cs` — diretório
  público (só ativos) e `ValidateUnitAsync` (aceita/rejeita).
- `Resident.Application.Tests/` (novo projeto, mesmo padrão dos demais) —
  `RedeemInvitationTests` (vínculo nasce `Active`; "usuário já vinculado"
  → `DuplicateMembershipException`), `RequestResidentAccessTests`
  (solicitação nasce `Pending`; duplicidade), `ApprovalAndRejectionTests`
  (aprovação, rejeição, "depois de rejeitado pode solicitar de novo",
  bloqueio, transições inválidas), `NoActiveMembershipTests` ("acesso sem
  vínculo" — `GetMyActiveMembershipAsync` devolve `null`) e
  `AuthorizationTests` (as 4 operações administrativas, papel admin vs.
  não-admin).

### Limitação do sandbox de build (Claude) nesta etapa

Mesma limitação das Etapas 03/04: `Alilu.Modules.Resident.Infrastructure`,
`Alilu.Api` e os projetos de teste xUnit (dependem de EF Core/xUnit) não
puderam ser restaurados/compilados aqui. O que **foi** verificado neste
sandbox:

- `Alilu.Modules.Resident.Domain`, `Alilu.Modules.Resident.Application` e
  `Alilu.Modules.Condominium.Application` (com os novos serviços desta
  etapa) — todos com zero dependências NuGet externas — compilam com **0
  erros/0 warnings**.
- Toda a lógica de negócio desta etapa (os 10 cenários pedidos pelo PROMPT
  05: convite válido, expirado, já usado, para outra unidade, usuário já
  vinculado, solicitação, aprovação, rejeição, bloqueio, acesso sem
  vínculo) foi validada rodando manualmente contra fakes em memória,
  reaproveitando as mesmas implementações reais dos dois módulos
  (`InvitationCodeGenerator` real, serviços reais) — **27 verificações,
  todas passaram**.
- `python3 scripts/check-references.py` — **33 projetos, 0 violações, 0
  ciclos** — confirma que `Alilu.Modules.Resident.Application` de fato não
  referencia nada do módulo Condominium, mesmo orquestrando os dois na Api.
- Mobile: `npx tsc --noEmit` e `npx eslint .` — **0 erros** em todo o
  projeto (incluindo os arquivos novos desta etapa).

Rode `dotnet restore && dotnet build`, `dotnet test
src/Modules/Resident/Application.Tests`, `dotnet test
src/Modules/Condominium/Application.Tests` e os comandos de migration (ver
seção "PostgreSQL / EF Core" acima) na sua máquina para a verificação
completa.

## Etapa 06 — módulo Professional (profissionais e diaristas)

Quarto módulo de negócio. "Professional NÃO é automaticamente morador"
(PROMPT 06) — este módulo não tem nenhuma relação com `CondominiumMembership`
(módulo Resident): um mesmo usuário poderia, em tese, ter os dois papéis
(morador e profissional), mas um não implica o outro. Agenda/disponibilidade/
atendimentos continuam **fora de escopo** ("Ainda NÃO criar agenda" —
PROMPT 06).

### Entidades (`Alilu.Modules.Professional.Domain`)

Quatro raízes de agregado, exatamente os campos pedidos no prompt, cada
uma **sem navegação/FK** para entidades de outro tipo/módulo — mesma
decisão já usada em `CondominiumUnit`/`CondominiumMembership`: só Ids como
valores simples, checados pela Application antes de persistir e reforçados
por índices em Infrastructure.

- **`Professional`** — perfil profissional de um usuário (`UserId`,
  `DisplayName`, `Description`, `Phone`, `PhotoUrl`, `Status`, `CreatedAt`,
  `UpdatedAt`). `ProfessionalStatus`: `Active`/`Inactive`. Um usuário só
  pode ter um perfil (índice único em `UserId`).
- **`ServiceCategory`** — categoria de serviço (`Name`, `Description`,
  `Active`). Lista **global**, não pertence a nenhum profissional/
  condomínio — as sete categorias iniciais (Diarista, Jardineiro,
  Piscineiro, Eletricista, Encanador, Pedreiro, Pintor) são inseridas por
  `ServiceCategorySeeder` (dev-only, idempotente por nome — mesmo padrão
  de `CondominiumSeeder`); não há endpoint de CRUD de categoria nesta
  etapa (não pedido pelo prompt).
- **`ProfessionalService`** — vínculo profissional↔categoria ("selecionar
  serviços"). Um profissional pode ter vários. Índice único **filtrado**
  em `(ProfessionalId, ServiceCategoryId)` só para `Active = TRUE` —
  permite readicionar a mesma categoria depois de removida.
- **`ProfessionalCondominium`** — "significa que o profissional atende
  aquele condomínio" (definição do próprio prompt). `ProfessionalCondominiumStatus`:
  `Pending`/`Active`/`Rejected`/`Inactive`. `ProfessionalCondominiumSource`:
  `AdminApproved`/`ResidentRecommended`/`CompletedService`/`ProfessionalRequested`
  (os quatro valores exatos pedidos no prompt). Dois construtores
  estáticos: `RequestService` (o profissional solicita atendimento — nasce
  `Pending`, `Source = ProfessionalRequested`) e `CreateActive` (um
  administrador vincula diretamente, já `Active` — não aceita
  `ProfessionalRequested` como origem, esse caminho sempre nasce
  `Pending`). Índice único filtrado em `(ProfessionalId, CondominiumId)`
  só para `Pending`/`Active` — mesmo padrão de `CondominiumMembership`.

**Nota sobre `ResidentRecommended`/`CompletedService`:** o prompt pediu os
quatro valores de `Source`, mas só `ProfessionalRequested` (self-service,
"solicitar atendimento em condomínios") tem, nesta etapa, um caminho de
criação real exposto pela Api. `ResidentRecommended` depende do módulo
Recommendations e `CompletedService` dos módulos Scheduling/Reviews —
nenhum dos dois existe ainda. Os valores já estão no enum (o tipo já nasce
"pronto" para quando esses módulos existirem), mas nenhum caso de uso desta
etapa os produz — mesmo espírito de deixar uma regra explicitamente
adiada, como a Etapa 05 fez com "morador principal por unidade".

### Três interfaces de Application (self-service / diretório público / admin)

Um padrão a mais que o das Etapas 04/05 (que tinham duas): aqui há também
um diretório público **sem dono** (não é "do profissional" nem "do
morador" — qualquer autenticado consulta).

- **`IProfessionalProfileService`** (self-service) — sempre restrito ao
  próprio `userId` autenticado, nunca recebe papel para checar ("seguro
  por construção", mesmo padrão de `IMembershipService`). Cobre perfil
  (criar/editar/consultar), serviços (adicionar/remover — desativação
  lógica, não exclusão) e `RequestCondominiumAsync` ("solicitar
  atendimento em condomínios").
- **`IProfessionalDirectoryService`** (público, sem checagem de papel) —
  usado pelo morador: `ListCategoriesAsync`, `ListProfessionalsAsync`
  (com filtro opcional de categoria) e `GetProfessionalProfileAsync`. Só
  devolve perfis `Active` — um perfil desativado não aparece na busca nem
  é encontrado por Id direto.
- **`IProfessionalAdministrationService`** (admin, `EnsureIsAdmin(ProfessionalRequesterRole)`)
  — fila de solicitações de atendimento pendentes + aprovar/rejeitar.
  Contrapartida natural de `RequestCondominiumAsync`: sem isso, toda
  solicitação ficaria pendente para sempre — mesmo raciocínio que já
  justificou `IMembershipAdministrationService` na Etapa 05 para o FLUXO 2.

`ProfessionalRequesterRole`: mesmo padrão de `ResidentRequesterRole`/
`CondominiumRequesterRole` — tipo independente deste módulo (mesmos nomes/
valores de `Identity.UserRole`, mas sem referenciar o módulo Identity).

### O mesmo problema da Etapa 05, de novo: dois módulos que não podem se falar

`RequestCondominiumAsync` recebe um `condominiumId` — e, pela mesma regra
de segurança da Etapa 05 ("nunca confiar em Ids vindos do cliente"), esse
Id precisa ser confirmado contra o módulo Condominium antes de o módulo
Professional criar a associação. Só que `ICondominiumDirectoryService.ValidateUnitAsync`
(criado na Etapa 05) exige uma unidade — aqui não há unidade nenhuma
envolvida, só o condomínio.

Solução: **estender** `ICondominiumDirectoryService` (módulo Condominium,
Application) com `ValidateCondominiumAsync(condominiumId)` — confirma só a
existência do condomínio, lança `CondominiumNotFoundException` quando não
encontrado (mesma exceção que `ValidateUnitAsync` já usava, reaproveitada).
`ProfessionalProfileController.RequestCondominium` injeta os dois serviços
lado a lado (`ICondominiumDirectoryService` + `IProfessionalProfileService`)
e orquestra: 1) valida o condomínio (Condominium); 2) só então cria a
solicitação (Professional) — exatamente o mesmo papel de composição raiz
que a Api já cumpre desde a Etapa 05.

### Endpoints novos

Self-service (`[Authorize]`, sempre restrito ao próprio usuário):

- `GET /api/professional/profile` — meu perfil, ou `204 No Content`.
- `POST /api/professional/profile` — criar.
- `PUT /api/professional/profile` — editar.
- `GET /api/professional/profile/services` — meus serviços.
- `POST /api/professional/profile/services` — adicionar serviço.
- `DELETE /api/professional/profile/services/{id}` — remover (desativar) serviço.
- `GET /api/professional/profile/condominiums` — meus vínculos com condomínios.
- `POST /api/professional/profile/condominiums` — "solicitar atendimento em condomínios".

Diretório público (`[Authorize]`, qualquer autenticado):

- `GET /api/directory/professionals/categories` — categorias ativas.
- `GET /api/directory/professionals?categoryId=` — profissionais ativos, filtro opcional.
- `GET /api/directory/professionals/{id}` — perfil de um profissional (404 se não existir/não estiver ativo).

Administrativos (`[Authorize(Roles = "CondominiumAdmin,SuperAdmin")]`):

- `GET /api/admin/professional-condominiums/pending`
- `POST /api/admin/professional-condominiums/{id}/approve`
- `POST /api/admin/professional-condominiums/{id}/reject`

`ClaimsPrincipalExtensions` ganhou `GetProfessionalRequesterRole()`
(espelha `GetResidentRequesterRole()`/`GetCondominiumRequesterRole()`);
`GetUserId()` (Etapa 05) é reaproveitado sem alteração.

`ExceptionHandlingMiddleware`: mesmo raciocínio já registrado na Etapa 05
— `Alilu.Modules.Professional.Application.InsufficientPermissionsException`
precisa de nome totalmente qualificado (terceiro módulo com um tipo de
mesmo nome). Com quatro módulos agora repetindo o padrão, o comentário do
middleware já sinaliza que uma quinta repetição deveria extrair um
contrato comum em `Alilu.Shared`.

### Mobile — `mobile/src/modules/professional/`

Quatro telas pedidas pelo prompt, divididas entre os dois papéis:

- **`ProfessionalEditScreen`** (profissional) — "editar perfil; selecionar
  serviços" + "solicitar atendimento em condomínios". Serve dois modos
  com o mesmo componente: sem perfil (`profile === null`) mostra só o
  formulário de criação; com perfil, mostra o formulário de edição mais
  duas seções — "Meus serviços" (um botão por categoria, alterna
  oferece/não oferece) e "Atendo estes condomínios" (um botão "Solicitar"
  por condomínio sem vínculo, ou o status do vínculo existente). É a
  própria tela inicial do profissional: `app/(professional)/index.tsx` é
  o gate (a partir de `useMyProfessionalProfile`), mesmo padrão do gate
  de `(resident)/index.tsx` da Etapa 05 — sem perfil → formulário de
  criação; com perfil → o perfil completo.
- **`ServiceCategoryScreen`** (morador) — lista de categorias; escolher
  uma navega para `ProfessionalListScreen` já filtrada; "Ver todos os
  profissionais" pula o filtro.
- **`ProfessionalListScreen`** (morador) — "listar profissionais; filtrar
  categoria" (`categoryId` opcional via parâmetro de rota).
- **`ProfessionalProfileScreen`** (morador) — "visualizar perfil"
  (`GET /api/directory/professionals/{id}`).

Roteamento: as três telas do morador ficam em `app/(resident)/`
(`professional-categories`, `professionals`, `professionals/[id]`) —
`ResidentHomeScreen` ganhou o botão "Buscar profissional" apontando para
`professional-categories`, fechando o "ainda não implementadas" que a
Etapa 05 tinha deixado registrado ali.

### Testes

`Professional.Application.Tests/` (novo projeto, mesmo padrão dos demais)
— sem lista de cenários prescrita pelo prompt (diferente das Etapas 04/05),
cobertura própria: `ProfileTests` (criar/consultar/editar, perfil
duplicado), `ServicesTests` (adicionar/remover, categoria inativa/
inexistente, duplicidade, readicionar depois de remover, isolamento entre
profissionais), `CondominiumRequestTests` (solicitação nasce `Pending` com
`Source = ProfessionalRequested`, duplicidade, condomínios diferentes não
conflitam), `AdministrationTests` (fila pendente, aprovar, rejeitar,
transições inválidas, autorização) e `DirectoryTests` (só ativos aparecem,
filtro por categoria, perfil por Id, categorias só ativas).

### Limitação do sandbox de build (Claude) nesta etapa

Mesma limitação das Etapas 03/04/05: `Alilu.Modules.Professional.Infrastructure`,
`Alilu.Api` e os projetos de teste xUnit não puderam ser restaurados/
compilados aqui. O que **foi** verificado neste sandbox:

- `Alilu.Modules.Professional.Domain`, `Alilu.Modules.Professional.Application`
  e `Alilu.Modules.Condominium.Application` (com o novo `ValidateCondominiumAsync`)
  — todos com zero dependências NuGet externas — compilam com **0
  erros/0 warnings**.
- Toda a lógica de negócio desta etapa foi validada rodando manualmente
  contra fakes em memória (as mesmas implementações reais dos serviços) —
  **33 verificações, todas passaram**, incluindo a composição com
  `CondominiumDirectoryService.ValidateCondominiumAsync` real.
- `python3 scripts/check-references.py` — **34 projetos, 0 violações, 0
  ciclos**.
- Mobile: `npx tsc --noEmit` e `npx eslint .` — **0 erros** em todo o
  projeto (incluindo os arquivos novos desta etapa).

Rode `dotnet restore && dotnet build`, `dotnet test
src/Modules/Professional/Application.Tests` e os comandos de migration
(`dotnet ef migrations add AddProfessionalModule --project src/Infrastructure/Alilu.Infrastructure --startup-project src/Api/Alilu.Api`,
depois `dotnet ef database update ...`) na sua máquina para a verificação
completa.

## Etapa 07 — disponibilidade profissional

Continuação do módulo Professional (mesmo módulo, novas entidades) —
"Implementar SOMENTE disponibilidade profissional" (PROMPT 07). Booking/
reservas continuam **fora de escopo** ("Ainda NÃO criar Booking" — PROMPT
07); esta etapa só guarda a agenda do profissional, sem nenhum conceito de
cliente reservando um horário.

### Entidades (`Alilu.Modules.Professional.Domain`)

Duas novas raízes de agregado, mesma decisão de sempre: sem navegação/FK
para `Professional` (mesmo módulo) — só `ProfessionalId` como valor
simples.

- **`ProfessionalAvailability`** — um intervalo recorrente num dia da
  semana (`DayOfWeek` — enum nativo do .NET, não um tipo próprio deste
  projeto —, `StartTime`, `EndTime`, `Active`). Um profissional pode ter
  vários intervalos no mesmo dia (exemplo do próprio prompt: "Segunda:
  08:00-12:00, 13:00-17:00"). Um dia sem nenhum intervalo `Active` é, por
  definição, "indisponível" (exemplo da Quarta no prompt) — não existe um
  valor próprio para isso, é só a ausência de intervalos. `Reschedule`
  edita um intervalo existente (PUT); `Deactivate`/`Activate` fazem a
  remoção lógica (DELETE) — mesmo padrão de `ProfessionalService`.
- **`ProfessionalAvailabilityException`** — uma exceção pontual numa data
  (`Date`, `StartTime`/`EndTime` opcionais, `Type`, `Reason`).
  `ProfessionalAvailabilityExceptionType`: `Blocked` ("bloquear datas") ou
  `Available` ("liberar horários específicos", ex.: abrir um horário numa
  quarta normalmente indisponível). `StartTime`/`EndTime` nulos **em
  conjunto** representam o dia inteiro (`IsFullDay`); quando informados,
  são sempre os dois juntos (validado na própria entidade) e valem só
  para aquela janela dentro do dia. Ao contrário do restante do módulo,
  uma exceção **não tem "reativar"** — ela é, por natureza, um ajuste
  pontual e transitório; removê-la (`DELETE .../exceptions/{id}`) É o
  próprio ato de desbloquear/desliberar a data, então
  `IProfessionalAvailabilityExceptionRepository.RemoveAsync` é exclusão
  definitiva (hard delete), não desativação — única exceção a essa
  convenção em todo o módulo, documentada aqui e no próprio repositório.

### "Não permitir horários sobrepostos" — onde a regra vive

A regra pedida no prompt é uma interseção de intervalos, não uma simples
combinação de colunas — por isso não virou um índice único em
Infrastructure (ao contrário de, por exemplo, `ProfessionalService`).
Cada entidade expõe um método de comparação consigo mesma
(`ProfessionalAvailability.OverlapsWith(dayOfWeek, start, end)` e
`ProfessionalAvailabilityException.OverlapsWith(otherStart, otherEnd)`,
interseção clássica de intervalos `a < d && c < b`), e
`ProfessionalAvailabilityService` é quem carrega os demais registros do
profissional e pergunta a cada um se colide com o candidato — para
intervalos recorrentes, só entre o mesmo `DayOfWeek`; para exceções, só
entre a mesma `Date` (um bloqueio de dia inteiro colide com qualquer outra
exceção naquela data, cheia ou parcial). Ao editar um intervalo (PUT), a
checagem ignora o próprio registro sendo editado (`excludeId`) — senão um
intervalo colidiria consigo mesmo. "Não permitir StartTime >= EndTime" é
validado na própria entidade (`DomainException`, mapeada para 400) — não
depende de nenhum outro registro, então não precisa da Application.

### Timezone — por que não há um campo de fuso horário

"Timezone deverá ser tratado corretamente" (regra do prompt) foi resolvida
pela escolha de tipo, não por um campo novo: `StartTime`/`EndTime` usam
`TimeOnly` e `Date` usa `DateOnly` (tipos do .NET, não `DateTime`) — um
horário de parede/uma data civil **pura**, sem fuso nem offset embutidos.
Isso evita exatamente a ambiguidade de fuso/`DateTime.Kind` que `DateTime`
traria para um dado que é, por natureza, só "08:00" ou "25/12/2026" — não
importa o fuso do servidor que salvou nem o fuso do dispositivo que exibe.
O prompt não pediu um campo de fuso horário (`TimeZoneId`) na lista de
entidades, então nenhum foi adicionado; se um profissional algum dia
precisar de uma agenda em fuso diferente do restante do sistema, esse
campo pode ser adicionado depois sem quebrar o desenho atual (bastaria
guardar um IANA id junto de `Professional` e interpretar `TimeOnly`/
`DateOnly` relativos a ele). O provider Npgsql (EF Core) mapeia `TimeOnly`/
`DateOnly` nativamente para as colunas `time`/`date` do PostgreSQL desde a
v7 — nenhum conversor customizado foi necessário.

**Detalhe de serialização (JSON) que afeta o mobile:** o conversor padrão
do `System.Text.Json` para `TimeOnly` exige o formato completo `"HH:mm:ss"`
— `"08:00"` sozinho (sem segundos) é rejeitado na desserialização. Isso foi
confirmado rodando um pequeno teste manual durante a implementação. Por
isso `mobile/src/modules/professional/availabilityFormat.ts` expõe
`toApiTime`/`fromApiTime` para nunca vazar esse detalhe de formato para as
telas — o profissional só digita/vê "HH:MM".

### Um único endpoint GET para as quatro telas

A lista de endpoints do PROMPT 07 pede um único `GET availability`
(diferente de, por exemplo, o módulo Resident, que tem GETs separados por
recurso). Em vez de inventar GETs adicionais não pedidos, `GET
/api/professional/availability` devolve `ProfessionalAvailabilityOverviewResponse`
— agenda recorrente **e** exceções juntas, numa única consulta — e as
quatro telas React Native pedidas (AvailabilityScreen/AvailabilityEditor/
BlockedDatesScreen/CalendarAvailabilityScreen) partem todas dela no mobile
(uma única chave de cache no TanStack Query,
`['professional', 'availability', 'mine']`, invalidada por qualquer
mutação). Os demais endpoints seguem exatamente a lista do prompt:

- `GET /api/professional/availability`
- `POST /api/professional/availability` — cria um intervalo recorrente.
- `PUT /api/professional/availability/{id}` — edita um intervalo existente.
- `DELETE /api/professional/availability/{id}` — remoção lógica.
- `POST /api/professional/availability/exceptions` — cria uma exceção.
- `DELETE /api/professional/availability/exceptions/{id}` — remoção
  definitiva (ver nota sobre `ProfessionalAvailabilityException` acima).

Todos self-service (`[Authorize]`, sempre restritos a
`User.GetUserId()` — mesmo padrão de `ProfessionalProfileController`), sem
necessidade de uma interface de diretório público ou administrativa nesta
etapa: o prompt não pediu nenhuma tela para o morador ver a disponibilidade
de um profissional (isso é natural de Booking, que "Ainda NÃO" existe), só
telas para o próprio profissional configurar a agenda. Por isso
`IProfessionalAvailabilityService` é a única interface nova de Application
— ao contrário das Etapas 05/06, que precisaram de duas ou três.
`ProfessionalAvailabilityNotFoundException`/`OverlappingAvailabilityException`/
`ProfessionalAvailabilityExceptionNotFoundException` seguem no mesmo
arquivo `ProfessionalExceptions.cs` (convenção de um arquivo de exceções
por módulo) e no mesmo `ExceptionHandlingMiddleware`.

### React Native

- **`AvailabilityScreen`** — agenda recorrente agrupada por dia da semana
  (ordem PT-BR, segunda a domingo — `DAY_OF_WEEK_ORDER` em
  `availabilityFormat.ts`), cada dia com seus intervalos `Active` ou
  "Indisponível" quando não há nenhum; editar/remover por intervalo;
  botão "Adicionar horário" e atalhos para as outras duas telas. É a tela
  inicial da seção de disponibilidade (`app/(professional)/availability/index.tsx`).
- **`AvailabilityEditor`** — "configurar dias; configurar horários": dia
  da semana (botões, mesmo padrão de seleção por toggle de
  `ServicesSection` na Etapa 06) + início/término em texto livre
  "HH:MM", convertido para o formato da Api (`toApiTime`) só no envio. Um
  único componente cria (sem `id` na rota) ou edita (`id` de um intervalo
  existente) — mesmo padrão de reuso de formulário de
  `ProfessionalEditScreen`.
- **`BlockedDatesScreen`** — "bloquear datas; liberar horários
  específicos": formulário (data, tipo Bloquear/Liberar, dia inteiro ou
  horário específico, motivo opcional) mais a lista de exceções já
  cadastradas, cada uma com um botão remover.
- **`CalendarAvailabilityScreen`** — grade de mês própria (sem nenhuma
  biblioteca de calendário/data — este projeto não usa uma até agora;
  `buildMonthGrid` em `availabilityFormat.ts` calcula tudo com `Date`
  nativo), dias com exceção destacados por cor (bloqueado/liberado) e
  navegação entre meses; tocar num dia leva para `BlockedDatesScreen`
  (esta tela é só visualização + atalho, quem cria/remove é a outra).

Roteamento: as quatro telas ficam em `app/(professional)/availability/`
(diferente das telas do morador da Etapa 06, que ficam em
`(resident)/`) — aqui o consumidor é sempre o próprio profissional.
`ProfessionalEditScreen` ganhou o botão "Configurar disponibilidade"
apontando para `availability/index`, mesmo padrão do botão "Buscar
profissional" que a Etapa 06 adicionou em `ResidentHomeScreen`.

### Testes

`AvailabilityTests` (agenda recorrente: criação, `Start >= End` inválido,
sem perfil, sobreposição no mesmo dia/dias diferentes, edição sem colidir
consigo mesma, edição sobrepondo outro intervalo, isolamento entre
profissionais na edição/remoção, remover e readicionar o mesmo horário) e
`AvailabilityExceptionTests` (bloqueio de dia inteiro, janela parcial,
só um de início/término informado, sobreposição entre exceções na mesma
data — incluindo bloqueio de dia inteiro contra qualquer outra, datas
diferentes não conflitam, remoção definitiva e readição, isolamento entre
profissionais na remoção) — mesmo projeto `Professional.Application.Tests`
da Etapa 06, mesmos fakes em memória (`ProfessionalServiceTestFixture`
ganhou `CreateAvailabilitySut()`).

### Limitação do sandbox de build (Claude) nesta etapa

Mesma limitação das etapas anteriores: `Alilu.Modules.Professional.Infrastructure`,
`Alilu.Api` e os projetos de teste xUnit não puderam ser restaurados/
compilados aqui (pacotes NuGet só resolvíveis com acesso à internet, que
este sandbox não tem). O que **foi** verificado:

- `Alilu.Modules.Professional.Domain` e `Alilu.Modules.Professional.Application`
  (ambos sem dependências NuGet externas) compilam com **0 erros/0
  warnings**, com as duas novas entidades e o novo serviço.
- Toda a lógica de negócio desta etapa (sobreposição de intervalos e de
  exceções, validação de horário, remoção lógica vs. definitiva, isolamento
  entre profissionais) foi validada rodando manualmente contra fakes em
  memória (as mesmas implementações reais dos serviços) — **26
  verificações, todas passaram**.
- `python3 scripts/check-references.py` — **34 projetos, 0 violações, 0
  ciclos** (nenhum projeto novo nesta etapa, só arquivos dentro dos
  projetos já existentes do módulo Professional).
- Mobile: `npx tsc --noEmit` e `npx eslint .` — **0 erros/0 warnings** em
  todo o projeto (incluindo os oito arquivos novos e os quatro editados
  desta etapa).

Também confirmado por leitura cuidadosa (sem poder compilar): o
desserializador `TimeOnly`/`DateOnly` do .NET exige os formatos
`"HH:mm:ss"`/`"yyyy-MM-dd"` — testado isoladamente com
`System.Text.Json.JsonSerializer` num projeto console descartável (não
faz parte da entrega). Rode `dotnet restore && dotnet build`, `dotnet test
src/Modules/Professional/Application.Tests` e o comando de migration
(`dotnet ef migrations add AddProfessionalAvailability --project src/Infrastructure/Alilu.Infrastructure --startup-project src/Api/Alilu.Api`,
depois `dotnet ef database update ...`) na sua máquina para a verificação
completa.
