-- Replace placeholders before running. Do not commit the real dispatch secret.
select cron.schedule(
  'ours-push-dispatch',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/ours-push-dispatch',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer REPLACE_WITH_OURS_PUSH_DISPATCH_SECRET'
    ),
    body := '{}'::jsonb
  );
  $$
);
