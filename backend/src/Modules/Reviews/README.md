# Módulo: Reviews

> Implementado na **Etapa 09** (PROMPT 09): avaliações do morador sobre o
> profissional, referentes a um agendamento concluído. Ver a seção "Etapa
> 09 — avaliações (Reviews)" em `backend/ARCHITECTURE.md` para o design
> completo (entidade, regras, composição com o módulo Scheduling, React
> Native, testes).

## Responsabilidade

`Review` (a avaliação — agendamento, morador, profissional, nota de 1 a 5,
comentário opcional). Fluxo: o morador avalia um `Booking` `Completed` e
pode editar a própria avaliação depois; o profissional só visualiza as
avaliações recebidas e a própria média.

## O que NÃO está aqui (de propósito)

- **Validação de "Booking Completed" e "só o Resident daquele Booking pode
  avaliar"** — depende do módulo Scheduling; nenhum módulo referencia
  outro (PROMPT 01), então quem aplica essas REGRAS CRÍTICAS, antes de
  chamar este módulo, é a Api (composição raiz) — ver `ReviewsController`
  e ARCHITECTURE.md. Do lado do Scheduling, o método que expõe essa
  validação para a Api é `IBookingService.ValidateCompletedBookingForReviewAsync`.
- **Nome do morador/profissional** — `Review` só guarda Ids; a Api nunca
  devolve o nome do morador para o profissional (o prompt pediu
  "visualizar avaliações recebidas", não "saber quem avaliou").
- **Exposição pública da média para o morador** — o prompt só pediu
  "visualizar média" do lado do profissional; o diretório público de
  profissionais (módulo Professional) não ganhou um campo de rating nesta
  etapa.

## Estrutura

```
Reviews/
├── Domain/Alilu.Modules.Reviews.Domain.csproj                  # Review
├── Application/Alilu.Modules.Reviews.Application.csproj        # IReviewService (morador) / IProfessionalReviewService (profissional), IUnitOfWork
├── Infrastructure/Alilu.Modules.Reviews.Infrastructure.csproj  # EF Core (índice único em BookingId), repositórios
└── Application.Tests/Alilu.Modules.Reviews.Application.Tests.csproj  # Testes xUnit dos casos de uso
```

## Regras de dependência (já aplicadas nos .csproj, verificadas por `scripts/check-references.py`)

- **Domain** referencia apenas `Alilu.Shared` — não depende de Application, Infrastructure ou de nenhum outro módulo.
- **Application** referencia apenas o **Domain deste mesmo módulo** — em particular, não referencia o módulo Scheduling, mesmo que criar uma avaliação dependa de um agendamento de lá (ver ARCHITECTURE.md).
- **Infrastructure** referencia o Domain e a Application **deste mesmo módulo**, além do `Alilu.Infrastructure` da raiz (para o `AliluDbContext` compartilhado).
- Nenhum projeto deste módulo referencia outro módulo, nem o `Alilu.Api`.

Regras de negócio ficam no Domain/Application. Controllers finos apenas
traduzem requisições HTTP em chamadas para a Application. Entidades nunca
são expostas diretamente pela API — sempre via DTOs.

## Endpoints

Self-service dos dois lados (`[Authorize]`, sempre restritos ao próprio usuário):

Morador (`ReviewsController`, `api/resident/reviews`):

- `GET /api/resident/reviews` — avaliações feitas
- `GET /api/resident/reviews/booking/{bookingId}` — a avaliação deste agendamento, ou 204 sem corpo se ainda não existe
- `POST /api/resident/reviews` — avalia (composição completa com Scheduling — ver ARCHITECTURE.md)
- `PUT /api/resident/reviews/{id}` — edita a própria avaliação

Profissional (`ProfessionalReviewsController`, `api/professional/reviews`):

- `GET /api/professional/reviews` — avaliações recebidas
- `GET /api/professional/reviews/summary` — total + média (0/0 sem nenhuma avaliação)
