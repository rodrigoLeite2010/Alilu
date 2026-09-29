-- Loterias — "Meus Jogos" (histórico privado de jogos salvos da Lotofácil,
-- Fase 2 do pedido). Só disponível para quem está logado, reaproveitando a
-- mesma autenticação do resto do site (ver lib/auth/session.ts) — nenhuma
-- conta ou sessão nova é criada aqui.
--
-- lottery_bets agrupa um "salvamento" (um ou mais jogos gerados juntos de
-- uma vez, opcionalmente ligados a um concurso/data de sorteio real).
-- lottery_games é cada jogo individual (um conjunto de números) dentro de
-- uma aposta. Toda consulta da aplicação filtra por user_id — mesmo padrão
-- de fin_entries/fin_goals (0009_financas.sql).
--
-- `drawn_numbers` (os números realmente sorteados) só é preenchido quando
-- o próprio usuário informa manualmente na conferência — nunca é buscado
-- de nenhuma fonte automática (não existe integração com resultado oficial
-- neste projeto).

create table if not exists lottery_bets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  -- Preparado para outras modalidades futuras (Mega-Sena etc.); só
  -- "lotofacil" existe por enquanto.
  modality text not null default 'lotofacil',
  contest_number integer check (contest_number > 0),
  draw_date date,
  amount_cents bigint not null default 0 check (amount_cents >= 0),
  note text,
  drawn_numbers integer[],
  checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists lottery_bets_user_idx on lottery_bets (user_id, created_at desc);

create table if not exists lottery_games (
  id uuid primary key default gen_random_uuid(),
  bet_id uuid not null references lottery_bets(id) on delete cascade,
  -- Denormalizado de propósito: permite filtrar/consultar jogos de um
  -- usuário (duplicidade, estatística pessoal, exportação) sem precisar de
  -- join com lottery_bets em toda consulta.
  user_id uuid not null references users(id) on delete cascade,
  modality text not null default 'lotofacil',
  numbers integer[] not null,
  bet_size integer not null check (bet_size > 0),
  mode text not null default 'aleatorio'
    check (mode in ('aleatorio', 'equilibrado', 'personalizado', 'diversificado')),
  is_favorite boolean not null default false,
  hits integer,
  created_at timestamptz not null default now()
);

create index if not exists lottery_games_user_idx on lottery_games (user_id, created_at desc);
create index if not exists lottery_games_bet_idx on lottery_games (bet_id);
-- Acelera a checagem de duplicidade (mesmo conjunto de números já salvo
-- pelo usuário nesta modalidade). Arrays comparam lexicograficamente, então
-- a aplicação sempre grava `numbers` já ordenado, para a igualdade de
-- conjuntos funcionar como igualdade de array.
create index if not exists lottery_games_user_numbers_idx on lottery_games (user_id, modality, numbers);

-- Limite mensal de investimento (opcional, só para acompanhamento — nunca
-- um bloqueio ou alerta agressivo; ver lib/lotteries/backend/repository.ts
-- e components/lotteries/MeusJogos.tsx).
create table if not exists lottery_settings (
  user_id uuid primary key references users(id) on delete cascade,
  monthly_budget_cents bigint check (monthly_budget_cents >= 0),
  updated_at timestamptz not null default now()
);
