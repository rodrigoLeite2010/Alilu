# Módulo: Professional

> Implementado na **Etapa 06** (PROMPT 06) — profissionais e diaristas:
> perfil profissional, categorias de serviço e o vínculo profissional↔
> condomínio. Ver a seção "Etapa 06 — módulo Professional (profissionais e
> diaristas)" em `ARCHITECTURE.md` para as decisões de design.

## Responsabilidade

`Professional` (perfil), `ServiceCategory` (categoria de serviço —
Diarista, Jardineiro, Piscineiro, Eletricista, Encanador, Pedreiro,
Pintor), `ProfessionalService` (quais categorias um profissional oferece)
e `ProfessionalCondominium` ("o profissional atende aquele condomínio").

"Professional NÃO é automaticamente morador" (PROMPT 06) — este módulo não
tem nenhuma relação com `CondominiumMembership` (módulo Resident).

## O que NÃO está aqui (de propósito)

- **Agenda/disponibilidade/atendimentos** — "Ainda NÃO criar agenda"
  (PROMPT 06); fica para uma etapa futura (módulo Scheduling).
- **CRUD de categoria de serviço** — as sete categorias iniciais são
  inseridas por um seeder de desenvolvimento (`ServiceCategorySeeder`),
  não por um endpoint administrativo (não pedido pelo prompt).
- **Origem `ResidentRecommended`/`CompletedService`** — `ProfessionalCondominiumSource`
  já tem os quatro valores pedidos pelo prompt, mas só `ProfessionalRequested`
  tem um caminho de criação real nesta etapa; os outros dois dependem dos
  módulos Recommendations/Scheduling+Reviews, que ainda não existem.
- **Chamar o módulo Condominium diretamente** — nenhum módulo referencia
  outro (PROMPT 01). A validação do condomínio informado em "solicitar
  atendimento" é feita pelo módulo Condominium
  (`ICondominiumDirectoryService.ValidateCondominiumAsync`); quem
  orquestra os dois é a Api (composição raiz) — ver
  `ProfessionalProfileController`.

## Estrutura

```
Professional/
├── Domain/Alilu.Modules.Professional.Domain.csproj                  # Entidades, enums, regras de negócio
├── Application/Alilu.Modules.Professional.Application.csproj        # Casos de uso, DTOs, orquestração
├── Infrastructure/Alilu.Modules.Professional.Infrastructure.csproj  # EF Core (IEntityTypeConfiguration), repositórios, seed de dev
└── Application.Tests/Alilu.Modules.Professional.Application.Tests.csproj  # Testes xUnit dos casos de uso
```

## Regras de dependência (já aplicadas nos .csproj, verificadas por `scripts/check-references.py`)

- **Domain** referencia apenas `Alilu.Shared` — não depende de Application, Infrastructure ou de nenhum outro módulo.
- **Application** referencia apenas o **Domain deste mesmo módulo** — em particular, não referencia o módulo Condominium, mesmo que "solicitar atendimento" dependa dele (ver ARCHITECTURE.md).
- **Infrastructure** referencia o Domain e a Application **deste mesmo módulo**, além do `Alilu.Infrastructure` da raiz (para o `AliluDbContext` compartilhado — mesmo padrão dos módulos Identity/Condominium/Resident).
- Nenhum projeto deste módulo referencia outro módulo, nem o `Alilu.Api`.

Regras de negócio ficam no Domain/Application. Controllers finos apenas
traduzem requisições HTTP em chamadas para a Application. Entidades nunca
são expostas diretamente pela API — sempre via DTOs.

## Endpoints

Self-service (`[Authorize]` — qualquer usuário autenticado, sempre restrito ao próprio usuário):

- `GET /api/professional/profile` — meu perfil (204 se ainda não criado)
- `POST /api/professional/profile` — criar perfil
- `PUT /api/professional/profile` — editar perfil
- `GET /api/professional/profile/services` — meus serviços
- `POST /api/professional/profile/services` — adicionar serviço
- `DELETE /api/professional/profile/services/{id}` — remover serviço
- `GET /api/professional/profile/condominiums` — meus vínculos com condomínios
- `POST /api/professional/profile/condominiums` — solicitar atendimento em um condomínio

Diretório público (`[Authorize]` — qualquer usuário autenticado, usado pelo morador):

- `GET /api/directory/professionals/categories`
- `GET /api/directory/professionals?categoryId=`
- `GET /api/directory/professionals/{id}`

Administrativos (`[Authorize(Roles = "CondominiumAdmin,SuperAdmin")]`):

- `GET /api/admin/professional-condominiums/pending`
- `POST /api/admin/professional-condominiums/{id}/approve`
- `POST /api/admin/professional-condominiums/{id}/reject`
