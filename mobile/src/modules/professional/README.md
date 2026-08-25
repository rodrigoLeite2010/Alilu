# Módulo: professional

> Implementado na **Etapa 06** (PROMPT 06) — perfil profissional,
> categorias de serviço e "solicitar atendimento em condomínios". Ver a
> seção "Etapa 06 — módulo Professional" em `backend/ARCHITECTURE.md`
> para o design completo (backend + mobile). Agenda/disponibilidade/
> atendimentos ainda **não** foram implementados ("Ainda NÃO criar agenda"
> — PROMPT 06).

## Responsabilidade

Quatro telas, divididas entre os dois papéis:

- **`ProfessionalEditScreen`** (profissional) — "editar perfil; selecionar
  serviços" + "solicitar atendimento em condomínios". É a própria tela
  inicial do profissional (`app/(professional)/index.tsx` é o gate: sem
  perfil ainda → formulário de criação; com perfil → o perfil completo,
  mesmo padrão do gate de `(resident)/index.tsx`).
- **`ServiceCategoryScreen`** / **`ProfessionalListScreen`** /
  **`ProfessionalProfileScreen`** (morador) — "listar profissionais;
  filtrar categoria; visualizar perfil". Ficam roteadas em
  `app/(resident)/` (não em `app/(professional)/`), porque quem as usa é
  o morador — ver `ResidentHomeScreen`, botão "Buscar profissional".

## Estrutura

```
professional/
├── types.ts       # espelha os DTOs do backend (Dtos.cs, enums)
├── api.ts         # chamadas HTTP cruas (sem React) — profileApi/directoryApi/condominiumDirectoryApi
├── hooks.ts        # TanStack Query sobre api.ts
├── schemas.ts      # validação de formulário (Zod) — perfil
├── screens/         # as quatro telas listadas acima
└── index.ts         # barrel export
```
