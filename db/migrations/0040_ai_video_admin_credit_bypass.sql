-- "Imagem para vídeo com IA": isenção de créditos para administradores autorizados.
-- credit_cost continua sendo o EQUIVALENTE em créditos (preço da tabela); credits_charged é o que
-- realmente foi cobrado da carteira (0 quando há isenção). O custo real do provedor segue em
-- provider_estimated_cost_usd / provider_actual_cost_usd (controle operacional).
alter table ai_video_generations add column if not exists credit_bypass boolean not null default false;
alter table ai_video_generations add column if not exists credits_charged int;
alter table ai_video_generations add column if not exists bypass_reason text;
