create or replace function public.get_storage_bucket_usage(bucket_name text)
returns bigint
language sql
security definer
set search_path = public, storage
as $$
  select coalesce(sum((metadata->>'size')::bigint), 0)::bigint
  from storage.objects
  where bucket_id = bucket_name;
$$;

revoke all on function public.get_storage_bucket_usage(text) from public;
grant execute on function public.get_storage_bucket_usage(text) to service_role;
