# Módulo: Professional

> Implementado na **Etapa 06** (PROMPT 06) — profissionais e diaristas:
> perfil profissional, categorias de serviço e o vínculo profissional↔
> condomínio — estendido na **Etapa 07** (PROMPT 07) — disponibilidade
> profissional (agenda recorrente + exceções) — e novamente na **Etapa 08**
> (PROMPT 08) com `ValidateAttendsCondominiumAsync`/`ValidateAvailableAsync`,
> usados pela Api para validar duas REGRAS CRÍTICAS do agendamento antes de
> chamar o módulo Scheduling. Ver as seções "Etapa 06 — módulo
> Professional (profissionais e diaristas)", "Etapa 07 — disponibilidade
> profissional" e "Etapa 08 — agendamento (Scheduling)" em
> `ARCHITECTURE.md` para as decisões de design.

## Responsabilidade

`Professional` (perfil), `ServiceCategory` (categoria de serviço —
Diarista, Jardineiro, Piscineiro, Eletricista, Encanador, Pedreiro,
Pintor), `ProfessionalService` (quais categorias um profissional oferece),
`ProfessionalCondominium` ("o profissional atende aquele condomínio"),
`ProfessionalAvailability` (agenda recorrente por dia da semana — Etapa
07) e `ProfessionalAvailabilityException` (bloqueio/liberação pontual numa
data — Etapa 07).

"Professional NÃO é automaticamente morador" (PROMPT 06) — este módulo não
tem nenhuma relação com `CondominiumMembership` (módulo Resident).

## O que NÃO está aqui (de propósito)

- **Booking/reservas/atendimentos** — vivem no módulo Scheduling (Etapa
  08), não aqui: este módulo só guarda o perfil/agenda do profissional
  (quem é, o que oferece, onde atende, quando está disponível); nenhuma
  entidade `Booking` foi adicionada a `Alilu.Modules.Professional.Domain`.
- **Diretório/consulta de disponibilidade pelo morador** — todos os
  endpoints de disponibilidade continuam self-service (só o próprio
  profissional consulta/edita a própria agenda). O único jeito de um
  morador saber se um horário está livre é a checagem pontual
  `GET .../availability-check` (Etapa 08, ver Endpoints abaixo) — nenhuma
  agenda completa é exposta publicamente.
- **Campo de fuso horário (`TimeZoneId`)** — não pedido pelo PROMPT 07 na
  lista de entidades; `TimeOnly`/`DateOnly` (sem fuso embutido) resolvem a
  regra "Timezone deverá ser tratado corretamente" sem precisar de um
  campo novo — ver ARCHITECTURE.md.
- **CRUD de categoria de serviço** — as sete categorias iniciais são
  inseridas por um seeder de desenvolvimento (`ServiceCategorySeeder`),
  não por um endpoint administrativo (não pedido pelo prompt).
- **Origem `ResidentRecommended`/`CompletedService`** — `ProfessionalCondominiumSource`
  já tem os quatro valores pedidos pelo prompt, mas só `ProfessionalRequested`
  tem um caminho de criação real nesta etapa. Os módulos Recommendations
  (Etapa 10) e Scheduling+Reviews (Etapas 08/09) já existem, mas nenhum
  deles foi conectado a este `Source` — a `Recommendation` da Etapa 10 é
  uma indicação de confiança independente, não um gatilho para criar/
  alterar um `ProfessionalCondominium`; nenhum dos prompts recebidos até
  agora pediu essa ligação, então ela continua em aberto para uma etapa
  futura.
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

Disponibilidade — self-service (`[Authorize]`, Etapa 07). `GET` devolve
agenda recorrente **e** exceções numa única resposta (só um GET pedido
pelo prompt) — ver ARCHITECTURE.md:

- `GET /api/professional/availability`
- `POST /api/professional/availability` — criar intervalo recorrente
- `PUT /api/professional/availability/{id}` — editar intervalo existente
- `DELETE /api/professional/availability/{id}` — remoção lógica
- `POST /api/professional/availability/exceptions` — criar exceção (bloqueio ou liberação)
- `DELETE /api/professional/availability/exceptions/{id}` — remoção definitiva (não é desativação — ver ARCHITECTURE.md)

Verificação de disponibilidade — Api-only, só-leitura (Etapa 08, usada
pelo fluxo de agendamento do módulo Scheduling): reaproveita
`ValidateAvailableAsync` sem expor a agenda completa, nunca lança erro por
indisponibilidade, sempre `200 { available }`:

- `GET /api/directory/professionals/{id}/availability-check?date=&startTime=&endTime=`

`ValidateAttendsCondominiumAsync`/`ValidateAvailableAsync` (Etapa 08) não
são endpoints próprios — são chamados pela Api dentro de `POST
/api/resident/bookings` (módulo Scheduling), antes de criar o
agendamento.

## Extensão usada pelo módulo Notifications (Etapa 11)

`IProfessionalDirectoryService.GetProfessionalUserIdAsync(professionalId)`
— não é um endpoint, um método novo do lado de quem é consultado (mesmo
padrão das extensões das Etapas 07/08/10): resolve o `User.Id` por trás de
um `professionalId`, que o DTO público `ProfessionalDirectoryItemResponse`
propositalmente não expõe. Usado pela Api (`BookingsController.Create`,
`ReviewsController.Create`, `BookingReminderBackgroundService`) para saber
quem notificar do lado do profissional — ver ARCHITECTURE.md, "Etapa 11".

## Extensão para o módulo Administration (Etapa 12)

Todo método de `IProfessionalAdministrationService` ganhou um
`scopeCondominiumId` opcional. Três métodos novos: `ListByCondominiumAsync`
("visualizar histórico"), `BlockAsync` ("Profissionais: bloquear" —
desativa só o vínculo com ESTE condomínio, nunca o `Professional.Status`
global) e `AssociateAsync` ("associar ao condomínio" — cadastro direto,
primeiro uso real de `ProfessionalCondominiumSource.AdminApproved`,
reservado desde a Etapa 06; precisou de uma nova dependência,
`IProfessionalRepository`, para validar que o profissional existe). Ver
ARCHITECTURE.md, "Etapa 12".
