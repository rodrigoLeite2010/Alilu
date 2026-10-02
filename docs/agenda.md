# Agenda

Página `/agenda`, para usuários logados. Cada pessoa vê **só a própria agenda**: todas as consultas filtram pelo `userId` da sessão, e nunca por um id enviado pelo navegador.

## O que tem

- **Visões**:
  - **Mês**: grade com os compromissos do dia; clique num dia para ver a lista e dê dois cliques para criar.
  - **Semana**.
  - **Lista**: abas Hoje / Amanhã / 7 dias / Todos (próximos 12 meses).
- **Busca** por título, descrição ou local, e **filtro por categoria**.
- **Cadastro rápido**: só **título** e **data** são obrigatórios.
  - Sem hora, o compromisso vale o **dia inteiro**.
  - Em "Mais opções" ficam término, local, descrição, categoria, repetição e lembretes.
- **Categorias**: Pessoal, Trabalho, Médico, Família, Festa, Financeiro, Serviço, Escola, Viagem, Outro.
- **Repetição simples**: não repete, todo dia, toda semana, todo mês ou todo ano.
  - Em "todo mês" no dia 31, os meses mais curtos usam o último dia.
  - As ações valem para a série inteira.
- **Ações**: editar, concluir, cancelar, reabrir e excluir. Excluir é um *soft delete* (`deleted_at`) e cancela os lembretes pendentes.
- **Preferências**:
  - fuso horário (na primeira visita é preenchido com o do navegador);
  - lembrete padrão (1 hora antes, de início);
  - liga/desliga de lembretes por e-mail.
- **Home**: card "Seu próximo compromisso", só para quem está logado. Também há o item **Agenda** no menu.
- **Links diretos**: `/agenda?novo=1` abre o cadastro, e `/agenda?evento=<id>` abre o compromisso (é o link usado no e-mail de lembrete).

## Lembretes por e-mail

- Cada compromisso pode ter de 0 a 5 lembretes: 10 min, 30 min, 1 h, 2 h, 1 dia ou 1 semana antes.
- Num compromisso de dia inteiro, o lembrete conta a partir das **9h** do dia, no fuso do compromisso.
- As datas ficam em UTC no banco, e o fuso (IANA, ex.: `America/Sao_Paulo`) fica no compromisso. A repetição é calculada no relógio local, então o horário de verão não desloca o compromisso.
- A tabela `agenda_reminders` guarda uma linha por **ocorrência × lembrete × canal**.
  - A chave única é (`event_id`, `occurrence_start_at`, `offset_minutes`, `channel`).
  - Compromissos que se repetem têm sempre a **próxima** ocorrência agendada. O cron completa as seguintes.
- **Editar** apaga os lembretes pendentes e recalcula. Lembretes já enviados não são reenviados.
- **Cancelar**, **concluir** ou **excluir** cancela os pendentes.
- Os canais ficam atrás de `ReminderChannelSender` (`lib/agenda/backend/reminder-channels.ts`). Hoje só existe `EMAIL`; o banco já aceita `SMS`, `WHATSAPP` e `PUSH` para o futuro.
- Não é ferramenta de marketing: só lembretes que o próprio usuário criou, para o e-mail da conta dele.

### Cron (a cada 1 minuto)

Endpoint `GET` ou `POST` `/api/cron/agenda-reminders`, com o cabeçalho `Authorization: Bearer <segredo>`.

O segredo é `AGENDA_CRON_SECRET`, se existir. Senão, vale `CRON_SECRET` ou `INSTAGRAM_SCHEDULER_SECRET`. Mínimo de 16 caracteres.

Em cada execução, o cron:

1. **Reserva** lembretes vencidos de forma atômica (`for update skip locked`, com `lock_token` e trava de 2 min). Duas execuções simultâneas nunca pegam o mesmo lembrete.
2. Para cada lembrete:
   - se o compromisso foi excluído, cancelado ou concluído → `CANCELLED`;
   - se passou da hora (com horário: o compromisso já começou; dia inteiro: o dia acabou), se a pessoa desligou os e-mails ou se o endereço está suprimido → `SKIPPED`;
   - se o envio deu certo → `SENT`;
   - se a falha é temporária → tenta de novo em **1, 5 e 15 minutos**, e depois disso marca `FAILED`.
3. Usa a Idempotency-Key `agenda-reminder/<id>` no Resend, como garantia final contra duplicidade.
4. Completa a próxima ocorrência dos compromissos que se repetem.

O cron processa até 50 lembretes por execução, com orçamento de cerca de 45 s.

**Configuração (cron-job.org)**:

1. Crie um job com a URL `https://alilu.com.br/api/cron/agenda-reminders`, rodando *Every minute*.
2. Em Advanced → Headers, adicione `Authorization: Bearer <AGENDA_CRON_SECRET>`.
3. Teste manualmente:

   ```bash
   curl -H "Authorization: Bearer $AGENDA_CRON_SECRET" https://alilu.com.br/api/cron/agenda-reminders
   ```

   O resultado deve ser `{"claimed":0,…}`.

## Privacidade e admin

- O admin (`/admin/emails`) vê **só números agregados**: compromissos ativos, usuários com agenda e lembretes enviados, com falha ou pulados. Títulos e descrições nunca aparecem.
- Os logs não trazem título nem descrição dos compromissos. Os e-mails dos destinatários aparecem mascarados no admin.

## API (todas exigem sessão)

| Método | Rota | Uso |
|---|---|---|
| GET | `/api/agenda/events?from=ISO&to=ISO&q=&category=` | Compromissos e ocorrências do período (máx. 400 dias) |
| POST | `/api/agenda/events` | `{ title, date: "AAAA-MM-DD", time?: "HH:MM", endTime?, description?, location?, category?, recurrence?, reminders?: number[], timezone? }` |
| GET / PUT / DELETE | `/api/agenda/events/{id}` | Ver, editar ou excluir (soft delete) |
| POST | `/api/agenda/events/{id}/complete` · `/cancel` · `/reopen` | Mudar o status |
| GET / PUT | `/api/agenda/preferences` | `{ timezone, defaultReminderMinutes, emailRemindersEnabled }` |
| GET | `/api/agenda/next` | Próximo compromisso (card da home) |

Um compromisso de outro usuário responde **404**, como se não existisse.

## Arquivos

- `db/migrations/0024_email_and_agenda.sql`
- `lib/agenda/time.ts`: fuso e repetição, funções puras
- `lib/agenda/types.ts`
- `lib/agenda/backend/agenda-repository.ts`, `agenda-service.ts`, `reminder-service.ts`, `reminder-channels.ts`, `route-helpers.ts`
- `app/agenda/page.tsx`, `components/agenda/AgendaApp.tsx`, `components/agenda/AgendaHomeCard.tsx`
- `app/api/agenda/**`, `app/api/cron/agenda-reminders/route.ts`
