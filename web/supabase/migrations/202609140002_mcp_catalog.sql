-- OAuth grants are separate from identity scopes. OAuth clients cannot grant themselves access.
create table public.mcp_grants (
 owner_id uuid not null references auth.users on delete cascade, client_id text not null,
 can_read boolean not null default false, can_edit boolean not null default false,
 can_submit boolean not null default false, revoked_at timestamptz,
 primary key(owner_id,client_id)
);
alter table public.mcp_grants enable row level security;
grant select,insert,update,delete on public.mcp_grants to authenticated;
create policy grants_read on public.mcp_grants for select to authenticated using(owner_id=auth.uid());
create policy grants_manage on public.mcp_grants for all to authenticated
 using(owner_id=auth.uid() and auth.jwt()->>'client_id' is null)
 with check(owner_id=auth.uid() and auth.jwt()->>'client_id' is null);

create function public.mcp_allowed(capability text) returns boolean
 language sql stable security definer set search_path=public as $$
 select auth.uid() is not null and (auth.jwt()->>'client_id' is null or exists (
  select 1 from mcp_grants where owner_id=auth.uid() and client_id=auth.jwt()->>'client_id'
  and revoked_at is null and case capability when 'read' then can_read when 'edit' then can_edit when 'submit' then can_submit else false end
 ));
$$;
revoke all on function public.mcp_allowed(text) from public;
grant execute on function public.mcp_allowed(text) to authenticated;
-- Restrictive policies combine with ownership policies, including direct PostgREST access.
create policy documents_mcp_read on public.documents as restrictive for select to authenticated using(public.mcp_allowed('read'));
create policy documents_mcp_insert on public.documents as restrictive for insert to authenticated with check(public.mcp_allowed('edit'));
create policy documents_mcp_update on public.documents as restrictive for update to authenticated using(public.mcp_allowed('edit')) with check(public.mcp_allowed('edit'));
create policy documents_mcp_delete on public.documents as restrictive for delete to authenticated using(public.mcp_allowed('edit'));
create policy settings_mcp on public.user_settings as restrictive for all to authenticated using(auth.jwt()->>'client_id' is null) with check(auth.jwt()->>'client_id' is null);
create policy shares_mcp on public.share_links as restrictive for all to authenticated using(auth.jwt()->>'client_id' is null);
create policy research_mcp on public.research_jobs as restrictive for select to authenticated using(auth.jwt()->>'client_id' is null);
create policy reports_mcp on public.reports as restrictive for all to authenticated using(auth.jwt()->>'client_id' is null) with check(auth.jwt()->>'client_id' is null);
create policy publications_mcp on public.publications as restrictive for select to authenticated using((listed and not hidden) or public.mcp_allowed('read'));

create table public.mcp_saves (
 owner_id uuid not null references auth.users on delete cascade,
 operation_id uuid not null, request_hash text not null, result jsonb not null,
 created_at timestamptz not null default now(), primary key(owner_id,operation_id)
);
alter table public.mcp_saves enable row level security;
-- Receipt rows may only be written by the save function, never forged by a client.
revoke all on public.mcp_saves from anon,authenticated;
create function public.save_document_once(p_operation_id uuid,p_request_hash text,p_id text,p_document jsonb,p_expected_revision integer,p_is_preset boolean default false)
returns jsonb language plpgsql security definer set search_path=public as $$
declare previous public.mcp_saves; result_row public.documents;
begin
 if not public.mcp_allowed('edit') or not public.mcp_allowed('read') then raise exception 'Access denied' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||p_operation_id::text,0));
 select * into previous from mcp_saves where owner_id=auth.uid() and operation_id=p_operation_id;
 if found then
  if previous.request_hash<>p_request_hash then raise exception 'Operation ID reused with different input' using errcode='40001'; end if;
  return previous.result;
 end if;
 -- save_document explicitly checks auth.uid and owner_id, including insert conflicts.
 select * into result_row from public.save_document(p_id,p_document,p_expected_revision,p_is_preset);
 insert into mcp_saves(owner_id,operation_id,request_hash,result) values(auth.uid(),p_operation_id,p_request_hash,to_jsonb(result_row));
 return to_jsonb(result_row);
end $$;
revoke all on function public.save_document_once(uuid,text,text,jsonb,integer,boolean) from public,anon;
grant execute on function public.save_document_once(uuid,text,text,jsonb,integer,boolean) to authenticated;

create table public.catalog_counts(item_id text primary key,views bigint not null default 0 check(views>=0));
create table public.catalog_views(item_id text not null,visitor_hash text not null,day date not null default(current_timestamp at time zone 'UTC')::date,primary key(item_id,visitor_hash,day));
alter table public.catalog_counts enable row level security;
alter table public.catalog_views enable row level security;
revoke all on public.catalog_counts,public.catalog_views from anon,authenticated;
-- Only the Worker can record views. It validates manifest preset IDs and hashes visitors.
create function public.record_catalog_view(p_item_id text,p_visitor_hash text,p_owner_id uuid default null) returns boolean
 language plpgsql security definer set search_path=public as $$
declare inserted integer;
begin
 if p_item_id like 'publication:%' then
  perform 1 from publications where id::text=substring(p_item_id from 13)
   and listed and not hidden and owner_id is distinct from p_owner_id for share;
  if not found then return false; end if;
 elsif p_item_id not like 'preset:%' then return false;
 end if;
 insert into catalog_views(item_id,visitor_hash) values(p_item_id,p_visitor_hash) on conflict do nothing;
 get diagnostics inserted=row_count;
 if inserted=0 then return false; end if;
 insert into catalog_counts(item_id,views) values(p_item_id,1)
  on conflict(item_id) do update set views=catalog_counts.views+1;
 return true;
end $$;
revoke all on function public.record_catalog_view(text,text,uuid) from public,anon,authenticated;
grant execute on function public.record_catalog_view(text,text,uuid) to service_role;

-- Manifest data is supplied by the deployed Worker, never by an anonymous caller.
create function public.browse_catalog(p_presets jsonb,p_search text default '',p_source text default 'all',p_sort text default 'most_viewed',p_offset integer default 0,p_limit integer default 24)
returns jsonb language sql stable security definer set search_path=public as $$
 with entries as (
  select 'preset:'||(p->>'id') as id,'preset'::text as source,p->>'id' as source_id,p->>'title' as title,
   p->>'description' as description,coalesce(p->>'category','') as category,'Game Economist Consulting'::text as author,null::text as thumbnail_path,
   coalesce((p->>'created_at')::timestamptz,'2026-09-13'::timestamptz) as created_at
   from jsonb_array_elements(p_presets) p
  union all
  select 'publication:'||id::text,'community',id::text,title,description,''::text,author,thumbnail_path,created_at
   from publications where listed and not hidden
 ), matching as (
  select e.*,coalesce(c.views,0) as views from entries e left join catalog_counts c on c.item_id=e.id
   where (p_source='all' or source=p_source)
    and (p_search='' or position(lower(p_search) in lower(title||' '||description||' '||category))>0)
 ), page as (
  select * from matching order by
   case when p_sort='most_viewed' then views end desc,
   case when p_sort='newest' then created_at end desc,
   lower(title),id offset greatest(p_offset,0) limit least(greatest(p_limit,1),100)
 ) select jsonb_build_object('items',coalesce((select jsonb_agg(to_jsonb(page)) from page),'[]'::jsonb),'total',(select count(*) from matching),'analyticsAvailable',true);
$$;
revoke all on function public.browse_catalog(jsonb,text,text,text,integer,integer) from public,anon,authenticated;
grant execute on function public.browse_catalog(jsonb,text,text,text,integer,integer) to service_role;

create table public.mcp_previews(
 id uuid primary key default gen_random_uuid(),owner_id uuid not null references auth.users on delete cascade,
 client_id text, document jsonb not null, svg_path text, png_path text,
 expires_at timestamptz not null default(now()+interval '1 hour'),created_at timestamptz not null default now()
);
create table public.preset_submissions(
 id uuid primary key,owner_id uuid not null references auth.users on delete cascade,
 client_id text,request_hash text not null,base_sha text not null,payload jsonb not null,
 status text not null default 'preview',pr_url text,created_at timestamptz not null default now()
);
alter table public.mcp_previews enable row level security;
alter table public.preset_submissions enable row level security;
revoke all on public.mcp_previews,public.preset_submissions from anon,authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('mcp-previews','mcp-previews',false,30000000,array['image/png','image/svg+xml']) on conflict do nothing;

create function public.mcp_save_receipt(p_operation_id uuid,p_request_hash text) returns jsonb
 language plpgsql security definer set search_path=public as $$
declare receipt public.mcp_saves;
begin
 if not public.mcp_allowed('read') or not public.mcp_allowed('edit') then raise exception 'Access denied' using errcode='42501'; end if;
 select * into receipt from mcp_saves where owner_id=auth.uid() and operation_id=p_operation_id;
 if not found then return null; end if;
 if receipt.request_hash<>p_request_hash then raise exception 'Operation ID reused with different input' using errcode='40001'; end if;
 return receipt.result;
end $$;
revoke all on function public.mcp_save_receipt(uuid,text) from public,anon;
grant execute on function public.mcp_save_receipt(uuid,text) to authenticated;

-- Configure one canonical resource URL per environment before enabling the OAuth hook.
create table public.mcp_configuration(singleton boolean primary key default true check(singleton),resource_url text not null);
alter table public.mcp_configuration enable row level security;
revoke all on public.mcp_configuration from public,anon,authenticated;
create function public.mcp_access_token_hook(event jsonb) returns jsonb
 language plpgsql stable security definer set search_path=public as $$
declare claims jsonb; resource text;
begin
 claims := event->'claims';
 if claims->>'client_id' is not null then
  select resource_url into resource from mcp_configuration where singleton;
  if resource is not null and exists(select 1 from mcp_grants where owner_id=(claims->>'sub')::uuid and client_id=claims->>'client_id' and revoked_at is null and can_read) then
   claims := jsonb_set(claims,'{aud}',jsonb_build_array('authenticated',resource));
  end if;
 end if;
 return jsonb_set(event,'{claims}',claims);
end $$;
revoke all on function public.mcp_access_token_hook(jsonb) from public,anon,authenticated;
grant execute on function public.mcp_access_token_hook(jsonb) to supabase_auth_admin;
