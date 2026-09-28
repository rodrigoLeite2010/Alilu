-- Metas financeiras (inclui reserva de emergência, que é uma meta criada
-- automaticamente pela calculadora). "Valor atual" é informado pelo
-- usuário (não calculado a partir dos lançamentos) — o usuário decide o
-- que já guardou, em qualquer conta que seja.

create table if not exists fin_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  name text not null,
  target_cents bigint not null check (target_cents > 0),
  current_cents bigint not null default 0 check (current_cents >= 0),
  target_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists fin_goals_user_idx on fin_goals (user_id, created_at);
