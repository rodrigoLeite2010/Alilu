# Módulo: professional

> Implementado na **Etapa 06** (PROMPT 06) — perfil profissional,
> categorias de serviço e "solicitar atendimento em condomínios" — e
> estendido na **Etapa 07** (PROMPT 07) — disponibilidade (agenda
> recorrente + exceções). Ver as seções "Etapa 06 — módulo Professional" e
> "Etapa 07 — disponibilidade profissional" em `backend/ARCHITECTURE.md`
> para o design completo (backend + mobile). Booking/reservas/atendimentos
> ainda **não** foram implementados ("Ainda NÃO criar Booking" — PROMPT 07).

## Responsabilidade

Oito telas, divididas entre os dois papéis:

- **`ProfessionalEditScreen`** (profissional) — "editar perfil; selecionar
  serviços" + "solicitar atendimento em condomínios" + atalho "Configurar
  disponibilidade". É a própria tela inicial do profissional
  (`app/(professional)/index.tsx` é o gate: sem perfil ainda → formulário
  de criação; com perfil → o perfil completo, mesmo padrão do gate de
  `(resident)/index.tsx`).
- **`AvailabilityScreen`** / **`AvailabilityEditor`** /
  **`BlockedDatesScreen`** / **`CalendarAvailabilityScreen`**
  (profissional, Etapa 07) — "configurar dias; configurar horários;
  bloquear datas; liberar horários específicos". Roteadas em
  `app/(professional)/availability/` (index/editor/blocked-dates/calendar).
- **`ServiceCategoryScreen`** / **`ProfessionalListScreen`** /
  **`ProfessionalProfileScreen`** (morador) — "listar profissionais;
  filtrar categoria; visualizar perfil". Ficam roteadas em
  `app/(resident)/` (não em `app/(professional)/`), porque quem as usa é
  o morador — ver `ResidentHomeScreen`, botão "Buscar profissional".

## Estrutura

```
professional/
├── types.ts               # espelha os DTOs do backend (Dtos.cs, enums)
├── api.ts                 # chamadas HTTP cruas (sem React) — profileApi/directoryApi/condominiumDirectoryApi/availabilityApi
├── hooks.ts                # TanStack Query sobre api.ts
├── schemas.ts               # validação de formulário (Zod) — perfil, intervalo de agenda, exceção
├── availabilityFormat.ts    # rótulos PT-BR, conversão de horário (HH:MM ↔ HH:mm:ss da Api) e grade de calendário — Etapa 07
├── screens/                  # as oito telas listadas acima
└── index.ts                  # barrel export
```

## Nota sobre o formato de horário (Etapa 07)

A Api usa `TimeOnly`/`DateOnly` (.NET) — o desserializador padrão exige
`"HH:mm:ss"` (com segundos) e `"yyyy-MM-dd"`, não aceita `"HH:mm"` sozinho.
As telas só pedem "HH:MM" ao profissional; `availabilityFormat.ts` faz a
conversão nos dois sentidos (`toApiTime`/`fromApiTime`) para nunca vazar
esse detalhe de formato para os componentes de UI — ver ARCHITECTURE.md
para como isso foi confirmado.
