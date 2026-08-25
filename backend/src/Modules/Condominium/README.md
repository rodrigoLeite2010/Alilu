# Módulo: Condominium

> Implementado na **Etapa 04** (PROMPT 04). Cadastro administrativo de
> condomínios, unidades e convites de associação — ver a seção
> "Etapa 04 — módulo Condominium" em `ARCHITECTURE.md` para as decisões de
> design.

## Responsabilidade

Cadastro de condomínios (multi-condomínio desde o início) e suas unidades,
e emissão/consulta de convites de associação a uma unidade. Validação
inicial: Condomínio Monte Carlo.

## O que NÃO está aqui (de propósito)

- Nenhum vínculo morador↔condomínio↔unidade — quem *resgata* um convite e
  se torna morador de uma unidade é responsabilidade do módulo Resident
  (futuro, ainda não implementado).
- Nenhum envio real de e-mail/WhatsApp do código do convite — o código
  bruto é devolvido uma única vez na resposta de criação do convite (ver
  `CondominiumInvitationCreatedResponse`), para o administrador repassar
  manualmente, mesma honestidade de escopo do `NoOpEmailSender` no módulo
  Identity.

## Estrutura

```
Condominium/
├── Domain/Alilu.Modules.Condominium.Domain.csproj                  # Entidades, Value Objects, regras de negócio
├── Application/Alilu.Modules.Condominium.Application.csproj        # Casos de uso, DTOs, orquestração
├── Infrastructure/Alilu.Modules.Condominium.Infrastructure.csproj  # EF Core (IEntityTypeConfiguration), repositórios, seed de dev
└── Application.Tests/Alilu.Modules.Condominium.Application.Tests.csproj  # Testes xUnit dos casos de uso
```

## Regras de dependência (já aplicadas nos .csproj, verificadas por `scripts/check-references.py`)

- **Domain** referencia apenas `Alilu.Shared` — não depende de Application, Infrastructure ou de nenhum outro módulo.
- **Application** referencia apenas o **Domain deste mesmo módulo**.
- **Infrastructure** referencia o Domain e a Application **deste mesmo módulo**, além do `Alilu.Infrastructure` da raiz (para o `AliluDbContext` compartilhado — mesmo padrão do módulo Identity).
- Nenhum projeto deste módulo referencia outro módulo, nem o `Alilu.Api`.

Regras de negócio ficam no Domain/Application. Controllers finos apenas
traduzem requisições HTTP em chamadas para a Application. Entidades nunca
são expostas diretamente pela API — sempre via DTOs.

## Endpoints (todos administrativos — `[Authorize(Roles = "CondominiumAdmin,SuperAdmin")]`)

- `POST /api/admin/condominiums` — criar condomínio
- `GET /api/admin/condominiums` — listar condomínios
- `POST /api/admin/condominiums/{condominiumId}/units` — criar unidade
- `GET /api/admin/condominiums/{condominiumId}/units` — listar unidades
- `POST /api/admin/condominiums/{condominiumId}/invitations` — criar convite
- `GET /api/admin/invitations/{id}` — consultar convite
