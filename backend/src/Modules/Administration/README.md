# Módulo: Administration

> Implementado na **Etapa 12** (PROMPT 12): não é um módulo de negócio
> como os anteriores — é o núcleo de autorização que fecha o buraco aberto
> desde a Etapa 04 ("CondominiumAdmin somente pode administrar seu próprio
> condomínio", nunca verificado até aqui). Ver a seção "Etapa 12 —
> administração (Administration)" em `backend/ARCHITECTURE.md` para o
> design completo (entidade, `AdminScope`, o padrão repetido nos cinco
> módulos de negócio, endpoints, `admin-web`, testes).

## Responsabilidade

- **`CondominiumAdministrator`** — o vínculo "este `CondominiumAdmin`
  administra este condomínio" (um condomínio por administrador nesta
  etapa). Um SuperAdmin cria/reatribui via `AdminCondominiumAdministratorsController`.
- **`IAdminScopeService.ResolveScopeAsync`** — chamado pela Api no início
  de todo endpoint administrativo (deste módulo e dos módulos Condominium/
  Resident/Professional/Recommendations), devolve um `AdminScope`
  (`CondominiumId` nulo = SuperAdmin, acesso irrestrito; não-nulo = o
  único condomínio de um CondominiumAdmin). É esse valor, nunca nada vindo
  do frontend, que a Api repassa a cada módulo de negócio como o novo
  parâmetro opcional `scopeCondominiumId`.

## O que NÃO está aqui (de propósito)

- **As telas/regras de "Moradores"/"Unidades"/"Profissionais"/
  "Recomendações"** — continuam nos módulos Resident/Condominium/
  Professional/Recommendations, respectivamente; este módulo não conhece
  nenhum deles (independência de módulos, PROMPT 01). Ele só fornece o
  `AdminScope` que a Api usa para restringir as chamadas a esses módulos.
- **O dashboard em si** (contagens de moradores/unidades/agendamentos/
  etc.) — é composto na Api (`AdminDashboardController`), não aqui: este
  módulo não tem como saber quantos moradores um condomínio tem sem
  referenciar o módulo Resident, o que a Etapa 01 proíbe.
- **Suporte a um CondominiumAdmin administrar mais de um condomínio** —
  decisão de escopo de MVP; `CondominiumAdministrator` modela um vínculo
  por usuário (upsert substitui, nunca duplica). Extensão direta se
  precisar no futuro.
- **Validação cruzada em `AssignAsync`** (que `userId` é de fato um
  CondominiumAdmin, que `condominiumId` existe) — fica a critério do
  SuperAdmin que usa o endpoint; ver ARCHITECTURE.md.

## Estrutura

```
Administration/
├── Domain/Alilu.Modules.Administration.Domain.csproj                  # CondominiumAdministrator
├── Application/Alilu.Modules.Administration.Application.csproj        # AdminScope, IAdminScopeService, DTOs, IUnitOfWork
├── Infrastructure/Alilu.Modules.Administration.Infrastructure.csproj  # EF Core, repositório
└── Application.Tests/Alilu.Modules.Administration.Application.Tests.csproj  # Testes xUnit
```

## Regras de dependência (já aplicadas nos .csproj, verificadas por `scripts/check-references.py`)

- **Domain** referencia apenas `Alilu.Shared` — não depende de Application, Infrastructure ou de nenhum outro módulo.
- **Application** referencia apenas o **Domain deste mesmo módulo**.
- **Infrastructure** referencia o Domain e a Application **deste mesmo módulo**, além do `Alilu.Infrastructure` da raiz (para o `AliluDbContext` compartilhado).
- Nenhum projeto deste módulo referencia outro módulo, nem o `Alilu.Api`.

Regras de negócio ficam no Domain/Application. Controllers finos apenas
traduzem requisições HTTP em chamadas para a Application. Entidades nunca
são expostas diretamente pela API — sempre via DTOs.

## Endpoints

`AdminCondominiumAdministratorsController` (`api/admin/condominium-administrators`, **SuperAdmin-only**):

- `GET /api/admin/condominium-administrators` — listar todas as atribuições
- `POST /api/admin/condominium-administrators` — atribuir/reatribuir um CondominiumAdmin a um condomínio

`AdminDashboardController` (`api/admin/dashboard`, `[Authorize(Roles = "CondominiumAdmin,SuperAdmin")]`) — composto a partir de cinco módulos, ver ARCHITECTURE.md:

- `GET /api/admin/dashboard?condominiumId={id}` — moradores, unidades, profissionais, agendamentos, solicitações pendentes, recomendações pendentes

## ⚠️ Pendência operacional — leia antes de testar qualquer coisa

Não existe seed de desenvolvimento para `CondominiumAdministrator`. Um
CondominiumAdmin recém-cadastrado (ou já existente, de antes desta etapa)
**não consegue administrar nada** até um SuperAdmin chamar:

```
POST /api/admin/condominium-administrators
{ "userId": "<guid do usuário CondominiumAdmin>", "condominiumId": "<guid do condomínio 'Monte Carlo'>" }
```

Sem isso, todo endpoint administrativo que esse usuário chamar responde
403 (`AdminNotAssignedToCondominiumException`). Isso é intencional (ver
ARCHITECTURE.md) — não é um bug.
