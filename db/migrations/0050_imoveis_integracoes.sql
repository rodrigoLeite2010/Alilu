-- Integração de imóveis de parceiros (imobiliárias/corretores autorizados).
-- Migração ADITIVA: não altera colunas, índices nem funções existentes do módulo
-- de Imóveis (0046). Aplicar manualmente, primeiro em homologação.
--
-- Modelo: cada parceiro possui uma conta técnica em `users` (sem login possível,
-- e-mail em domínio .invalid) que é a "proprietária" dos anúncios importados em
-- `properties`. Assim busca, página pública, sitemap, contato, moderação e
-- vencimento continuam usando exatamente o mesmo código dos anúncios diretos.
-- Os metadados de integração ficam nas tabelas complementares abaixo.

alter table property_images add column if not exists external boolean not null default false;
alter table property_images add column if not exists source_url text not null default '';

create table property_partners (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null unique references users(id) on delete restrict,
 name text not null,
 trade_name text not null default '',
 legal_name text not null default '',
 partner_type text not null default 'Imobiliária' check (partner_type in ('Imobiliária','Corretor')),
 creci text not null default '',
 phone text not null default '',
 whatsapp text not null default '',
 email text not null default '',
 website text not null default '',
 logo_url text not null default '',
 city text not null default '',
 state text not null default '',
 contact_person text not null default '',
 -- CPF/CNPJ e dados do responsável ficam cifrados (AES-256-GCM existente).
 private_data text not null default '',
 status text not null default 'active' check (status in ('active','inactive','suspended')),
 authorization_data jsonb not null default '{}'::jsonb,
 image_policy text not null default 'external' check (image_policy in ('external','copy')),
 allowed_image_hosts text[] not null default '{}',
 allow_listing_contacts boolean not null default false,
 seo_policy text not null default 'noindex' check (seo_policy in ('noindex','index')),
 approved_once boolean not null default false,
 max_listings int not null default 2000 check (max_listings between 1 and 50000),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index property_partners_status_idx on property_partners(status,name);

create table property_partner_sources (
 id uuid primary key default gen_random_uuid(),
 partner_id uuid not null references property_partners(id) on delete cascade,
 name text not null,
 kind text not null check (kind in ('upload','url','api')),
 format text not null check (format in ('csv','xlsx','json','xml','vrsync')),
 feed_mode text not null default 'full' check (feed_mode in ('full','incremental')),
 url text not null default '',
 method text not null default 'GET' check (method in ('GET','POST')),
 -- Headers/token cifrados; nunca retornados ao navegador nem registrados em log.
 secret_headers text not null default '',
 options jsonb not null default '{}'::jsonb,
 frequency_hours int check (frequency_hours is null or frequency_hours between 1 and 168),
 missing_tolerance int not null default 2 check (missing_tolerance between 1 and 30),
 auto_publish boolean not null default false,
 active boolean not null default true,
 next_run_at timestamptz,
 last_run_at timestamptz,
 last_status text not null default '',
 last_error text not null default '',
 consecutive_failures int not null default 0,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index property_partner_sources_due_idx on property_partner_sources(next_run_at) where active and frequency_hours is not null;
create index property_partner_sources_partner_idx on property_partner_sources(partner_id);

create table property_field_mappings (
 id uuid primary key default gen_random_uuid(),
 source_id uuid not null references property_partner_sources(id) on delete cascade,
 version int not null,
 mapping jsonb not null default '{}'::jsonb,
 defaults jsonb not null default '{}'::jsonb,
 transforms jsonb not null default '{}'::jsonb,
 created_by uuid references users(id) on delete set null,
 created_at timestamptz not null default now(),
 unique(source_id,version)
);

create table property_import_batches (
 id uuid primary key default gen_random_uuid(),
 partner_id uuid not null references property_partners(id) on delete cascade,
 source_id uuid not null references property_partner_sources(id) on delete cascade,
 mapping_id uuid references property_field_mappings(id) on delete set null,
 origin text not null check (origin in ('upload','sync')),
 file_name text not null default '',
 status text not null default 'staging' check (status in ('staging','staged','validated','importing','completed','failed','cancelled')),
 complete_feed boolean not null default false,
 publish boolean not null default false,
 total int not null default 0,
 valid int not null default 0,
 invalid int not null default 0,
 created int not null default 0,
 updated int not null default 0,
 unchanged int not null default 0,
 skipped int not null default 0,
 duplicates int not null default 0,
 archived int not null default 0,
 fields jsonb not null default '[]'::jsonb,
 summary jsonb not null default '{}'::jsonb,
 error text not null default '',
 attempts int not null default 0,
 lock_until timestamptz,
 created_by uuid references users(id) on delete set null,
 approved_by uuid references users(id) on delete set null,
 created_at timestamptz not null default now(),
 finished_at timestamptz
);
create index property_import_batches_partner_idx on property_import_batches(partner_id,created_at desc);
create index property_import_batches_work_idx on property_import_batches(status,lock_until) where status in ('importing','staging');
-- Apenas um lote em importação por fonte (controle de concorrência).
create unique index property_import_batches_one_running_idx on property_import_batches(source_id) where status='importing';

create table property_import_items (
 id bigint generated always as identity primary key,
 batch_id uuid not null references property_import_batches(id) on delete cascade,
 row_number int not null,
 external_code text not null default '',
 raw jsonb not null,
 normalized jsonb,
 errors jsonb not null default '[]'::jsonb,
 warnings jsonb not null default '[]'::jsonb,
 action text not null default '' check (action in ('','new','update','unchanged','invalid','remove','duplicate-in-file')),
 status text not null default 'staged' check (status in ('staged','validated','imported','failed','skipped')),
 result text not null default '',
 property_id uuid references properties(id) on delete set null,
 unique(batch_id,row_number)
);
create index property_import_items_work_idx on property_import_items(batch_id,status,id);
create index property_import_items_code_idx on property_import_items(batch_id,external_code);

create table property_external_listings (
 property_id uuid primary key references properties(id) on delete cascade,
 partner_id uuid not null references property_partners(id) on delete cascade,
 source_id uuid references property_partner_sources(id) on delete set null,
 external_code text not null,
 original_url text not null default '',
 content_hash text not null default '',
 image_hash text not null default '',
 address_key text not null default '',
 sync_status text not null default 'active' check (sync_status in ('active','missing','archived','removed_by_partner')),
 missing_count int not null default 0,
 last_batch_id uuid references property_import_batches(id) on delete set null,
 outbound_clicks bigint not null default 0,
 first_imported_at timestamptz not null default now(),
 last_seen_at timestamptz not null default now(),
 last_synced_at timestamptz not null default now(),
 unique(partner_id,external_code)
);
create index property_external_listings_source_idx on property_external_listings(source_id,sync_status);
create index property_external_listings_address_idx on property_external_listings(address_key) where address_key<>'';

create table property_integration_errors (
 id bigint generated always as identity primary key,
 partner_id uuid references property_partners(id) on delete cascade,
 source_id uuid references property_partner_sources(id) on delete cascade,
 batch_id uuid references property_import_batches(id) on delete cascade,
 level text not null default 'error' check (level in ('info','warning','error')),
 code text not null,
 message text not null,
 detail jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);
create index property_integration_errors_recent_idx on property_integration_errors(created_at desc);
create index property_integration_errors_partner_idx on property_integration_errors(partner_id,created_at desc);

create table property_duplicate_candidates (
 id bigint generated always as identity primary key,
 property_a uuid not null references properties(id) on delete cascade,
 property_b uuid not null references properties(id) on delete cascade,
 score int not null,
 signals jsonb not null default '[]'::jsonb,
 status text not null default 'open' check (status in ('open','distinct','confirmed')),
 resolved_by uuid references users(id) on delete set null,
 resolved_at timestamptz,
 created_at timestamptz not null default now(),
 check (property_a < property_b),
 unique(property_a,property_b)
);
create index property_duplicate_candidates_open_idx on property_duplicate_candidates(status,created_at desc);

-- Upsert atômico de um imóvel de parceiro. Chave: parceiro + código externo.
-- Nunca altera anúncios de outro proprietário (diretos ou de outro parceiro).
create function upsert_partner_property(
 p_partner uuid, p_source uuid, p_batch uuid, p_code text, p_new_id uuid, p_slug text,
 p_data jsonb, p_private text, p_fingerprint text, p_images jsonb, p_image_hash text,
 p_original_url text, p_content_hash text, p_address_key text, p_status text
) returns table(out_property_id uuid, out_action text) language plpgsql as $$
declare partner property_partners; ext property_external_listings; cur properties; img jsonb; n int := 0; next_status text;
begin
 select * into partner from property_partners where id=p_partner for update;
 if not found or partner.status<>'active' then raise exception 'property: Parceiro inativo ou suspenso'; end if;
 if p_status not in ('published','pending','paused','sold','rented') then raise exception 'property: Status de importação inválido'; end if;
 select * into ext from property_external_listings where partner_id=p_partner and external_code=p_code for update;
 if not found then
   if p_status in ('paused','sold','rented') then
     return query select null::uuid,'skipped'::text; return;
   end if;
   if (select count(*) from properties where user_id=partner.user_id and status<>'removed') >= partner.max_listings then
     raise exception 'property: Limite de anúncios do parceiro atingido';
   end if;
   insert into properties(id,user_id,slug,data,private_data,fingerprint,status,expires_at)
   values(p_new_id,partner.user_id,p_slug,p_data,p_private,p_fingerprint,p_status,case when p_status='published' then now()+interval '90 days' end);
   for img in select * from jsonb_array_elements(p_images) loop
     insert into property_images(id,user_id,property_id,position,url,thumbnail,bytes,external,source_url)
     values(gen_random_uuid(),partner.user_id,p_new_id,n,img->>'url',coalesce(img->>'thumbnail',img->>'url'),0,true,img->>'url');
     n := n+1;
   end loop;
   insert into property_external_listings(property_id,partner_id,source_id,external_code,original_url,content_hash,image_hash,address_key,last_batch_id)
   values(p_new_id,p_partner,p_source,p_code,p_original_url,p_content_hash,p_image_hash,p_address_key,p_batch);
   insert into property_history(property_id,action,snapshot) values(p_new_id,'partner-import',jsonb_build_object('data',p_data,'status',p_status,'batch',p_batch,'partner',p_partner));
   return query select p_new_id,'created'::text; return;
 end if;
 select * into cur from properties where id=ext.property_id for update;
 if cur.status in ('removed','rejected') then
   -- Remoção/rejeição administrativa prevalece sobre o feed.
   update property_external_listings set last_seen_at=now(),last_batch_id=p_batch,missing_count=0 where property_id=ext.property_id;
   return query select ext.property_id,'blocked'::text; return;
 end if;
 next_status := case
   when p_status in ('paused','sold','rented') then p_status
   when cur.status='pending' then case when p_status='published' then 'published' else 'pending' end
   when cur.status in ('paused','sold','rented') and p_status='published' then 'published'
   when cur.status='published' then 'published'
   else p_status end;
 if ext.content_hash=p_content_hash and ext.image_hash=p_image_hash and cur.status=next_status then
   update properties set expires_at=case when status='published' then greatest(coalesce(expires_at,now()),now()+interval '90 days') else expires_at end where id=cur.id;
   update property_external_listings set last_seen_at=now(),last_synced_at=now(),last_batch_id=p_batch,missing_count=0,sync_status='active',source_id=p_source where property_id=cur.id;
   return query select cur.id,'unchanged'::text; return;
 end if;
 update properties set data=p_data,private_data=p_private,status=next_status,revision=revision+1,updated_at=now(),reason='',
   expires_at=case when next_status='published' then now()+interval '90 days' else expires_at end
   where id=cur.id;
 if ext.image_hash<>p_image_hash then
   -- Fotos externas não ocupam o Blob: removidas diretamente. Fotos copiadas vão para a fila de limpeza existente.
   delete from property_images where property_id=cur.id and external;
   update property_images set property_id=null,delete_pending=true where property_id=cur.id and not external;
   for img in select * from jsonb_array_elements(p_images) loop
     insert into property_images(id,user_id,property_id,position,url,thumbnail,bytes,external,source_url)
     values(gen_random_uuid(),partner.user_id,cur.id,n,img->>'url',coalesce(img->>'thumbnail',img->>'url'),0,true,img->>'url');
     n := n+1;
   end loop;
 end if;
 update property_external_listings set original_url=p_original_url,content_hash=p_content_hash,image_hash=p_image_hash,address_key=p_address_key,
   last_seen_at=now(),last_synced_at=now(),last_batch_id=p_batch,missing_count=0,sync_status=case when next_status in ('sold','rented','paused') and p_status=next_status then 'removed_by_partner' else 'active' end,source_id=p_source
   where property_id=cur.id;
 insert into property_history(property_id,action,snapshot) values(cur.id,'partner-sync',jsonb_build_object('data',p_data,'status',next_status,'batch',p_batch,'partner',p_partner));
 return query select cur.id,'updated'::text;
end $$;

-- Ausência em feed COMPLETO e íntegro: incrementa contador e só pausa após a tolerância.
-- Nunca exclui; nunca toca anúncios diretos (filtra pela fonte do parceiro).
create function archive_missing_partner_properties(p_source uuid, p_batch uuid, p_tolerance int) returns int language plpgsql as $$
declare archived int := 0; r record;
begin
 update property_external_listings set missing_count=missing_count+1,sync_status='missing'
  where source_id=p_source and coalesce(last_batch_id,'00000000-0000-0000-0000-000000000000'::uuid)<>p_batch and sync_status in ('active','missing');
 for r in select e.property_id from property_external_listings e join properties p on p.id=e.property_id
   where e.source_id=p_source and e.sync_status='missing' and e.missing_count>=p_tolerance for update of e loop
   update properties set status='paused',reason='Não consta mais no feed do parceiro.',revision=revision+1,updated_at=now()
    where id=r.property_id and status in ('published','pending');
   update property_external_listings set sync_status='archived' where property_id=r.property_id;
   insert into property_history(property_id,action,snapshot) values(r.property_id,'partner-missing',jsonb_build_object('batch',p_batch));
   archived := archived+1;
 end loop;
 return archived;
end $$;
