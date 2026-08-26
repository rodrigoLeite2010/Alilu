# Módulo: Recommendations

> Implementado na **Etapa 10** (PROMPT 10): moradores recomendam
> profissionais que consideram confiáveis — diferente de uma `Review`
> (Etapa 09, sempre referente a um agendamento concluído DENTRO do ALILU),
> uma `Recommendation` pode se referir a um profissional nunca contratado
> pelo ALILU (indicação externa). Ver a seção "Etapa 10 — recomendações
> (Recommendations)" em `backend/ARCHITECTURE.md` para o design completo
> (entidade, regras, composição com os módulos Resident/Professional/Reviews,
> React Native, testes).

## Responsabilidade

`Recommendation` (a indicação — condomínio, morador, profissional do
ALILU **ou** indicação externa, categoria de serviço, comentário, status
de moderação). Fluxo: o morador recomenda um profissional (vinculado, se
ele já existe no ALILU, ou externo, com nome/telefone) → a indicação nasce
`Pending` → um administrador aprova, recusa ou (se já aprovada) bloqueia.

## O que NÃO está aqui (de propósito)

- **Validação de "morador Active pode recomendar"** — depende do módulo
  Resident; nenhum módulo referencia outro (PROMPT 01), então quem aplica
  essa REGRA CRÍTICA, antes de chamar este módulo, é a Api (composição
  raiz) — ver `RecommendationsController` e ARCHITECTURE.md. Do lado do
  Resident, o método já existente que expõe essa validação para a Api é
  `IMembershipService.GetMyActiveMembershipAsync` (nenhuma mudança de
  código foi necessária nesse módulo).
- **Validação de "o profissional já existe no ALILU"** — depende do
  módulo Professional; mesma REGRA CRÍTICA, mesmo papel da Api, mesmo
  método já existente reaproveitado (`IProfessionalDirectoryService.GetProfessionalProfileAsync`,
  também sem nenhuma mudança de código nesse módulo).
- **Nome do morador/profissional, nome da categoria** —
  `Recommendation` só guarda Ids; enriquecer para exibição é
  responsabilidade de quem consome a Api (mobile) ou da própria Api, no
  único endpoint composto desta etapa (ver abaixo).
- **A nota média (⭐) de um profissional** — pertence ao módulo Reviews
  (Etapa 09); este módulo só contribui com a contagem/lista de
  recomendações aprovadas. O "perfil de recomendações" público
  (nome + nota + contagem) é composto na Api, não aqui — ver
  `ProfessionalDirectoryController.GetRecommendationProfile`.
- **"✓ Já prestou serviço no condomínio"** — exigiria uma consulta ao
  módulo Scheduling, fora do escopo de uma etapa "SOMENTE Recommendations"
  — decisão de escopo documentada em ARCHITECTURE.md.

## Estrutura

```
Recommendations/
├── Domain/Alilu.Modules.Recommendations.Domain.csproj                  # Recommendation, RecommendationStatus
├── Application/Alilu.Modules.Recommendations.Application.csproj        # IRecommendationService (morador) / IRecommendationDirectoryService (público) / IRecommendationAdministrationService (admin), IUnitOfWork
├── Infrastructure/Alilu.Modules.Recommendations.Infrastructure.csproj  # EF Core, repositório
└── Application.Tests/Alilu.Modules.Recommendations.Application.Tests.csproj  # Testes xUnit dos casos de uso
```

## Regras de dependência (já aplicadas nos .csproj, verificadas por `scripts/check-references.py`)

- **Domain** referencia apenas `Alilu.Shared` — não depende de Application, Infrastructure ou de nenhum outro módulo.
- **Application** referencia apenas o **Domain deste mesmo módulo** — em particular, não referencia os módulos Resident/Professional/Reviews, mesmo que criar/exibir uma recomendação dependa deles (ver ARCHITECTURE.md).
- **Infrastructure** referencia o Domain e a Application **deste mesmo módulo**, além do `Alilu.Infrastructure` da raiz (para o `AliluDbContext` compartilhado).
- Nenhum projeto deste módulo referencia outro módulo, nem o `Alilu.Api`.

Regras de negócio ficam no Domain/Application. Controllers finos apenas
traduzem requisições HTTP em chamadas para a Application. Entidades nunca
são expostas diretamente pela API — sempre via DTOs.

## Endpoints

Self-service do morador (`RecommendationsController`, `api/resident/recommendations`, `[Authorize]`):

- `GET /api/resident/recommendations` — minhas recomendações
- `GET /api/resident/recommendations/{id}` — detalhe de uma recomendação própria
- `POST /api/resident/recommendations` — recomenda (composição completa com Resident/Professional — ver ARCHITECTURE.md)

Diretório público, composto na Api (`ProfessionalDirectoryController`, módulo Professional, `[Authorize]`):

- `GET /api/directory/professionals/{id}/recommendations` — "perfil de recomendações" (nome + nota + contagem/lista de aprovadas)

Moderação administrativa (`AdminRecommendationsController`, `api/admin/recommendations`, `[Authorize(Roles = "CondominiumAdmin,SuperAdmin")]`):

- `GET /api/admin/recommendations/pending` — fila de moderação
- `GET /api/admin/recommendations/condominiums/{condominiumId}` — todos os status (Etapa 12)
- `POST /api/admin/recommendations/{id}/approve`
- `POST /api/admin/recommendations/{id}/reject`
- `POST /api/admin/recommendations/{id}/block`

## Extensão para o módulo Administration (Etapa 12)

Todo método de `IRecommendationAdministrationService` ganhou um
`scopeCondominiumId` opcional. Um método novo, `ListByCondominiumAsync`
(qualquer status) — **necessário para "Recomendações: bloquear" funcionar
de verdade**: sem uma forma de listar recomendações já `Approved`, um
administrador não teria como descobrir o Id de uma para bloquear (o único
outro endpoint de leitura, `pending`, só devolve `Pending`). Ver
ARCHITECTURE.md, "Etapa 12".
