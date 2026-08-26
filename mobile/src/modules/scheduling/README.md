# Módulo: scheduling

> Implementado na **Etapa 08** (PROMPT 08 — "o módulo mais crítico").
> Ver a seção "Etapa 08 — agendamento (Scheduling)" em
> `backend/ARCHITECTURE.md` para o design completo (backend + mobile).
> Desde a **Etapa 09**, `BookingDetailsScreen` ganhou uma prop opcional
> `reviewSlot` (render-prop) para o botão "Avaliar"/"Ver avaliação" —
> ver `modules/reviews/README.md` e a seção "Etapa 09 — avaliações
> (Reviews)" em `backend/ARCHITECTURE.md`. Este módulo continua sem
> importar `modules/reviews`.

## Responsabilidade

Oito telas, divididas entre os dois papéis:

- **`ProfessionalBookingScreen`** / **`DateSelectionScreen`** /
  **`TimeSelectionScreen`** / **`BookingServicesScreen`** /
  **`BookingConfirmationScreen`** (morador) — os cinco passos do fluxo de
  agendamento ("escolher profissional → escolher data → verificar
  disponibilidade → escolher horário → selecionar serviços → adicionar
  observações → enviar solicitação"), encadeados via parâmetros de rota
  do expo-router. Roteadas em
  `app/(resident)/booking/[professionalId]/{index,date,time,services,confirm}.tsx`,
  acessíveis a partir de "Agendar" em `ProfessionalProfileScreen`
  (módulo Professional).
- **`MyBookingsScreen`** / **`BookingDetailsScreen`** (morador) — "meus
  agendamentos" e o detalhe de um agendamento, com cancelamento. Roteadas
  em `app/(resident)/bookings/{index,[id]}.tsx`, acessíveis a partir de
  "Meus agendamentos" em `ResidentHomeScreen` (módulo Resident).
- **`ProfessionalRequestsScreen`** / **`BookingDetailsScreen`**
  (profissional) — "solicitações recebidas; aceitar; recusar" (mais
  iniciar/concluir/marcar não comparecimento/cancelar).
  `BookingDetailsScreen` é o **mesmo componente** das duas visões — só a
  prop `role` muda. Roteadas em
  `app/(professional)/requests/{index,[id]}.tsx`, acessíveis a partir de
  "Solicitações" em `ProfessionalEditScreen` (módulo Professional).

## Composição no app, espelhando a Api

Assim como nenhum módulo do backend referencia outro (a Api é quem
compõe — ver `BookingsController`), nenhum arquivo deste módulo importa
`modules/resident`/`modules/professional` diretamente. Os DTOs enxutos
que as telas precisam exibir (`BookingProfessionalSummary`/
`BookingMembershipSummary`/`BookingCondominiumSummary`/
`BookingUnitSummary`, em `types.ts`) são duplicados aqui — mesma
convenção de `CondominiumSummary` duplicado entre `resident`/
`professional` desde a Etapa 06. Quem resolve os dados de verdade (perfil
do profissional, vínculo Active do morador) e os passa como props prontos
é a camada de rotas (`app/(resident)/booking/[professionalId]/*.tsx`),
o mesmo papel que os controllers cumprem no backend.

## Estrutura

```
scheduling/
├── types.ts                # espelha os DTOs do backend (Dtos.cs, BookingStatus)
├── schedulingFormat.ts      # rótulos PT-BR, conversão HH:MM ↔ HH:mm:ss, grade de calendário, formatação de data/hora
├── api.ts                   # chamadas HTTP cruas (sem React) — bookingApi/professionalBookingApi/availabilityCheckApi/schedulingDirectoryApi
├── hooks.ts                 # TanStack Query sobre api.ts
├── schemas.ts                # validação de formulário (Zod) — horário, observações
├── screens/                   # as oito telas listadas acima
└── index.ts                   # barrel export
```

`schedulingDirectoryApi` (em `api.ts`) duplica de propósito chamadas já
existentes em `modules/professional/api.ts`/`modules/resident/api.ts` —
mesma convenção de módulos não se importarem entre si — só para
enriquecer a exibição (nome do profissional/condomínio/categoria a partir
de um Id salvo num `Booking`), mesmo espírito de `ResidentHomeScreen`
desde a Etapa 05.

## Nota sobre o formato de horário

A Api usa `TimeOnly`/`DateOnly` (.NET) — o desserializador padrão exige
`"HH:mm:ss"` (com segundos) e `"yyyy-MM-dd"`, não aceita `"HH:mm"` sozinho
(mesma observação do módulo `professional`, Etapa 07).
`schedulingFormat.ts#toApiTime`/`fromApiTime` fazem a conversão nos dois
sentidos — as telas só pedem "HH:MM" ao morador.

## "Nunca confiar no calendário do React Native"

`TimeSelectionScreen` não lista horários livres (o módulo Professional
não expõe a agenda publicamente) — o morador digita um horário candidato
e pede uma checagem explícita (`GET .../availability-check`); mudar
qualquer um dos campos invalida a checagem anterior. A verificação que de
fato impede um agendamento inválido é a repetida no servidor dentro de
`POST /api/resident/bookings`.
