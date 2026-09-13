-- Run only in a dedicated restore target after restoring a database backup.
-- Confirms RLS remains enabled on every application table.
select relname,relrowsecurity from pg_class
where relnamespace='public'::regnamespace and relname in
('documents','user_settings','publications','share_links','reports','slack_installations','oauth_states','slack_operations','research_jobs','job_credentials');
select count(*) as documents, count(distinct owner_id) as owners from public.documents;
select count(*) as snapshots from public.publications;
select count(*) as snapshots from public.share_links;
-- No application credentials should be reused for outbound testing in the restore target.
-- Keep integrations disabled there and do not trigger any pending job.
