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

## Extensão usada pelo módulo Administration (Etapa 12)

`IAuthService.GetUsersByIdsAsync(userIds)` (sem endpoint próprio) — uma
única consulta em lote ("sem nenhuma query N+1"), ids desconhecidos são
omitidos, nunca lançam. Usado pela Api (`AdminMembershipsController`) para
compor nome/e-mail nas respostas de "Moradores: listar/visualizar" —
`CondominiumMembership` (módulo Resident) só guarda `UserId`, sem nome —
ver ARCHITECTURE.md, "Etapa 12".
