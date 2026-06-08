-- Backward-compatible storage policies for screenshots uploaded by earlier app versions.
-- Old path format: screenshots/{auth.uid()}/{filename}
-- New path format: {auth.uid()}/screenshots/{filename}

create policy "trade_screenshots_legacy_select_own"
  on storage.objects for select
  using (bucket_id = 'trade-screenshots' and auth.uid()::text = (storage.foldername(name))[2]);

create policy "trade_screenshots_legacy_insert_own"
  on storage.objects for insert
  with check (bucket_id = 'trade-screenshots' and auth.uid()::text = (storage.foldername(name))[2]);

create policy "trade_screenshots_legacy_update_own"
  on storage.objects for update
  using (bucket_id = 'trade-screenshots' and auth.uid()::text = (storage.foldername(name))[2])
  with check (bucket_id = 'trade-screenshots' and auth.uid()::text = (storage.foldername(name))[2]);

create policy "trade_screenshots_legacy_delete_own"
  on storage.objects for delete
  using (bucket_id = 'trade-screenshots' and auth.uid()::text = (storage.foldername(name))[2]);
