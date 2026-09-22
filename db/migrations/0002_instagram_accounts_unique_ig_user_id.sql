-- Garante que uma mesma conta profissional do Instagram (ig_user_id) só
-- possa estar conectada a UM usuário do ALILU por vez. Sem isso, dois
-- usuários diferentes poderiam "possuir" a mesma conta do Instagram no
-- nosso banco, o que geraria conflito na hora de publicar (qual token
-- usar?) e não faz sentido no mundo real: uma conta profissional do
-- Instagram pertence a uma pessoa/negócio só.
--
-- A constraint UNIQUE também é o que permite o upsert em
-- instagram-account-repository.ts (`on conflict (ig_user_id) do update`):
-- reconectar a mesma conta (ex.: para renovar o token) atualiza a linha
-- existente em vez de criar uma duplicata.
alter table instagram_accounts
  add constraint instagram_accounts_ig_user_id_key unique (ig_user_id);
