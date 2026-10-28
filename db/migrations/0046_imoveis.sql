-- Additive migration. Apply manually after reviewing on a preview database.
create table property_settings (id int primary key check (id=1), config jsonb not null);
insert into property_settings values (1, '{"maxListings":10,"maxPhotos":20,"storageMB":500,"types":["Casa","Apartamento","Terreno","Chácara","Cobertura","Kitnet","Sala comercial","Galpão","Outro"],"features":["Área de lazer","Piscina","Churrasqueira","Condomínio fechado","Mobiliado","Aceita animais"]}');
create table property_advertisers (user_id uuid primary key references users(id) on delete cascade, suspended boolean not null default false);
create table properties (
 id uuid primary key, user_id uuid not null references users(id) on delete cascade,
 slug text not null unique, status text not null default 'draft' check(status in ('draft','pending','published','paused','sold','rented','rejected','removed')),
 data jsonb not null, private_data text not null, fingerprint text not null,
 revision int not null default 1, reason text not null default '', expires_at timestamptz,
 views bigint not null default 0, contacts bigint not null default 0,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index properties_duplicate_idx on properties(user_id,fingerprint) where status <> 'removed';
create index properties_owner_idx on properties(user_id,updated_at desc);
create index properties_public_idx on properties(status,created_at desc,id);
create index properties_location_idx on properties((data->>'state'),(lower(data->>'city')),(data->>'type')) where status='published';
create index properties_price_idx on properties(((data->>'price')::numeric),id) where status='published';
create index properties_area_idx on properties(((data->>'area')::numeric),id) where status='published';
create index properties_features_idx on properties using gin ((data->'features')) where status='published';
create table property_images (
 id uuid primary key, user_id uuid not null references users(id) on delete cascade,
 property_id uuid references properties(id) on delete set null, position int not null default 0,
 url text not null default '', thumbnail text not null default '', bytes bigint not null default 0,
 delete_pending boolean not null default false, created_at timestamptz not null default now()
);
create index property_images_property_idx on property_images(property_id,position);
create index property_images_cleanup_idx on property_images(delete_pending,created_at);
create table property_favorites (user_id uuid references users(id) on delete cascade, property_id uuid references properties(id) on delete cascade, primary key(user_id,property_id));
create table property_reports (id uuid primary key default gen_random_uuid(), user_id uuid references users(id) on delete set null, property_id uuid references properties(id) on delete cascade, reason text not null, resolved boolean not null default false, created_at timestamptz not null default now(), unique(user_id,property_id));
create table property_history (id bigint generated always as identity primary key, property_id uuid references properties(id) on delete cascade, actor_id uuid references users(id) on delete set null, action text not null, snapshot jsonb not null, created_at timestamptz not null default now());
create index property_history_property_idx on property_history(property_id,id desc);
create table property_rate_limits (key text primary key, calls int not null default 1, window_start timestamptz not null default now());

-- One transaction and a per-owner row lock protect quotas, revisions and media ownership.
create function save_property(p_user uuid,p_id uuid,p_slug text,p_data jsonb,p_private text,p_fingerprint text,p_images uuid[],p_submit boolean,p_revision int) returns uuid language plpgsql as $$
declare cfg jsonb; old properties; image_id uuid; n int := 0;
begin
 perform id from users where id=p_user and disabled_at is null for update;
 if not found then raise exception 'property: Usuário inválido'; end if;
 if exists(select 1 from property_advertisers where user_id=p_user and suspended) then raise exception 'property: Anunciante suspenso'; end if;
 select config into cfg from property_settings where id=1;
 select * into old from properties where id=p_id for update;
 if found then
   if old.user_id<>p_user or old.status='removed' then raise exception 'property: Anúncio indisponível'; end if;
   if old.revision<>p_revision then raise exception 'property: Outra edição foi salva. Atualize a página'; end if;
 else
   if (select count(*) from properties where user_id=p_user and status<>'removed') >= (cfg->>'maxListings')::int then raise exception 'property: Limite de anúncios atingido'; end if;
 end if;
 if cardinality(p_images)>(cfg->>'maxPhotos')::int or (p_submit and cardinality(p_images)=0) then raise exception 'property: Confira as fotos'; end if;
 foreach image_id in array p_images loop
   perform id from property_images where id=image_id and user_id=p_user and (property_id is null or property_id=p_id) and not delete_pending and url<>'' for update;
   if not found then raise exception 'property: Foto não pertence a este anúncio ou foi removida'; end if;
 end loop;
 insert into properties(id,user_id,slug,data,private_data,fingerprint,status) values(p_id,p_user,p_slug,p_data,p_private,p_fingerprint,case when p_submit then 'pending' else 'draft' end)
 on conflict(id) do update set data=excluded.data,private_data=excluded.private_data,fingerprint=excluded.fingerprint,status=excluded.status,revision=properties.revision+1,reason='',updated_at=now();
 update property_images set property_id=null,delete_pending=true where property_id=p_id and not(id=any(p_images));
 foreach image_id in array p_images loop
   update property_images set property_id=p_id,position=n where id=image_id; n:=n+1;
 end loop;
 insert into property_history(property_id,actor_id,action,snapshot) values(p_id,p_user,'save',jsonb_build_object('data',p_data,'images',p_images,'status',case when p_submit then 'pending' else 'draft' end));
 return p_id;
end $$;

create function reserve_property_image(p_user uuid,p_id uuid) returns boolean language plpgsql as $$
declare cfg jsonb;
begin
 select config into cfg from property_settings where id=1 for update;
 if exists(select 1 from property_advertisers where user_id=p_user and suspended) or exists(select 1 from users where id=p_user and disabled_at is not null) then return false; end if;
 if (select coalesce(sum(bytes),0) from property_images)+2097152 > (cfg->>'storageMB')::bigint*1048576 then return false; end if;
 if (select count(*) from property_images where user_id=p_user) >= (cfg->>'maxListings')::int*(cfg->>'maxPhotos')::int+20 then return false; end if;
 insert into property_images(id,user_id,bytes) values(p_id,p_user,2097152);
 return true;
end $$;

create function transition_property(p_actor uuid,p_id uuid,p_status text,p_admin boolean,p_reason text,p_revision int default null) returns boolean language plpgsql as $$
declare old properties;
begin
 select * into old from properties where id=p_id for update;
 if not found or old.status='removed' then return false; end if;
 if p_admin then
   if p_revision is not null and old.revision<>p_revision then return false; end if;
   if p_status not in ('published','rejected','removed') then return false; end if;
   if p_status='published' and (old.status<>'pending' or exists(select 1 from property_advertisers where user_id=old.user_id and suspended) or not exists(select 1 from property_images where property_id=p_id and not delete_pending and url<>'')) then return false; end if;
 else
   if old.user_id<>p_actor then return false; end if;
   if exists(select 1 from property_advertisers where user_id=p_actor and suspended) and p_status<>'removed' then return false; end if;
   if p_status not in ('pending','paused','sold','rented','removed') then return false; end if;
   if p_status in ('paused','sold','rented') and old.status not in ('published','paused') then return false; end if;
   if p_status='pending' and (old.status not in ('paused','sold','rented') or not exists(select 1 from property_images where property_id=p_id and not delete_pending and url<>'')) then return false; end if;
 end if;
 update properties set status=p_status,reason=left(p_reason,500),revision=revision+1,updated_at=now(),
   expires_at=case when p_status='published' then now()+interval '90 days' else expires_at end,
   private_data=case when p_status='removed' then '' else private_data end,
   data=case when p_status='removed' then '{}'::jsonb else data end where id=p_id;
 if p_status='removed' then
   update property_images set property_id=null,delete_pending=true where property_id=p_id;
   delete from property_favorites where property_id=p_id;
   delete from property_history where property_id=p_id;
   delete from property_reports where property_id=p_id;
 end if;
 insert into property_history(property_id,actor_id,action,snapshot) values(p_id,p_actor,p_status,jsonb_build_object('reason',left(p_reason,500)));
 if p_admin then update property_reports set resolved=true where property_id=p_id; end if;
 return true;
end $$;
