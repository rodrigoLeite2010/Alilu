# Módulo: Notifications

> Implementado na **Etapa 11** (PROMPT 11): notificações internas e Push
> Notifications (Expo). Diferente de todos os módulos anteriores, este não
> tem um fluxo de negócio próprio — é o **ponto de extensão** que os
> outros módulos chamam depois de completar a própria ação, mais um
> processo em segundo plano para o único evento sem ação de usuário
> (lembrete de serviço). Ver a seção "Etapa 11 — notificações
> (Notifications)" em `backend/ARCHITECTURE.md` para o design completo
> (entidades, dez EVENTOS → quem dispara, dedup, push, React Native,
> testes).

## Responsabilidade

`Notification` (a notificação interna — usuário, título, mensagem, tipo,
referência à entidade de origem, lida/não lida) e `DeviceToken` (o Expo
push token atual de um usuário, um por usuário). Três papéis distintos,
cada um sua própria interface: `INotificationService` (self-service:
listar minhas, contar não lidas, marcar como lida/todas),
`INotificationDispatcher` (o único ponto que TODOS os outros módulos
chamam para criar+dedupe+enviar push de uma notificação) e
`IDeviceTokenService` (self-service: registrar/remover meu token).

## O que NÃO está aqui (de propósito)

- **Nenhuma regra de negócio dos outros módulos** — este módulo nunca
  decide *quando* notificar (isso é decisão de cada controller, depois de
  completar sua própria ação principal); só decide *como* (dedup, criar,
  enviar push).
- **Resolução de `UserId` a partir de um `ProfessionalId`** — depende do
  módulo Professional; resolvida por
  `IProfessionalDirectoryService.GetProfessionalUserIdAsync` (método novo
  desta etapa, do lado de quem é consultado — ver README do módulo
  Professional).
- **A lista de agendamentos candidatos a lembrete** — depende do módulo
  Scheduling; resolvida por `IBookingService.ListConfirmedBookingsByDateRangeAsync`
  (método novo desta etapa — ver README do módulo Scheduling).
- **Suporte a múltiplos dispositivos por usuário** — `DeviceToken` modela
  um token por usuário (upsert sempre sobrescreve); decisão de escopo de
  MVP, documentada em ARCHITECTURE.md.
- **Qualquer tela de administração/moderação** — este módulo não tem lado
  "administrador"; não se aplica.

## Estrutura

```
Notifications/
├── Domain/Alilu.Modules.Notifications.Domain.csproj                  # Notification, DeviceToken, NotificationType
├── Application/Alilu.Modules.Notifications.Application.csproj        # INotificationService / INotificationDispatcher / IDeviceTokenService / IPushNotificationSender, IUnitOfWork
├── Infrastructure/Alilu.Modules.Notifications.Infrastructure.csproj  # EF Core, repositórios, ExpoPushNotificationSender (HttpClient tipado)
└── Application.Tests/Alilu.Modules.Notifications.Application.Tests.csproj  # Testes xUnit dos casos de uso
```

## Regras de dependência (já aplicadas nos .csproj, verificadas por `scripts/check-references.py`)

- **Domain** referencia apenas `Alilu.Shared` — não depende de Application, Infrastructure ou de nenhum outro módulo.
- **Application** referencia apenas o **Domain deste mesmo módulo**.
- **Infrastructure** referencia o Domain e a Application **deste mesmo módulo**, além do `Alilu.Infrastructure` da raiz (para o `AliluDbContext` compartilhado) e `Microsoft.Extensions.Http` (para o `HttpClient` tipado do Expo — primeira integração HTTP externa deste backend).
- Nenhum projeto deste módulo referencia outro módulo, nem o `Alilu.Api`.

Regras de negócio ficam no Domain/Application. Controllers finos apenas
traduzem requisições HTTP em chamadas para a Application. Entidades nunca
são expostas diretamente pela API — sempre via DTOs.

## Endpoints

Self-service (`NotificationsController`, `api/notifications`,
`[Authorize]`, sempre restrito ao próprio usuário):

- `GET /api/notifications` — minhas notificações
- `GET /api/notifications/unread-count` — contagem não lida
- `POST /api/notifications/{id}/read` — marcar uma como lida
- `POST /api/notifications/read-all` — marcar todas como lidas
- `POST /api/notifications/device-token` — registrar/renovar o Expo push token deste dispositivo (upsert)
- `DELETE /api/notifications/device-token` — remover o token (logout)

Nenhum endpoint cria uma notificação diretamente — isso só acontece via
`INotificationDispatcher`, chamado pelos outros módulos (ver
ARCHITECTURE.md, tabela "Eventos → quem dispara") e por
`BookingReminderBackgroundService` (`Alilu.Api/BackgroundServices`, não é
um endpoint — um processo em segundo plano).
