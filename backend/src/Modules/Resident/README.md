# Módulo: Resident

> Implementado na **Etapa 05** (PROMPT 05) — validação do morador: o
> vínculo seguro morador↔condomínio↔unidade. Ver a seção "Etapa 05 —
> módulo Resident (validação do morador)" em `ARCHITECTURE.md` para as
> decisões de design (por que a Api orquestra os dois módulos, o padrão
> de duas fases do resgate de convite, o índice único filtrado, etc.).

## Responsabilidade

`CondominiumMembership`: o vínculo do morador com um condomínio e sua
unidade específica — uma associação, não uma propriedade do usuário. Um
mesmo usuário pode ter vínculos com unidades diferentes (inclusive em
condomínios diferentes); o que não pode existir é mais de um vínculo
`Pending`/`Active` para a mesma combinação (usuário, condomínio, unidade).

Dois jeitos de nascer um vínculo:

- **FLUXO 1 (convite):** o morador digita um código de convite (emitido
  por um administrador — módulo Condominium, Etapa 04); o vínculo nasce
  já `Active`.
- **FLUXO 2 (solicitação — "Não encontrei minha unidade"):** o morador
  escolhe condomínio + unidade no diretório público; o vínculo nasce
  `Pending`, aguardando um administrador aprovar ou rejeitar.

## O que NÃO está aqui (de propósito)

- **Diaristas/prestadores de serviço** — fora de escopo desta etapa (ver
  PROMPT 05: "Não implementar diaristas ainda").
- **Nome/telefone do morador** — já existem em `Identity.User` (Etapa
  03); não são duplicados aqui.
- **"Um morador principal por unidade"** — regra explicitamente adiada
  pelo próprio PROMPT 05 ("se essa for a regra definida para o
  condomínio"); não há, ainda, conceito de morador principal vs.
  adicional.
- **Chamar o módulo Condominium diretamente** — nenhum módulo referencia
  outro (PROMPT 01). A validação de convite/diretório público é feita
  pelo módulo Condominium; quem orquestra os dois é a Api (composição
  raiz) — ver `ResidentMembershipsController`.

## Estrutura

```
Resident/
├── Domain/Alilu.Modules.Resident.Domain.csproj                  # CondominiumMembership, MembershipStatus
├── Application/Alilu.Modules.Resident.Application.csproj        # IMembershipService (self-service) / IMembershipAdministrationService (admin)
├── Infrastructure/Alilu.Modules.Resident.Infrastructure.csproj  # EF Core (IEntityTypeConfiguration), repositório, DI
└── Application.Tests/Alilu.Modules.Resident.Application.Tests.csproj  # Testes xUnit dos casos de uso
```

## Regras de dependência (já aplicadas nos .csproj, verificadas por `scripts/check-references.py`)

- **Domain** referencia apenas `Alilu.Shared` — não depende de Application, Infrastructure ou de nenhum outro módulo.
- **Application** referencia apenas o **Domain deste mesmo módulo** — em particular, não referencia o módulo Condominium, mesmo que o FLUXO 1 dependa dele (ver ARCHITECTURE.md).
- **Infrastructure** referencia o Domain e a Application **deste mesmo módulo**, além do `Alilu.Infrastructure` da raiz (para o `AliluDbContext` compartilhado — mesmo padrão dos módulos Identity/Condominium).
- Nenhum projeto deste módulo referencia outro módulo, nem o `Alilu.Api`.

Regras de negócio ficam no Domain/Application. Controllers finos apenas
traduzem requisições HTTP em chamadas para a Application. Entidades nunca
são expostas diretamente pela API — sempre via DTOs.

## Endpoints

Self-service (`[Authorize]` — qualquer usuário autenticado, sempre restrito ao próprio usuário):

- `GET /api/resident/memberships` — listar meus vínculos
- `GET /api/resident/memberships/active` — meu vínculo Active (204 se não houver — "acesso sem vínculo")
- `POST /api/resident/memberships/redeem-invitation` — FLUXO 1 (resgatar convite)
- `POST /api/resident/memberships/request-access` — FLUXO 2 (solicitar acesso)

Administrativos (`[Authorize(Roles = "CondominiumAdmin,SuperAdmin")]`):

- `GET /api/admin/memberships/pending` — fila de solicitações (FLUXO 2)
- `POST /api/admin/memberships/{id}/approve`
- `POST /api/admin/memberships/{id}/reject`
- `POST /api/admin/memberships/{id}/block`

Diretório público de condomínios/unidades (módulo Condominium, `[Authorize]`, usado pelo FLUXO 2):

- `GET /api/directory/condominiums`
- `GET /api/directory/condominiums/{condominiumId}/units`
