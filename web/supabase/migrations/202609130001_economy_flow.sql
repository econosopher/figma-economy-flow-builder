-- Dedicated Economy Flow project. Never apply this to a client database.
create table public.documents (
 id text primary key, owner_id uuid not null references auth.users on delete cascade,
 document jsonb not null, revision integer not null default 1 check(revision>0), is_preset boolean not null default false,
 updated_at timestamptz not null default now(), check(octet_length(document::text)<2000000)
);
create index documents_owner on public.documents(owner_id,updated_at desc);
alter table public.documents enable row level security;
create policy documents_owner on public.documents for all to authenticated using(owner_id=auth.uid()) with check(owner_id=auth.uid());
create table public.user_settings(owner_id uuid primary key references auth.users on delete cascade, settings jsonb not null,updated_at timestamptz not null default now());
alter table public.user_settings enable row level security;
create policy settings_owner on public.user_settings for all to authenticated using(owner_id=auth.uid()) with check(owner_id=auth.uid());
create or replace function public.save_document(p_id text,p_document jsonb,p_expected_revision integer,p_is_preset boolean default false)
returns public.documents language plpgsql security invoker set search_path=public as $$
declare current_row public.documents;
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
 if p_document->>'id' is distinct from p_id or p_document->>'schemaVersion' is distinct from '3' then raise exception 'Invalid document'; end if;
 if p_expected_revision=0 then
  insert into public.documents(id,owner_id,document,is_preset) values(p_id,auth.uid(),p_document,p_is_preset) on conflict do nothing returning * into current_row;
  if current_row.id is null then raise exception 'Revision conflict' using errcode='40001'; end if;
 else
  update public.documents set document=p_document,revision=revision+1,updated_at=now(),is_preset=p_is_preset
  where id=p_id and owner_id=auth.uid() and revision=p_expected_revision returning * into current_row;
  if current_row.id is null then raise exception 'Revision conflict' using errcode='40001'; end if;
 end if;
 return current_row;
end $$;
revoke all on function public.save_document(text,jsonb,integer,boolean) from public,anon;
grant execute on function public.save_document(text,jsonb,integer,boolean) to authenticated;
create table public.publications(
 id uuid primary key default gen_random_uuid(),owner_id uuid not null references auth.users on delete cascade,
 document_id text not null,title text not null check(length(title)<=200),description text not null default '' check(length(description)<=2000),
 author text not null check(length(author)<=100),snapshot jsonb not null,thumbnail_path text,
 hidden boolean not null default false,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(owner_id,document_id),check(octet_length(snapshot::text)<2000000)
);
alter table public.publications enable row level security;
create policy publications_read on public.publications for select using(not hidden or owner_id=auth.uid());
-- Writes go through the authenticated API, which prevents users from overriding moderation.
create table public.share_links(id uuid primary key default gen_random_uuid(),owner_id uuid not null references auth.users on delete cascade,document_id text not null,token_hash text unique not null,snapshot jsonb not null,created_at timestamptz default now(),check(octet_length(snapshot::text)<2000000));
alter table public.share_links enable row level security;
create policy shares_owner_read on public.share_links for select to authenticated using(owner_id=auth.uid());
create policy shares_owner_delete on public.share_links for delete to authenticated using(owner_id=auth.uid());
create table public.reports(id uuid primary key default gen_random_uuid(),publication_id uuid not null references public.publications on delete cascade,owner_id uuid not null references auth.users on delete cascade,reason text not null check(length(reason) between 1 and 2000),created_at timestamptz default now(),unique(publication_id,owner_id));
alter table public.reports enable row level security;
create policy reports_insert on public.reports for insert to authenticated with check(owner_id=auth.uid());
create policy reports_own_read on public.reports for select to authenticated using(owner_id=auth.uid());
create table public.slack_installations(id uuid primary key default gen_random_uuid(),owner_id uuid not null references auth.users on delete cascade,team_id text not null,team_name text not null,bot_name text not null,credential text not null,scopes text not null,created_at timestamptz default now(),unique(owner_id,team_id));
create table public.oauth_states(token_hash text primary key,owner_id uuid not null references auth.users on delete cascade,expires_at timestamptz not null);
create table public.slack_operations(id uuid primary key,owner_id uuid not null references auth.users on delete cascade,payload_hash text not null,status text not null check(status in ('queued','uploading','completing','sent','uncertain','failed')),file_id text,error text,payload jsonb,preview_removed boolean not null default false,created_at timestamptz default now());
create table public.research_jobs(id uuid primary key default gen_random_uuid(),owner_id uuid not null references auth.users on delete cascade,provider text not null check(provider in ('gemini','openai','claude')),game_name text not null,depth integer not null check(depth between 1 and 3),status text not null default 'queued',progress integer not null default 0,result jsonb,brief text,error text,expires_at timestamptz not null default(now()+interval '1 hour'),created_at timestamptz not null default now());
create index research_owner on public.research_jobs(owner_id,created_at desc);
create table public.job_credentials(job_id uuid primary key references public.research_jobs on delete cascade,credential text not null,expires_at timestamptz not null default(now()+interval '1 hour'));
alter table public.slack_installations enable row level security;
alter table public.oauth_states enable row level security;
alter table public.slack_operations enable row level security;
alter table public.research_jobs enable row level security;
alter table public.job_credentials enable row level security;
create policy research_owner_read on public.research_jobs for select to authenticated using(owner_id=auth.uid());
-- No client policies on credentials, OAuth state, or send operations.
revoke all on public.slack_installations,public.oauth_states,public.slack_operations,public.job_credentials from anon,authenticated;
grant select on public.research_jobs to authenticated;
revoke insert,update,delete on public.research_jobs from anon,authenticated;
revoke insert,update,delete on public.publications from anon,authenticated;
revoke insert,update on public.share_links from anon,authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('gallery-thumbnails','gallery-thumbnails',false,2097152,array['image/png']) on conflict do nothing;
-- Thumbnails are written/deleted only by the service API.
-- Read access goes through the API so unpublish and moderation revoke thumbnails too.
grant select,insert,update,delete on public.documents,public.user_settings to authenticated;
grant select on public.publications to anon,authenticated;
grant select,delete on public.share_links to authenticated;
grant select,insert on public.reports to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('slack-previews','slack-previews',false,15000000,array['image/png']) on conflict do nothing;
-- No client policies: approved send previews are available only to the Worker and are deleted after completion.
