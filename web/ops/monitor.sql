-- Run with the service identity in the dedicated Economy Flow Supabase project.
-- Never include credentials, private documents, or provider bodies in incident exports.
select status,count(*),min(created_at) as oldest
from public.research_jobs where created_at > now()-interval '24 hours' group by status;
select status,count(*),min(created_at) as oldest
from public.slack_operations where created_at > now()-interval '24 hours' group by status;
select count(*) as expired_credentials from public.job_credentials where expires_at < now();
select count(*) as orphaned_previews from public.slack_operations
where not preview_removed and created_at < now()-interval '1 hour';
select count(*) as open_reports from public.reports r
join public.publications p on p.id=r.publication_id where not p.hidden;
