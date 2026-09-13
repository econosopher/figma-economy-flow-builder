-- Existing diagrams keep snapshot publishing. Only explicit visibility opts in.
alter table public.publications add column listed boolean not null default true;
drop policy publications_read on public.publications;
create policy publications_read on public.publications for select
 using ((listed and not hidden) or owner_id=auth.uid());

-- Runs in the same transaction and row lock as the owner's optimistic save.
-- The trigger owner writes publications; clients still cannot write them directly.
create function public.sync_diagram_visibility() returns trigger
 language plpgsql security definer set search_path=public as $$
begin
 if new.document->>'visibility' = 'public' then
  if jsonb_array_length(coalesce(new.document->'cards','[]'::jsonb)) > 0 then
   insert into public.publications(owner_id,document_id,title,author,snapshot,listed)
   values(new.owner_id,new.id,left(new.document->>'name',200),'Community member',new.document,true)
   on conflict(owner_id,document_id) do update set
    title=excluded.title,snapshot=excluded.snapshot,listed=true,
    thumbnail_path=null,updated_at=now();
   -- Never reset hidden: an owner cannot undo administrator removal by saving.
  else
   update public.publications set listed=false where owner_id=new.owner_id and document_id=new.id;
  end if;
 elsif new.document->>'visibility' = 'private' then
  update public.publications set listed=false,updated_at=now()
   where owner_id=new.owner_id and document_id=new.id;
 end if;
 return new;
end $$;
revoke all on function public.sync_diagram_visibility() from public,anon,authenticated;
create trigger documents_visibility after insert or update on public.documents
 for each row execute function public.sync_diagram_visibility();

-- Serialize legacy snapshot writes against privacy changes. A stale request
-- cannot republish a diagram after its owner locks it, even through the API.
create function public.guard_managed_publication() returns trigger
 language plpgsql security definer set search_path=public as $$
declare mode text;
begin
 if pg_trigger_depth()>1 then return new; end if;
 select document->>'visibility' into mode from public.documents
  where id=new.document_id and owner_id=new.owner_id for update;
 if mode is not null and
   (tg_op='INSERT' or new.snapshot is distinct from old.snapshot or new.listed is distinct from old.listed) then
  raise exception 'Use the diagram lock and account save to change its publication' using errcode='42501';
 end if;
 return new;
end $$;
revoke all on function public.guard_managed_publication() from public,anon,authenticated;
create trigger publications_visibility_guard before insert or update on public.publications
 for each row execute function public.guard_managed_publication();
