-- E-mail transacional central (Resend) + módulo Agenda com lembretes.
-- Migração ADITIVA: tabelas novas + 2 colunas em login_otp_codes.

-- ---------------------------------------------------------------------------
-- E-mail
-- ---------------------------------------------------------------------------

-- Um registro por e-mail enviado (nunca o conteúdo — só metadados).
create table if not exists email_delivery_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users (id) on delete set null,
  to_email text not null,
  email_type text not null check (email_type in (
    'LOGIN_CODE', 'AGENDA_REMINDER', 'AGENDA_CHANGED', 'AGENDA_CANCELLED', 'ADMIN_TEST'
  )),
  provider text not null,
  provider_message_id text,
  -- QUEUED (aceito pelo provedor) → SENT/DELIVERED/DELAYED/BOUNCED/COMPLAINED/FAILED/SUPPRESSED; ERROR = recusado na hora do envio.
  status text not null,
  last_provider_event text,
  reference_type text,
  reference_id text,
  error_message text,
  created_at timestamptz not null default now(),
  delivered_at timestamptz,
  failed_at timestamptz
);
create index if not exists email_delivery_logs_created_idx on email_delivery_logs (created_at desc);
create unique index if not exists email_delivery_logs_message_idx on email_delivery_logs (provider_message_id)
  where provider_message_id is not null;

-- Idempotência do webhook (svix-id).
create table if not exists email_webhook_events (
  event_id text primary key,
  event_type text not null,
  provider_message_id text,
  received_at timestamptz not null default now()
);

-- Endereços que deram bounce permanente / marcaram como spam: lembretes param.
create table if not exists email_suppressions (
  email text primary key,
  reason text not null,
  last_event_at timestamptz not null default now(),
  bounce_count int not null default 0
);

-- Login por código: IP (limite por IP) e invalidação explícita ao pedir um novo.
alter table login_otp_codes add column if not exists request_ip text;
alter table login_otp_codes add column if not exists invalidated_at timestamptz;
create index if not exists login_otp_codes_ip_idx on login_otp_codes (request_ip, created_at desc) where request_ip is not null;

-- ---------------------------------------------------------------------------
-- Agenda
-- ---------------------------------------------------------------------------

create table if not exists agenda_preferences (
  user_id uuid primary key references users (id) on delete cascade,
  timezone text not null default 'America/Sao_Paulo',
  default_reminder_minutes int default 60 check (default_reminder_minutes is null or default_reminder_minutes between 0 and 40320),
  email_reminders_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists agenda_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  description text,
  -- Instante de início em UTC. Dia inteiro: meia-noite LOCAL do dia (convertida para UTC) + is_all_day.
  start_at timestamptz not null,
  end_at timestamptz,
  is_all_day boolean not null default false,
  -- Fuso em que o compromisso foi criado (recorrência e "dia inteiro" respeitam o relógio local).
  timezone text not null,
  category text not null default 'PESSOAL' check (category in (
    'PESSOAL', 'TRABALHO', 'MEDICO', 'FAMILIA', 'FESTA', 'FINANCEIRO', 'SERVICO', 'ESCOLA', 'VIAGEM', 'OUTRO'
  )),
  location text,
  status text not null default 'SCHEDULED' check (status in ('SCHEDULED', 'COMPLETED', 'CANCELLED')),
  recurrence text not null default 'NONE' check (recurrence in ('NONE', 'DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY')),
  -- Minutos antes do início de cada lembrete (ex.: {60, 1440}).
  reminder_offsets int[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  cancelled_at timestamptz,
  deleted_at timestamptz
);
create index if not exists agenda_events_user_idx on agenda_events (user_id, start_at) where deleted_at is null;

create table if not exists agenda_reminders (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references agenda_events (id) on delete cascade,
  user_id uuid not null references users (id) on delete cascade,
  -- Ocorrência a que o lembrete se refere (recorrentes: uma por vez).
  occurrence_start_at timestamptz not null,
  offset_minutes int not null,
  remind_at timestamptz not null,
  channel text not null default 'EMAIL' check (channel in ('EMAIL', 'SMS', 'WHATSAPP', 'PUSH')),
  status text not null default 'PENDING' check (status in ('PENDING', 'SENDING', 'SENT', 'FAILED', 'CANCELLED', 'SKIPPED')),
  attempt_count int not null default 0,
  next_attempt_at timestamptz,
  lock_token text,
  lock_expires_at timestamptz,
  sent_at timestamptz,
  provider_message_id text,
  last_error text,
  created_at timestamptz not null default now(),
  -- Nunca dois lembretes iguais para a mesma ocorrência.
  constraint agenda_reminders_unique unique (event_id, occurrence_start_at, offset_minutes, channel)
);
create index if not exists agenda_reminders_due_idx on agenda_reminders (status, next_attempt_at) where status in ('PENDING', 'SENDING');
