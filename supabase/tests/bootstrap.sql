-- Minimal PostgreSQL harness, not a substitute for hosted Supabase Auth/Storage tests.
create role anon nologin;
create role authenticated nologin;
create schema auth;
create schema storage;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql immutable as $$select (string_to_array(name,'/'))[1:array_length(string_to_array(name,'/'),1)-1]$$;
grant usage on schema auth,storage,public to anon,authenticated;
grant select,insert on storage.objects to authenticated;
grant execute on function auth.uid(),storage.foldername(text) to authenticated,anon;
