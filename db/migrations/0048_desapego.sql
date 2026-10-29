-- New marketplace module. Additive only; apply manually after review.
create table desapego_settings (
  id int primary key check (id = 1),
  config jsonb not null
);
insert into desapego_settings values (1, '{"maxListings":10,"maxPhotos":15,"storageMB":500,"categories":[{"name":"Celulares e smartphones","subcategories":["Celulares","Smartwatches","Acessórios"]},{"name":"Computadores e notebooks","subcategories":["Notebooks","Desktops","Tablets"]},{"name":"Videogames","subcategories":["Consoles","Jogos","Acessórios"]},{"name":"Eletrônicos","subcategories":["Áudio","TV e vídeo","Câmeras"]},{"name":"Eletrodomésticos","subcategories":["Cozinha","Lavanderia","Climatização"]},{"name":"Móveis","subcategories":["Sala","Quarto","Cozinha","Escritório"]},{"name":"Decoração","subcategories":["Quadros","Iluminação","Tapetes"]},{"name":"Roupas","subcategories":["Feminina","Masculina","Infantil"]},{"name":"Calçados","subcategories":["Feminino","Masculino","Infantil"]},{"name":"Bolsas e acessórios","subcategories":["Bolsas","Relógios","Acessórios"]},{"name":"Brinquedos","subcategories":["Educativos","Jogos","Pelúcias"]},{"name":"Artigos infantis","subcategories":["Carrinhos","Móveis infantis","Enxoval"]},{"name":"Esportes e lazer","subcategories":["Fitness","Camping","Lazer"]},{"name":"Bicicletas","subcategories":["Adulto","Infantil","Peças"]},{"name":"Ferramentas","subcategories":["Manuais","Elétricas","Jardim"]},{"name":"Instrumentos musicais","subcategories":["Cordas","Teclas","Sopro","Áudio"]},{"name":"Livros","subcategories":["Literatura","Didáticos","Infantis"]},{"name":"Equipamentos de informática","subcategories":["Monitores","Periféricos","Componentes"]},{"name":"Jardim","subcategories":["Móveis externos","Plantas","Equipamentos"]},{"name":"Utilidades domésticas","subcategories":["Cozinha","Organização","Limpeza"]},{"name":"Peças e acessórios automotivos permitidos","subcategories":["Acessórios","Peças"]},{"name":"Outros produtos","subcategories":[]}]}');

create table desapego_advertisers (
  user_id uuid primary key references users(id) on delete cascade,
  suspended boolean not null default false
);
create table desapego_ads (
  id uuid primary key,
  user_id uuid not null references users(id) on delete cascade,
  slug text not null unique,
  status text not null default 'draft' check (status in ('draft','pending','published','paused','sold','rejected','removed')),
  data jsonb not null,
  private_data text not null,
  fingerprint text not null,
  revision int not null default 1,
  reason text not null default '',
  expires_at timestamptz,
  views bigint not null default 0,
  contacts bigint not null default 0,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index desapego_duplicate_idx on desapego_ads(user_id,fingerprint) where status <> 'removed';
create index desapego_owner_idx on desapego_ads(user_id,updated_at desc);
create index desapego_public_idx on desapego_ads(status,created_at desc,id);
create index desapego_location_idx on desapego_ads((data->>'state'),(lower(data->>'city')),(data->>'category')) where status='published';
create index desapego_price_idx on desapego_ads(((data->>'price')::numeric),id) where status='published';
create index desapego_search_idx on desapego_ads using gin (to_tsvector('simple'::regconfig, coalesce(data->>'title','') || ' ' || coalesce(data->>'description','') || ' ' || coalesce(data->>'brand','') || ' ' || coalesce(data->>'model',''))) where status='published';

create table desapego_images (
  id uuid primary key,
  user_id uuid not null references users(id) on delete cascade,
  ad_id uuid references desapego_ads(id) on delete set null,
  position int not null default 0,
  url text not null default '',
  thumbnail text not null default '',
  bytes bigint not null default 0,
  delete_pending boolean not null default false,
  created_at timestamptz not null default now()
);
create index desapego_images_ad_idx on desapego_images(ad_id,position);
create index desapego_images_cleanup_idx on desapego_images(delete_pending,created_at);
create table desapego_favorites (
  user_id uuid references users(id) on delete cascade,
  ad_id uuid references desapego_ads(id) on delete cascade,
  primary key(user_id,ad_id)
);
create table desapego_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete set null,
  ad_id uuid references desapego_ads(id) on delete cascade,
  report_key text not null unique,
  reason text not null,
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);
create table desapego_history (
  id bigint generated always as identity primary key,
  ad_id uuid references desapego_ads(id) on delete cascade,
  actor_id uuid references users(id) on delete set null,
  action text not null,
  snapshot jsonb not null,
  created_at timestamptz not null default now()
);
create index desapego_history_ad_idx on desapego_history(ad_id,id desc);
create table desapego_rate_limits (
  key text primary key,
  calls int not null default 1,
  window_start timestamptz not null default now()
);

create function desapego_save(p_user uuid,p_id uuid,p_slug text,p_data jsonb,p_private text,p_fingerprint text,p_images uuid[],p_submit boolean,p_revision int) returns uuid language plpgsql as $$
declare cfg jsonb; old_row desapego_ads; image_id uuid; n int := 0;
begin
  perform id from users where id=p_user and disabled_at is null for update;
  if not found then raise exception 'desapego: Usuário inválido'; end if;
  if exists(select 1 from desapego_advertisers where user_id=p_user and suspended) then raise exception 'desapego: Conta de anunciante suspensa'; end if;
  select config into cfg from desapego_settings where id=1;
  select * into old_row from desapego_ads where id=p_id for update;
  if found then
    if old_row.user_id<>p_user or old_row.status='removed' then raise exception 'desapego: Anúncio indisponível'; end if;
    if old_row.revision<>p_revision then raise exception 'desapego: Outra edição foi salva. Atualize a página'; end if;
  else
    if (select count(*) from desapego_ads where user_id=p_user and status<>'removed') >= (cfg->>'maxListings')::int then raise exception 'desapego: Limite de anúncios atingido'; end if;
  end if;
  if cardinality(p_images)>(cfg->>'maxPhotos')::int or (p_submit and cardinality(p_images)=0) then raise exception 'desapego: Confira as fotos'; end if;
  foreach image_id in array p_images loop
    perform id from desapego_images where id=image_id and user_id=p_user and (ad_id is null or ad_id=p_id) and not delete_pending and url<>'' for update;
    if not found then raise exception 'desapego: Foto não pertence a este anúncio ou foi removida'; end if;
  end loop;
  insert into desapego_ads(id,user_id,slug,data,private_data,fingerprint,status) values(p_id,p_user,p_slug,p_data,p_private,p_fingerprint,case when p_submit then 'pending' else 'draft' end)
  on conflict(id) do update set data=excluded.data,private_data=excluded.private_data,fingerprint=excluded.fingerprint,status=excluded.status,revision=desapego_ads.revision+1,reason='',updated_at=now();
  update desapego_images set ad_id=null,delete_pending=true where ad_id=p_id and not(id=any(p_images));
  foreach image_id in array p_images loop
    update desapego_images set ad_id=p_id,position=n where id=image_id;
    n:=n+1;
  end loop;
  insert into desapego_history(ad_id,actor_id,action,snapshot) values(p_id,p_user,'save',jsonb_build_object('data',p_data,'images',p_images,'status',case when p_submit then 'pending' else 'draft' end));
  return p_id;
end $$;

create function desapego_reserve_image(p_user uuid,p_id uuid) returns boolean language plpgsql as $$
declare cfg jsonb;
begin
  select config into cfg from desapego_settings where id=1 for update;
  if exists(select 1 from desapego_advertisers where user_id=p_user and suspended) or exists(select 1 from users where id=p_user and disabled_at is not null) then return false; end if;
  if (select coalesce(sum(bytes),0) from desapego_images)+2097152 > (cfg->>'storageMB')::bigint*1048576 then return false; end if;
  if (select count(*) from desapego_images where user_id=p_user) >= (cfg->>'maxListings')::int*(cfg->>'maxPhotos')::int+20 then return false; end if;
  insert into desapego_images(id,user_id,bytes) values(p_id,p_user,2097152);
  return true;
end $$;

create function desapego_transition(p_actor uuid,p_id uuid,p_status text,p_admin boolean,p_reason text,p_revision int default null) returns boolean language plpgsql as $$
declare old_row desapego_ads;
begin
  select * into old_row from desapego_ads where id=p_id for update;
  if not found or old_row.status='removed' then return false; end if;
  if p_admin then
    if p_revision is not null and old_row.revision<>p_revision then return false; end if;
    if p_status not in ('published','rejected','removed') then return false; end if;
    if p_status='published' and (old_row.status<>'pending' or exists(select 1 from desapego_advertisers where user_id=old_row.user_id and suspended) or not exists(select 1 from desapego_images where ad_id=p_id and not delete_pending and url<>'')) then return false; end if;
  else
    if old_row.user_id<>p_actor then return false; end if;
    if exists(select 1 from desapego_advertisers where user_id=p_actor and suspended) and p_status<>'removed' then return false; end if;
    if p_status not in ('pending','paused','sold','removed') then return false; end if;
    if p_status in ('paused','sold') and old_row.status not in ('published','paused') then return false; end if;
    if p_status='pending' and old_row.status not in ('paused','sold') then return false; end if;
  end if;
  update desapego_ads set status=p_status,reason=left(p_reason,500),revision=revision+1,updated_at=now(),published_at=case when p_status='published' then now() else published_at end,expires_at=case when p_status='published' then now()+interval '90 days' else expires_at end,
    private_data=case when p_status='removed' then '' else private_data end,
    data=case when p_status='removed' then '{}'::jsonb else data end where id=p_id;
  if p_status='removed' then
    update desapego_images set ad_id=null,delete_pending=true where ad_id=p_id;
    delete from desapego_favorites where ad_id=p_id;
    delete from desapego_reports where ad_id=p_id;
  end if;
  insert into desapego_history(ad_id,actor_id,action,snapshot) values(p_id,p_actor,p_status,jsonb_build_object('reason',left(p_reason,500)));
  if p_admin then update desapego_reports set resolved=true where ad_id=p_id; end if;
  return true;
end $$;
