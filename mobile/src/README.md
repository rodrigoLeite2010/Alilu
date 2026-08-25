# Estrutura do app mobile ALILU (Etapa 02)

> Nenhuma funcionalidade de negócio foi implementada nesta etapa — nem
> login, nem chamadas reais à API. Este documento descreve a fundação de
> navegação, arquitetura e tema criada.

## Pastas

```
src/
├── app/                    # rotas (Expo Router) — arquivo = rota
│   ├── _layout.tsx         # layout raiz: providers (tema, TanStack Query, safe area) + Stack
│   ├── index.tsx           # tela inicial placeholder
│   ├── (auth)/              # AuthStack
│   │   ├── _layout.tsx
│   │   └── login.tsx       # placeholder — login NÃO implementado
│   ├── (resident)/          # ResidentStack
│   ├── (professional)/      # ProfessionalStack
│   └── (administration)/    # AdministrationStack
├── modules/                # um README por módulo de negócio (auth, condominium, resident,
│                            # professional, scheduling, reviews, recommendations,
│                            # notifications, administration) — vazios, aguardando implementação
├── components/              # componentes de UI reutilizáveis (AppText, AppButton, Screen, PlaceholderScreen)
├── services/                 # api.ts (Axios), queryClient.ts (TanStack Query), notifications.ts (Expo Notifications)
├── hooks/                    # hooks compartilhados entre módulos (vazio nesta etapa)
├── store/                    # estado global (Zustand) — useUiStore.ts é só um exemplo de padrão
├── utils/                    # secureStorage.ts (wrapper do Expo Secure Store)
├── types/                    # tipos genéricos de API (ApiError, Paginated<T>)
└── theme/                    # colors, spacing, typography, ThemeProvider/useTheme
```

## Navegação (Expo Router)

O diretório de rotas é `src/app` (configurado via `app.json` →
`plugins: [["expo-router", { "root": "./src/app" }]]`, já que o padrão do
Expo Router é usar `app/` na raiz do projeto, e o PROMPT 02 pede tudo
dentro de `src/`).

4 stacks preparados, cada um como um *route group* com seu próprio
`_layout.tsx` (`<Stack>` do expo-router) e uma tela placeholder:

| Stack | Grupo de rota | Tela placeholder |
|---|---|---|
| AuthStack | `(auth)` | `login.tsx` |
| ResidentStack | `(resident)` | `index.tsx` |
| ProfessionalStack | `(professional)` | `index.tsx` |
| AdministrationStack | `(administration)` | `index.tsx` |

Nenhum redirecionamento automático entre stacks existe ainda (isso
depende do módulo Identity/auth, que não foi implementado). A tela
inicial (`src/app/index.tsx`) tem links manuais para os 4 stacks, apenas
para navegar durante o desenvolvimento desta fundação.

## Arquitetura preparada (instalada, sem uso de negócio ainda)

| Dependência | Onde está preparada | Uso nesta etapa |
|---|---|---|
| **Expo Router** | `src/app/*` | Navegação real (única coisa "funcionando" de fato) |
| **TanStack Query** | `services/queryClient.ts` + `<QueryClientProvider>` no layout raiz | Cliente criado, nenhuma query real |
| **Axios** | `services/api.ts` | Instância criada (`baseURL` de `EXPO_PUBLIC_API_URL`), nenhuma chamada real |
| **Zustand** | `store/useUiStore.ts` | Store de exemplo (loading global), sem estado de negócio |
| **React Hook Form + Zod + @hookform/resolvers** | instalados (`package.json`) | Nenhum formulário criado ainda — serão usados no login/cadastro (módulo auth) |
| **Expo Secure Store** | `utils/secureStorage.ts` | Wrapper genérico (get/set/delete), nenhuma chave de negócio definida |
| **Expo Notifications** | `services/notifications.ts` | Handler + função de permissão preparados, nenhum registro de push token disparado |

## Tema

`theme/colors.ts`, `theme/spacing.ts`, `theme/typography.ts` — paleta
neutra e sóbria (grafite azulado + um único acento dourado acinzentado),
grid de espaçamento 4pt, tipografia com a fonte padrão de cada plataforma
(sem fontes customizadas). Acessado via `useTheme()` (`theme/ThemeProvider.tsx`).

## Verificação desta etapa

```bash
npm install       # ok (com .npmrc legacy-peer-deps=true)
npm run typecheck # tsc --noEmit — 0 erros
npm run lint      # eslint . — 0 erros, 0 avisos
npx expo export --platform ios     # bundling ok (1171 módulos)
npx expo export --platform android # bundling ok (1257 módulos)
```

`npx expo-doctor` reporta 19/21 checks ok; os 2 que falham (schema do
Expo config e React Native Directory) são checagens que dependem de rede
externa bloqueada no ambiente de build do Claude — não são erros do
projeto.
