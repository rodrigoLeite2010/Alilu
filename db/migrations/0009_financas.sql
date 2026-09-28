-- Educação Financeira (área privada /financeiro/*).
--
-- Tudo é informado manualmente pelo usuário: nenhuma integração bancária,
-- nenhum dado de cartão/senha. Valores em centavos (bigint) para evitar
-- erro de ponto flutuante. Cada linha pertence a um usuário (user_id) e
-- toda consulta da aplicação filtra por ele.

create table if not exists fin_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  kind text not null check (kind in ('income', 'expense')),
  description text not null,
  amount_cents bigint not null check (amount_cents > 0),
  category text not null,
  -- Só despesas usam: fixa (aluguel) ou variável (mercado).
  nature text check (nature in ('fixed', 'variable')),
  -- Data de recebimento (receita) ou de vencimento (despesa). Para
  -- lançamentos recorrentes, é a primeira ocorrência.
  entry_date date not null,
  recurrence text not null default 'none'
    check (recurrence in ('none', 'weekly', 'biweekly', 'monthly', 'yearly')),
  recurrence_end date,
  payment_method text,
  note text,
  -- Lançamentos NÃO recorrentes: quando foi pago/recebido. Recorrentes usam
  -- fin_occurrence_payments (uma linha por ocorrência paga).
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists fin_entries_user_date_idx
  on fin_entries (user_id, entry_date);

create table if not exists fin_occurrence_payments (
  entry_id uuid not null references fin_entries(id) on delete cascade,
  occurrence_date date not null,
  paid_at timestamptz not null default now(),
  primary key (entry_id, occurrence_date)
);

create table if not exists fin_settings (
  user_id uuid primary key references users(id) on delete cascade,
  monthly_savings_goal_cents bigint not null default 0 check (monthly_savings_goal_cents >= 0),
  updated_at timestamptz not null default now()
);

-- Saldo com que o usuário começa cada mês (opcional; padrão 0).
create table if not exists fin_month_balances (
  user_id uuid not null references users(id) on delete cascade,
  month text not null check (month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  opening_balance_cents bigint not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, month)
);
