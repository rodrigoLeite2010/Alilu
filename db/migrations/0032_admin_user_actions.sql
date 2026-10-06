-- Administração manual de clientes (admin): desativar conta, plano de cortesia
-- e histórico de auditoria das ações. Tudo aditivo e com default — rodar antes
-- do deploy do código que usa estas colunas.

-- Conta desativada: não consegue entrar nem usar a sessão já aberta; as
-- automações dela são pausadas (ver lib/admin/user-admin-service.ts).
alter table users add column if not exists disabled_at timestamptz;
alter table users add column if not exists disabled_reason text;

-- Plano de cortesia: concedido pelo admin sem cobrança (sem Asaas, preço 0),
-- válido até current_period_ends_at — depois disso o acesso termina sozinho.
alter table automation_subscriptions add column if not exists complimentary boolean not null default false;
alter table automation_subscriptions add column if not exists admin_note text;

-- Quem fez o quê, em quem, quando (créditos, planos, cancelamentos, desativação).
create table if not exists admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid references users (id) on delete set null,
  admin_email text not null,
  target_user_id uuid references users (id) on delete set null,
  target_email text not null,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists admin_audit_log_target_idx on admin_audit_log (target_user_id, created_at desc);
create index if not exists admin_audit_log_created_idx on admin_audit_log (created_at desc);
