# Módulo: Identity

> Os três projetos deste módulo (Domain/Application/Infrastructure) já
> existem e compilam, mas **nenhuma entidade ou regra de negócio foi
> implementada ainda** — isso está reservado para uma etapa futura
> (ver PROMPT 01, Etapa 01: Backend modular).

## Responsabilidade

Autenticação, contas de usuário, senhas, tokens JWT e refresh tokens. Um usuário pode futuramente ter vínculo com mais de um condomínio.

## Estrutura

```
Identity/
├── Domain/Alilu.Modules.Identity.Domain.csproj                  # Entidades, Value Objects, regras de negócio
├── Application/Alilu.Modules.Identity.Application.csproj        # Casos de uso, DTOs, orquestração
└── Infrastructure/Alilu.Modules.Identity.Infrastructure.csproj  # EF Core (IEntityTypeConfiguration), repositórios, integrações
```

## Regras de dependência (já aplicadas nos .csproj, verificadas por `scripts/check-references.py`)

- **Domain** referencia apenas `Alilu.Shared` — não depende de Application, Infrastructure ou de nenhum outro módulo.
- **Application** referencia apenas o **Domain deste mesmo módulo**.
- **Infrastructure** referencia o Domain e a Application **deste mesmo módulo**, e implementará a persistência (EF Core/Npgsql) e integrações quando o módulo for construído.
- Nenhum projeto deste módulo referencia outro módulo, nem o `Alilu.Api`.

Regras de negócio ficam no Domain/Application. Controllers finos apenas
traduzem requisições HTTP em chamadas para a Application. Entidades nunca
são expostas diretamente pela API — sempre via DTOs.

## Configuração do Refresh Token (Etapa 15)

`AuthOptions.RefreshTokenLifetime` (30 dias por padrão, desde a Etapa 03)
agora é de fato configurável via `Auth:RefreshTokenLifetimeDays` no
appsettings (ou `Auth__RefreshTokenLifetimeDays` como variável de
ambiente) — antes desta correção, `AddIdentityModule` sempre registrava
`new AuthOptions()` (o construtor sem parâmetros), ignorando
silenciosamente qualquer valor que alguém configurasse. Sem a chave
configurada, o comportamento continua idêntico ao de sempre (30 dias). Ver
`backend/ARCHITECTURE.md`, "Etapa 15", e
`Infrastructure/DependencyInjection.cs`.

## Bootstrap do primeiro SuperAdmin (Etapa 16)

Antes desta etapa, o único jeito de existir um usuário com papel
`CondominiumAdmin`/`SuperAdmin` era um `UPDATE` manual direto no banco —
`User.Register` (autocadastro público) sempre rejeitou os dois papéis
administrativos, e não existe (nem deve existir) um endpoint público de
"criar admin". `Infrastructure/Seed/SuperAdminBootstrapper` cobre esse
primeiro degrau: ao subir a aplicação (`Program.cs`, em QUALQUER
ambiente — diferente dos seeds abaixo, que são só Development), se
`Bootstrap:SuperAdminEmail`/`Bootstrap:SuperAdminPassword` estiverem
configurados (vazios por padrão em todo appsettings — mesma filosofia de
segredo-via-variável-de-ambiente de `Jwt:Secret`) e ainda não existir um
usuário com esse e-mail, cria um `SuperAdmin` com
`User.CreateAdministrative` (o espelho de `User.Register`: só aceita
`CondominiumAdmin`/`SuperAdmin`, nunca chamado a partir de uma requisição
HTTP). Idempotente — não recria nem promove uma conta existente com outro
papel. `appsettings.Development.json` já vem com um valor de
desenvolvimento pronto (`superadmin@alilu.dev` / `SuperAdmin123!`), então
`dotnet run` sobe com um SuperAdmin funcional sem nenhum passo manual.

Depois que o primeiro SuperAdmin existir, promover outros administradores
usa `AdminCondominiumAdministratorsController` (módulo Administration) só
para o vínculo administrador↔condomínio — trocar o `Role` de um usuário já
cadastrado continua sendo uma operação de banco, por não ter sido pedida
em nenhum PROMPT até agora.

## Extensão usada pelo módulo Administration (Etapa 12)

`IAuthService.GetUsersByIdsAsync(userIds)` (sem endpoint próprio) — uma
única consulta em lote ("sem nenhuma query N+1"), ids desconhecidos são
omitidos, nunca lançam. Usado pela Api (`AdminMembershipsController`) para
compor nome/e-mail nas respostas de "Moradores: listar/visualizar" —
`CondominiumMembership` (módulo Resident) só guarda `UserId`, sem nome —
ver ARCHITECTURE.md, "Etapa 12".
