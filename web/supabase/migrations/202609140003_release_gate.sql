-- Public snapshots must pass the application release checker. Anonymous table
-- access would bypass that checker, so public reads now go through the Worker.
begin;

drop policy if exists publications_read on public.publications;
drop policy if exists publications_owner_read on public.publications;
create policy publications_owner_read on public.publications
 for select to authenticated using(owner_id=auth.uid());

revoke select on public.publications from anon;
grant select on public.publications to authenticated;
grant usage on schema public to service_role;
grant select on public.publications to service_role;

-- Final artifacts are served by authenticated Worker routes after checking the
-- stored document. Keep their storage buckets private even on upgraded projects.
update storage.buckets set public=false
 where id in ('gallery-thumbnails','mcp-previews','slack-previews');

commit;
