# Módulo: reviews

> Implementado na **Etapa 09** (PROMPT 09) — avaliações do morador sobre o
> profissional, referentes a um agendamento concluído. Ver a seção "Etapa
> 09 — avaliações (Reviews)" em `backend/ARCHITECTURE.md` para o design
> completo (backend + mobile).

## Responsabilidade

Duas telas, divididas entre os dois papéis:

- **`ReviewScreen`** (morador) — "avaliar profissional" **e** "editar
  avaliação" na mesma tela (decide o modo consultando se já existe uma
  avaliação para o agendamento). Roteada em
  `app/(resident)/bookings/[id]/review.tsx`, acessível a partir do botão
  "Avaliar"/"Ver avaliação" que `BookingDetailsScreen` (módulo
  `scheduling`) mostra quando o agendamento está `Completed`.
- **`ProfessionalReviewsScreen`** (profissional) — "visualizar avaliações
  recebidas; visualizar média" (usa o componente `RatingSummary`). Roteada
  em `app/(professional)/reviews/index.tsx`, acessível a partir de
  "Avaliações" em `ProfessionalEditScreen` (módulo Professional).

## Composição no app, espelhando a Api

Assim como o módulo Scheduling não referencia os módulos
Resident/Professional (Etapa 08), este módulo não importa `modules/scheduling`
nem `modules/professional`. O problema inverso — `BookingDetailsScreen`
(módulo `scheduling`) precisar mostrar um botão que leva para cá sem
importar `modules/reviews` — é resolvido do lado de lá com um render-prop
(`reviewSlot`); quem preenche esse slot é a rota hospedeira
(`app/(resident)/bookings/[id]/index.tsx`), que importa `modules/reviews`
livremente (rotas não têm essa restrição, mesmo papel dos controllers da
Api) — ver ARCHITECTURE.md para o desenho completo.

## Estrutura

```
reviews/
├── types.ts             # espelha os DTOs do backend (Dtos.cs)
├── reviewsFormat.ts      # estrelas (★/☆) e formatação de data
├── api.ts                # chamadas HTTP cruas (sem React) — reviewApi/professionalReviewApi
├── hooks.ts              # TanStack Query sobre api.ts
├── schemas.ts             # validação de formulário (Zod) — nota, comentário
├── components/
│   └── RatingSummary.tsx  # média + total, usado só em ProfessionalReviewsScreen
├── screens/                # as duas telas listadas acima
└── index.ts                # barrel export
```

## Nota sobre o seletor de nota

`ReviewScreen` escolhe a nota com uma fileira de 5 estrelas tocáveis
(`Pressable`), nunca um campo de texto — por isso `reviewFormSchema` usa
`z.number()` puro para `rating`, sem `z.coerce.number()` (diferente de
`bookingItemQuantitySchema`, módulo `scheduling`, onde o valor vem de um
`TextInput`).
