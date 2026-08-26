# Módulo: recommendations

> Implementado na **Etapa 10** (PROMPT 10) — moradores recomendam
> profissionais que consideram confiáveis, vinculados ao ALILU ou
> indicações externas. Ver a seção "Etapa 10 — recomendações
> (Recommendations)" em `backend/ARCHITECTURE.md` para o design completo
> (backend + mobile).

## Responsabilidade

Quatro telas:

- **`RecommendationsScreen`** (morador) — "minhas recomendações". Roteada
  em `app/(resident)/recommendations/index.tsx`, acessível a partir de
  "Minhas recomendações" em `ResidentHomeScreen` (módulo Resident).
- **`RecommendProfessionalScreen`** (morador) — "recomendar profissional",
  em dois modos decididos pela presença de `professionalId` (prop, nunca
  estado interno): **vinculado** (a partir de "Recomendar" em
  `ProfessionalProfileScreen`, roteada em
  `app/(resident)/professionals/[id]/recommend.tsx`) e **externo** (a
  partir de "Nova recomendação" em `RecommendationsScreen`, roteada em
  `app/(resident)/recommendations/new.tsx`).
- **`RecommendationDetailsScreen`** (morador) — detalhe de uma
  recomendação própria. Roteada em `app/(resident)/recommendations/[id].tsx`.
- **`ProfessionalRecommendationsScreen`** (qualquer papel) — o "perfil de
  recomendações" público de um profissional do ALILU ("Carlos Elétrica
  ⭐ 4.9 Recomendado por 7 moradores"). Usada duas vezes: pelo morador, a
  partir de "Ver recomendações" em `ProfessionalProfileScreen`
  (`app/(resident)/professionals/[id]/recommendations.tsx`), e pelo
  próprio profissional, a partir de "Recomendações" em
  `ProfessionalEditScreen` (`app/(professional)/recommendations/index.tsx`,
  resolvendo o próprio `professionalId` antes de renderizar).

## Composição no app, espelhando a Api

Assim como o módulo Scheduling não referencia os módulos Resident/
Professional (Etapa 08), este módulo não importa `modules/professional`
nem `modules/reviews`. Toda resolução de nome de profissional/categoria
(para `RecommendProfessionalScreen` e `RecommendationDetailsScreen`)
acontece na camada de rotas — mesmo papel dos controllers da Api. O
diretório público de categorias é duplicado em `api.ts`
(`recommendationDirectoryApi.listCategories`), mesma convenção de módulos
não se importarem entre si já usada em
`modules/scheduling/api.ts#schedulingDirectoryApi`.

A consulta pública de `ProfessionalRecommendationsScreen`
(`GET /api/directory/professionals/{id}/recommendations`) já vem composta
pela Api (nome do módulo Professional, nota do módulo Reviews, contagem/
lista do módulo Recommendations) — o mobile só exibe a resposta pronta,
sem nenhuma composição adicional aqui.

## Estrutura

```
recommendations/
├── types.ts                  # espelha os DTOs do backend (Dtos.cs, RecommendationStatus)
├── recommendationsFormat.ts   # rótulos PT-BR do status, formatação de data
├── api.ts                     # chamadas HTTP cruas (sem React) — recommendationApi/recommendationDirectoryApi
├── hooks.ts                    # TanStack Query sobre api.ts
├── schemas.ts                   # validação de formulário (Zod) — modo vinculado/externo
├── screens/                      # as quatro telas listadas acima
└── index.ts                       # barrel export
```

## Nota sobre a criação de uma indicação vinculada

O prompt não pediu uma tela de busca/seleção de profissional dedicada —
por isso uma recomendação vinculada a um profissional do ALILU só pode
ser criada a partir do próprio perfil dele (`ProfessionalProfileScreen`,
botão "Recomendar", mesmo padrão de "Agendar" desde a Etapa 08). Chegando
em `RecommendProfessionalScreen` sem esse contexto, a tela assume
indicação externa — ver o componente `CategoryPicker` (compartilhado
pelos dois modos) e os dois schemas Zod (`internalRecommendationFormSchema`/
`externalRecommendationFormSchema`) em `schemas.ts`.
