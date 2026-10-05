-- Diagnóstico mobile do OAuth do Instagram. Não contém segredos.
alter table instagram_oauth_events add column if not exists correlation_id text;
alter table instagram_oauth_events add column if not exists user_agent text;
alter table instagram_oauth_events add column if not exists is_mobile boolean;
alter table instagram_oauth_events add column if not exists browser text;

create index if not exists instagram_oauth_events_correlation_idx on instagram_oauth_events (correlation_id);
