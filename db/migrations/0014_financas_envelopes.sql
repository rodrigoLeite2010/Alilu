-- Método dos envelopes: limite de gasto mensal por categoria de despesa,
-- para comparar com o gasto real do mês (via expensesByCategory, que já
-- existe em lib/financas/summary.ts) e mostrar barra de progresso.
--
-- Um limite por categoria por usuário (não por mês): o usuário ajusta o
-- teto quando quiser, não é um "envelope" que reseta automaticamente a
-- cada mês — é uma referência fixa, comparada contra o gasto real do mês
-- corrente sempre que a tela é aberta.

create table if not exists fin_category_limits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  category text not null,
  limit_cents bigint not null check (limit_cents > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, category)
);

create index if not exists fin_category_limits_user_idx on fin_category_limits (user_id);
