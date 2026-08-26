# Módulo: notifications

> Implementado na **Etapa 11** (PROMPT 11) — notificações internas e Push
> Notifications (Expo). Ver a seção "Etapa 11 — notificações
> (Notifications)" em `backend/ARCHITECTURE.md` para o design completo
> (backend + mobile).

## Responsabilidade

Três peças de UI:

- **`NotificationCenterScreen`** — "minhas notificações": lista completa
  + "marcar todas como lidas". Roteada em `app/notifications/index.tsx`,
  **fora** de `(resident)`/`(professional)` porque o mesmo destino serve
  qualquer papel autenticado.
- **`NotificationItem`** — uma linha da lista (indicador de não lida,
  rótulo do tipo, título, mensagem, data).
- **`NotificationBadge`** — o sino com a contagem não lida, usado em
  `ResidentHomeScreen`/`ProfessionalEditScreen` (ver "Composição no app"
  abaixo).

Mais a lógica de push em si (`useNotificationsBootstrap`, chamado uma
única vez em `app/_layout.tsx`): obter/registrar o Expo push token
("Configurar device token") e resolver a tela ao tocar numa notificação
("ao clicar na notificação, abrir a tela correspondente"), tanto no
NotificationCenter quanto num toque em notificação do sistema.

## Composição no app, espelhando a Api

Este módulo não importa nenhum módulo de negócio (Scheduling/Reviews/
Recommendations/Resident/Professional) — só `modules/auth` (`useAuth`/
`UserRole`), tratado como fundação compartilhada, mesma convenção já
usada em `ResidentHomeScreen` importando `useAuth`.

`resolveNotificationRoute` (`notificationRouting.ts`) resolve a REGRA "ao
clicar na notificação, abrir a tela correspondente" só a partir de
`NotificationType` + `UserRole` — os literais de rota de outros módulos
(`/(professional)/requests/[id]`, `/(resident)/bookings/[id]`, etc.) são
strings copiadas dos pontos de navegação já existentes naqueles módulos,
sem importar nada de lá (mesmo espírito de "duplicar um DTO enxuto" já
usado entre módulos, aqui ainda mais leve — só literais, sem nenhum dado).

`NotificationBadge`, por sua vez, é composto na camada de rotas — nunca
importado direto de dentro de `modules/resident`/`modules/professional`,
que não podem importar este módulo (independência de módulos vale para o
mobile também). `ResidentHomeScreen`/`ProfessionalEditScreen` ganharam um
prop `headerSlot` (função que devolve um `ReactNode`), preenchido com
`<NotificationBadge />` em `app/(resident)/index.tsx`/
`app/(professional)/index.tsx` — mesmo padrão de composição já usado em
`app/(resident)/bookings/[id]/index.tsx` (Etapa 09, slot `reviewSlot`
para o módulo Reviews).

## Configurar device token e tratar toque em push

`services/notifications.ts` (fora deste módulo — é o ponto único de
integração com `expo-notifications` desde a Etapa 02) ganhou nesta etapa:

- **`getExpoPushToken()`** — obtém o Expo push token via
  `Notifications.getExpoPushTokenAsync({ projectId })`. Este repositório
  ainda não tem um projeto EAS configurado (`app.json` sem
  `extra.eas.projectId`, sem `eas.json`) — a função devolve `null` sem
  lançar quando o `projectId` não está disponível. **Pendência de
  configuração do usuário** (rodar `eas init`/`eas build:configure`), não
  um defeito de código — o app continua funcionando normalmente sem isso
  (só sem push remoto real até a configuração ser feita).
- **`addNotificationResponseListener(onResponse)`** — o listener de toque
  em notificação, cobrindo o caso de um toque numa notificação do
  **sistema** (app em segundo plano/fechado): só tem o payload `data` do
  push (`type`/`referenceId`, embutido pela Api — ver `ExpoPushNotificationSender`
  no backend), não a lista de notificações.

`useNotificationsBootstrap` (este módulo) orquestra os dois: registra o
token ao autenticar (`useRegisterDeviceToken`), remove ao deslogar
(`useRemoveDeviceToken`), e liga `addNotificationResponseListener`
enquanto há um usuário autenticado, resolvendo a rota com
`resolveNotificationRoute` + o papel do usuário atual. Chamado uma única
vez em `app/_layout.tsx` (`RootNavigator`) — nunca dentro de uma tela
específica, porque cobre o app inteiro.

## Estrutura

```
notifications/
├── types.ts                     # espelha os DTOs do backend (Dtos.cs, NotificationType)
├── notificationsFormat.ts       # rótulos PT-BR do tipo, formatação de data
├── notificationRouting.ts       # resolveNotificationRoute — REGRA "abrir a tela correspondente"
├── api.ts                       # chamadas HTTP cruas (sem React) — notificationApi
├── hooks.ts                     # TanStack Query sobre api.ts
├── useNotificationsBootstrap.ts # bootstrap global (device token + listener de toque)
├── components/
│   ├── NotificationBadge.tsx    # sino com contagem não lida
│   └── NotificationItem.tsx     # uma linha da lista
├── screens/
│   └── NotificationCenterScreen.tsx
└── index.ts                     # barrel
```

## Regras de dependência

Módulos não se importam entre si (mesma convenção de sempre) — só
`modules/auth`, tratado como fundação compartilhada. A rota
`app/notifications/index.tsx` só reexporta `NotificationCenterScreen`
deste módulo (mesmo padrão de todas as outras rotas do app).
