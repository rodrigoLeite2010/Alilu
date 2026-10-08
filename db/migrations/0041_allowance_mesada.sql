-- Módulo MESADA: crianças, mesada mensal, livro-razão de movimentações, categorias,
-- cofrinho/metas (derivados das movimentações), tarefas e recompensas.
-- Migração ADITIVA e idempotente. Dinheiro SEMPRE em centavos inteiros (nunca float).
-- O saldo NÃO é uma coluna: é calculado a partir de allowance_transactions (fonte de verdade).

-- ---------------------------------------------------------------------------
-- Crianças (pertencem ao usuário responsável)
-- ---------------------------------------------------------------------------
create table if not exists allowance_children (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  -- emoji (ex.: "🦄") ou URL de upload opcional; vazio = avatar padrão
  avatar text,
  birth_date date,
  allow_negative_balance boolean not null default false,
  weekly_limit_cents int check (weekly_limit_cents is null or weekly_limit_cents > 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists allowance_children_user_idx on allowance_children (user_id, active);

-- ---------------------------------------------------------------------------
-- Configuração da mesada mensal
-- ---------------------------------------------------------------------------
create table if not exists allowance_plans (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references allowance_children (id) on delete cascade,
  name text not null default 'Mesada mensal',
  monthly_amount_cents int not null check (monthly_amount_cents >= 0),
  -- 1..31; em meses mais curtos vale o último dia do mês
  payment_day int not null check (payment_day between 1 and 31),
  carry_over_balance boolean not null default true,
  active boolean not null default true,
  start_date date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists allowance_plans_child_idx on allowance_plans (child_id, active);

-- ---------------------------------------------------------------------------
-- Categorias (padrão do sistema: user_id nulo; personalizadas: por usuário)
-- ---------------------------------------------------------------------------
create table if not exists allowance_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 40),
  type text not null check (type in ('EXPENSE', 'INCOME')),
  icon text not null default '🏷️',
  color text,
  is_system boolean not null default false,
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists allowance_categories_user_idx on allowance_categories (user_id, type, active);
create unique index if not exists allowance_categories_system_uniq on allowance_categories (type, name) where user_id is null;

insert into allowance_categories (user_id, name, type, icon, is_system, sort_order)
select null, v.name, v.type, v.icon, true, v.sort_order
from (values
  ('Brinquedos', 'EXPENSE', '🧸', 1), ('Lanches', 'EXPENSE', '🍔', 2), ('Jogos', 'EXPENSE', '🎮', 3),
  ('Roupas', 'EXPENSE', '👕', 4), ('Passeios', 'EXPENSE', '🎡', 5), ('Presentes', 'EXPENSE', '🎁', 6),
  ('Escola', 'EXPENSE', '🎒', 7), ('Livros', 'EXPENSE', '📚', 8), ('Esportes', 'EXPENSE', '⚽', 9),
  ('Tecnologia', 'EXPENSE', '💻', 10), ('Doces', 'EXPENSE', '🍬', 11), ('Transporte', 'EXPENSE', '🚌', 12),
  ('Outros', 'EXPENSE', '🏷️', 99),
  ('Mesada', 'INCOME', '💰', 1), ('Recompensa', 'INCOME', '⭐', 2), ('Presente', 'INCOME', '🎁', 3),
  ('Bônus', 'INCOME', '✨', 4), ('Outros', 'INCOME', '🏷️', 99)
) as v(name, type, icon, sort_order)
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Metas de economia
-- ---------------------------------------------------------------------------
create table if not exists allowance_goals (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references allowance_children (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  target_cents int not null check (target_cents > 0),
  target_date date,
  icon text not null default '🎯',
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'ACHIEVED', 'CANCELED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists allowance_goals_child_idx on allowance_goals (child_id, status);

-- ---------------------------------------------------------------------------
-- Tarefas (com ou sem recompensa) e conclusões
-- ---------------------------------------------------------------------------
create table if not exists allowance_tasks (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references allowance_children (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  description text,
  has_reward boolean not null default false,
  reward_cents int not null default 0 check (reward_cents >= 0),
  repeatable boolean not null default true,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((has_reward and reward_cents > 0) or (not has_reward and reward_cents = 0))
);
create index if not exists allowance_tasks_child_idx on allowance_tasks (child_id, active);

create table if not exists allowance_task_completions (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references allowance_tasks (id) on delete cascade,
  child_id uuid not null references allowance_children (id) on delete cascade,
  status text not null default 'PENDING' check (status in ('PENDING', 'APPROVED', 'REJECTED')),
  completed_at timestamptz not null default now(),
  approved_at timestamptz,
  approved_by_user_id uuid references users (id) on delete set null,
  reward_amount_paid_cents int not null default 0 check (reward_amount_paid_cents >= 0)
);
create index if not exists allowance_completions_task_idx on allowance_task_completions (task_id, status);
create index if not exists allowance_completions_child_idx on allowance_task_completions (child_id, completed_at desc);

-- ---------------------------------------------------------------------------
-- Livro-razão (fonte de verdade do saldo e do cofrinho)
--   INCOME → soma no disponível · EXPENSE → subtrai do disponível
--   SAVINGS_TRANSFER → disponível → cofrinho · SAVINGS_WITHDRAWAL → cofrinho → disponível
-- ---------------------------------------------------------------------------
create table if not exists allowance_transactions (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references allowance_children (id) on delete cascade,
  type text not null check (type in ('INCOME', 'EXPENSE', 'SAVINGS_TRANSFER', 'SAVINGS_WITHDRAWAL')),
  category_id uuid references allowance_categories (id) on delete set null,
  goal_id uuid references allowance_goals (id) on delete set null,
  amount_cents int not null check (amount_cents > 0),
  description text not null default '',
  transaction_date date not null,
  source_type text not null default 'MANUAL' check (source_type in ('MANUAL', 'ALLOWANCE', 'REWARD', 'ADJUSTMENT', 'SAVINGS')),
  reference_id text,
  created_by_user_id uuid references users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists allowance_tx_child_date_idx on allowance_transactions (child_id, transaction_date desc, created_at desc);
create index if not exists allowance_tx_category_idx on allowance_transactions (category_id);
create index if not exists allowance_tx_goal_idx on allowance_transactions (goal_id);
-- Idempotência: a mesma mesada do mês / a mesma recompensa nunca entram duas vezes.
create unique index if not exists allowance_tx_reference_uniq
  on allowance_transactions (child_id, source_type, reference_id) where reference_id is not null;
