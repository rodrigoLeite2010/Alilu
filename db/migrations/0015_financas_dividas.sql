-- Controle de dívidas: saldo devedor e valor da parcela mensal. A
-- previsão de término (quantos meses faltam, mês de quitação) é sempre
-- calculada na hora a partir desses dois valores (ver
-- lib/financas/debts.ts) — nunca persistida, para nunca ficar
-- desatualizada. "Registrar pagamento" reduz balance_cents diretamente
-- (mesmo princípio de fin_goals: current_cents lá é o valor guardado,
-- aqui é o valor que ainda falta pagar, andando na direção oposta).

create table if not exists fin_debts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  name text not null,
  balance_cents bigint not null check (balance_cents >= 0),
  installment_cents bigint not null check (installment_cents > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists fin_debts_user_idx on fin_debts (user_id, created_at);
