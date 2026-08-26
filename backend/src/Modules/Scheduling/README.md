# Módulo: Scheduling

> Implementado na **Etapa 08** (PROMPT 08 — "o módulo mais crítico"):
> agendamento de serviços entre morador e profissional. Ver a seção
> "Etapa 08 — agendamento (Scheduling)" em `backend/ARCHITECTURE.md` para
> o design completo (entidades, transições de status, concorrência,
> composição entre módulos, React Native, testes).

## Responsabilidade

`Booking` (uma solicitação de agendamento — profissional, morador,
condomínio/unidade, data/horário, status, observações) e `BookingItem`
(um serviço escolhido dentro do agendamento). Fluxo central do MVP:
morador escolhe profissional → escolhe data → verifica disponibilidade →
escolhe horário → seleciona serviços → adiciona observações → envia
solicitação; profissional recebe → aceita ou recusa (e depois inicia,
conclui, marca não comparecimento ou cancela).

## O que NÃO está aqui (de propósito)

- **Validação de Membership Active, "profissional atende o condomínio" e
  "horário disponível"** — dependem dos módulos Resident e Professional;
  nenhum módulo referencia outro (PROMPT 01), então quem aplica essas
  REGRAS CRÍTICAS, em sequência, antes de chamar este módulo, é a Api
  (composição raiz) — ver `BookingsController` e ARCHITECTURE.md.
- **Nome do morador/profissional, nome do condomínio, código da unidade,
  nome das categorias de serviço** — `Booking`/`BookingItem` só guardam
  Ids; enriquecer para exibição é responsabilidade de quem consome a Api
  (mobile), consultando os diretórios públicos de cada módulo.
- **Avaliações/reviews** — módulo próprio (`Reviews`, Etapa 09). Este
  módulo expõe um único ponto de extensão para isso —
  `IBookingService.ValidateCompletedBookingForReviewAsync(residentId, bookingId)`
  — que a Api chama antes de deixar o módulo Reviews criar/editar uma
  avaliação ("somente Booking Completed pode ser avaliado" + "somente o
  Resident daquele Booking pode avaliar"); `Scheduling` continua sem
  referenciar `Reviews` nem saber que ele existe.

## Estrutura

```
Scheduling/
├── Domain/Alilu.Modules.Scheduling.Domain.csproj                  # Booking, BookingItem, BookingStatus
├── Application/Alilu.Modules.Scheduling.Application.csproj        # IBookingService (morador) / IProfessionalBookingService (profissional), IUnitOfWork
├── Infrastructure/Alilu.Modules.Scheduling.Infrastructure.csproj  # EF Core, UnitOfWork (transação Serializable), repositórios
└── Application.Tests/Alilu.Modules.Scheduling.Application.Tests.csproj  # Testes xUnit dos casos de uso
```

## Regras de dependência (já aplicadas nos .csproj, verificadas por `scripts/check-references.py`)

- **Domain** referencia apenas `Alilu.Shared` — não depende de Application, Infrastructure ou de nenhum outro módulo.
- **Application** referencia apenas o **Domain deste mesmo módulo** — em particular, não referencia os módulos Resident/Professional/Condominium, mesmo que a criação de um agendamento dependa deles (ver ARCHITECTURE.md).
- **Infrastructure** referencia o Domain e a Application **deste mesmo módulo**, além do `Alilu.Infrastructure` da raiz (para o `AliluDbContext` compartilhado e a transação `Serializable`, que usa `Npgsql.PostgresException` só aqui — nunca vaza para a Application).
- Nenhum projeto deste módulo referencia outro módulo, nem o `Alilu.Api`.

Regras de negócio ficam no Domain/Application. Controllers finos apenas
traduzem requisições HTTP em chamadas para a Application. Entidades nunca
são expostas diretamente pela API — sempre via DTOs.

## Endpoints

Self-service dos dois lados (`[Authorize]`, sempre restritos ao próprio usuário):

Morador (`BookingsController`, `api/resident/bookings`):

- `GET /api/resident/bookings` — meus agendamentos
- `GET /api/resident/bookings/{id}`
- `POST /api/resident/bookings` — cria a solicitação (composição completa com Resident/Professional — ver ARCHITECTURE.md)
- `POST /api/resident/bookings/{id}/cancel`

Profissional (`ProfessionalBookingsController`, `api/professional/bookings`):

- `GET /api/professional/bookings?status=` — solicitações recebidas
- `GET /api/professional/bookings/{id}`
- `POST /api/professional/bookings/{id}/accept`
- `POST /api/professional/bookings/{id}/reject`
- `POST /api/professional/bookings/{id}/cancel`
- `POST /api/professional/bookings/{id}/start`
- `POST /api/professional/bookings/{id}/complete`
- `POST /api/professional/bookings/{id}/no-show`

Verificação de disponibilidade (Api-only, módulo Professional, reaproveitada por este fluxo):

- `GET /api/directory/professionals/{id}/availability-check?date=&startTime=&endTime=`

## Extensão usada pelo módulo Notifications (Etapa 11)

`IBookingService.ListConfirmedBookingsByDateRangeAsync`/
`IBookingRepository.ListConfirmedByScheduledDateRangeAsync` — não são
endpoints, um método novo do lado de quem é consultado (mesmo padrão das
extensões das Etapas 07/08/10): lista agendamentos `Confirmed` num
intervalo de datas. Usado só por `BookingReminderBackgroundService`
(`Alilu.Api`) para encontrar os agendamentos candidatos ao lembrete de
serviço — ver ARCHITECTURE.md, "Etapa 11".

## Extensão para o módulo Administration (Etapa 12)

`IBookingService.ListBookingsByCondominiumIdAsync`/
`IBookingRepository.ListByCondominiumIdAsync` — todos os agendamentos
(qualquer status) de um condomínio, usado pelo dashboard administrativo
("agendamentos") e por "Profissionais: visualizar histórico".
Deliberadamente **sem** `scopeCondominiumId`/checagem de papel própria
(mesma decisão de design de `ListConfirmedBookingsByDateRangeAsync`
acima): este módulo nunca teve conceito de autorização administrativa; a
Api resolve o escopo (`Administration.IAdminScopeService`) e só chama isto
depois — ver ARCHITECTURE.md, "Etapa 12".

## Correção de concorrência (Etapa 14 — auditoria)

`UnitOfWork.ExecuteInSerializableTransactionAsync` (Infrastructure) só
reconhecia a falha de serialização do PostgreSQL (SQLSTATE `40001`) quando
ela chegava embrulhada numa `DbUpdateException` — o caso mais comum na
prática (falha só no `CommitAsync`, fora do pipeline do EF Core) chegava
como `PostgresException` crua e escapava como erro 500 genérico em vez do
409 (`BookingConflictException`) que esta REGRA CRÍTICA promete. Corrigido
reconhecendo os dois formatos. Ver ARCHITECTURE.md, "Etapa 14", para o
relatório completo da auditoria.
