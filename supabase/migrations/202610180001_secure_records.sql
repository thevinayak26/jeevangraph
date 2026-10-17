-- Apply once to a Supabase project. All application calls use the user's JWT.
create table public.memberships (
 user_id uuid not null references auth.users(id) on delete cascade,
 role text not null check(role in ('doctor','facility','platform')),
 organization text not null, active boolean not null default true,
 primary key(user_id,role,organization)
);
alter table public.memberships enable row level security;
create policy membership_self on public.memberships for select to authenticated using(user_id=auth.uid());
create table public.record_drafts (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id),
 created_by uuid not null references auth.users(id), record_id uuid not null default gen_random_uuid(),
 title text not null check(length(title) between 1 and 160), kind text not null,
 clinical_date date, facility text not null check(length(facility) between 1 and 160),
 object_path text unique, media_type text, extracted jsonb not null default '{}',
 status text not null default 'pending' check(status in ('pending','reviewed')),
 created_at timestamptz not null default now()
);
create table public.record_versions (
 id uuid primary key default gen_random_uuid(), record_id uuid not null,
 draft_id uuid not null unique references public.record_drafts(id), owner_id uuid not null references auth.users(id),
 title text not null, kind text not null, clinical_date date, facility text not null,
 object_path text, media_type text, content jsonb not null,
 reviewed_at timestamptz not null default now()
);
create table public.consent_grants (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id),
 recipient_id uuid not null references auth.users(id), purpose text not null check(length(purpose) between 5 and 200),
 action text not null default 'read' check(action='read'), version_ids uuid[] not null check(cardinality(version_ids) between 1 and 50),
 expires_at timestamptz not null, revoked_at timestamptz, created_at timestamptz not null default now(),
 check(owner_id<>recipient_id)
);
create table public.ingestion_tickets (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id),
 facility_user uuid not null references auth.users(id), organization text not null,
 expires_at timestamptz not null, used_at timestamptz, revoked_at timestamptz,
 created_at timestamptz not null default now()
);
create table public.ingestion_receipts (
 ticket_id uuid primary key references public.ingestion_tickets(id), request_key uuid not null,
 payload_hash text not null, draft_id uuid not null references public.record_drafts(id)
);
create table public.audit_events (
 id bigint generated always as identity primary key, owner_id uuid not null references auth.users(id),
 actor_id uuid not null references auth.users(id), event text not null,
 resource_id uuid not null, created_at timestamptz not null default now()
);
create index grant_recipient_idx on public.consent_grants(recipient_id,expires_at);
create index versions_owner_idx on public.record_versions(owner_id);
create index drafts_owner_idx on public.record_drafts(owner_id);
alter table public.record_drafts enable row level security;
alter table public.record_versions enable row level security;
alter table public.consent_grants enable row level security;
alter table public.ingestion_tickets enable row level security;
alter table public.ingestion_receipts enable row level security;
alter table public.audit_events enable row level security;
create function public.can_read_version(v uuid, p uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid()=p or exists(select 1 from public.consent_grants g
 where g.owner_id=p and g.recipient_id=auth.uid() and v=any(g.version_ids)
 and g.revoked_at is null and g.expires_at>now() and g.action='read'
 and exists(select 1 from public.memberships m where m.user_id=auth.uid() and m.role='doctor' and m.active))
$$;
create policy draft_owner on public.record_drafts for select to authenticated using(owner_id=auth.uid());
create policy version_access on public.record_versions for select to authenticated using(public.can_read_version(id,owner_id));
create policy grant_parties on public.consent_grants for select to authenticated using(owner_id=auth.uid() or recipient_id=auth.uid());
create policy ticket_owner on public.ingestion_tickets for select to authenticated using(owner_id=auth.uid());
create policy audit_owner on public.audit_events for select to authenticated using(owner_id=auth.uid());
-- No direct client mutation policies. Narrow RPCs validate identity, membership and state.
create function public.create_draft(p_id uuid,p_record uuid,p_title text,p_kind text,p_date date,p_facility text,p_path text,p_media text)
returns uuid language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 if p_kind not in ('lab_report','prescription','imaging_report','immunization','other') then raise exception 'Invalid kind'; end if;
 if p_path <> auth.uid()::text||'/'||p_id::text||'/source' or p_media not in ('application/pdf','image/png','image/jpeg') then raise exception 'Invalid source'; end if;
 if not exists(select 1 from storage.objects where bucket_id='health-records' and name=p_path) then raise exception 'Source missing'; end if;
 if p_record is not null and not exists(select 1 from public.record_versions where record_id=p_record and owner_id=auth.uid()) then raise exception 'Record not owned'; end if;
 insert into public.record_drafts(id,owner_id,created_by,record_id,title,kind,clinical_date,facility,object_path,media_type)
 values(p_id,auth.uid(),auth.uid(),coalesce(p_record,gen_random_uuid()),p_title,p_kind,p_date,p_facility,p_path,p_media);
 insert into public.audit_events(owner_id,actor_id,event,resource_id) values(auth.uid(),auth.uid(),'draft_created',p_id);
 return p_id;
end $$;
create function public.valid_review_content(c jsonb) returns boolean
language plpgsql immutable set search_path='' as $$
declare o jsonb;
begin
 if jsonb_typeof(c) is distinct from 'object' or length(c::text)>50000 or jsonb_typeof(c->'notes') is distinct from 'string' or length(c->>'notes')>10000 or jsonb_typeof(c->'observations') is distinct from 'array' then return false; end if;
 if jsonb_array_length(c->'observations')>100 then return false; end if;
 for o in select value from jsonb_array_elements(c->'observations') loop
  if jsonb_typeof(o) is distinct from 'object' or jsonb_typeof(o->'label') is distinct from 'string' or length(o->>'label') not between 1 and 100 or jsonb_typeof(o->'value') is distinct from 'string' or length(o->>'value') not between 1 and 100 or jsonb_typeof(o->'unit') is distinct from 'string' or length(o->>'unit')>60 or jsonb_typeof(o->'sourceExcerpt') is distinct from 'string' or length(o->>'sourceExcerpt') not between 1 and 1000 or jsonb_typeof(o->'sourcePage') is distinct from 'number' then return false; end if;
  if (o->>'sourcePage') !~ '^[0-9]{1,4}$' or (o->>'sourcePage')::int not between 1 and 9999 then return false; end if;
 end loop;
 return true;
end $$;
revoke execute on function public.valid_review_content(jsonb) from public,anon,authenticated;
create function public.review_draft(p_id uuid,p_content jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare d public.record_drafts; v uuid;
begin
 select * into d from public.record_drafts where id=p_id and owner_id=auth.uid() for update;
 if not found or d.status<>'pending' then raise exception 'Pending owned draft required'; end if;
 if not public.valid_review_content(p_content) then raise exception 'Invalid reviewed content'; end if;
 insert into public.record_versions(record_id,draft_id,owner_id,title,kind,clinical_date,facility,object_path,media_type,content)
 values(d.record_id,d.id,d.owner_id,d.title,d.kind,d.clinical_date,d.facility,d.object_path,d.media_type,p_content) returning id into v;
 update public.record_drafts set status='reviewed' where id=d.id;
 insert into public.audit_events(owner_id,actor_id,event,resource_id) values(d.owner_id,auth.uid(),'version_reviewed',v);
 return v;
end $$;
create function public.grant_records(p_recipient uuid,p_purpose text,p_versions uuid[],p_expiry timestamptz) returns uuid
language plpgsql security definer set search_path='' as $$
declare v uuid;
begin
 if auth.uid() is null or p_recipient=auth.uid() or p_expiry is null or p_expiry<=now() or p_expiry>now()+interval '30 days' then raise exception 'Invalid recipient or expiry'; end if;
 if not exists(select 1 from public.memberships where user_id=p_recipient and role='doctor' and active) then raise exception 'Verified doctor required'; end if;
 if p_versions is null or cardinality(p_versions)=0 or exists(select 1 from unnest(p_versions) x where x is null or not exists(select 1 from public.record_versions r where r.id=x and r.owner_id=auth.uid())) then raise exception 'Owned versions required'; end if;
 insert into public.consent_grants(owner_id,recipient_id,purpose,version_ids,expires_at) values(auth.uid(),p_recipient,p_purpose,p_versions,p_expiry) returning id into v;
 insert into public.audit_events(owner_id,actor_id,event,resource_id) values(auth.uid(),auth.uid(),'consent_granted',v);
 return v;
end $$;
create function public.revoke_grant(p_id uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 update public.consent_grants set revoked_at=now() where id=p_id and owner_id=auth.uid() and revoked_at is null;
 if not found then raise exception 'Active owned grant required'; end if;
 insert into public.audit_events(owner_id,actor_id,event,resource_id) values(auth.uid(),auth.uid(),'consent_revoked',p_id);
end $$;
create function public.authorize_ingestion(p_facility uuid,p_org text,p_expiry timestamptz) returns uuid
language plpgsql security definer set search_path='' as $$
declare v uuid;
begin
 if auth.uid() is null or p_expiry is null or p_expiry<=now() or p_expiry>now()+interval '24 hours' or not exists(select 1 from public.memberships where user_id=p_facility and role='facility' and organization=p_org and active) then raise exception 'Invalid facility authorization'; end if;
 insert into public.ingestion_tickets(owner_id,facility_user,organization,expires_at) values(auth.uid(),p_facility,p_org,p_expiry) returning id into v;
 insert into public.audit_events(owner_id,actor_id,event,resource_id) values(auth.uid(),auth.uid(),'ingestion_authorized',v);
 return v;
end $$;
create function public.revoke_ingestion(p_id uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 update public.ingestion_tickets set revoked_at=now() where id=p_id and owner_id=auth.uid() and used_at is null and revoked_at is null;
 if not found then raise exception 'Unused owned ticket required'; end if;
 insert into public.audit_events(owner_id,actor_id,event,resource_id) values(auth.uid(),auth.uid(),'ingestion_revoked',p_id);
end $$;
create function public.ingest_simulated(p_ticket uuid,p_key uuid,p_title text,p_date date,p_content jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare t public.ingestion_tickets; r public.ingestion_receipts; d uuid; h text;
begin
 select * into t from public.ingestion_tickets where id=p_ticket for update;
 if not found or t.facility_user<>auth.uid() or t.revoked_at is not null or t.expires_at<=now() or not exists(select 1 from public.memberships where user_id=auth.uid() and role='facility' and organization=t.organization and active) then raise exception 'Active named facility authorization required'; end if;
 h:=encode(sha256(convert_to(jsonb_build_object('title',p_title,'date',p_date,'content',p_content)::text,'UTF8')),'hex');
 select * into r from public.ingestion_receipts where ticket_id=p_ticket;
 if found then
  if r.request_key=p_key and r.payload_hash=h then return r.draft_id; end if;
  raise exception 'Ticket already used or replay payload differs';
 end if;
 if p_key is null or not public.valid_review_content(p_content) then raise exception 'Invalid simulated payload'; end if;
 insert into public.record_drafts(owner_id,created_by,title,kind,clinical_date,facility,extracted)
 values(t.owner_id,auth.uid(),p_title,'lab_report',p_date,t.organization,p_content) returning id into d;
 insert into public.ingestion_receipts values(p_ticket,p_key,h,d);
 update public.ingestion_tickets set used_at=now() where id=p_ticket;
 insert into public.audit_events(owner_id,actor_id,event,resource_id) values(t.owner_id,auth.uid(),'simulated_ingestion',d);
 return d;
end $$;
create function public.read_source(p_version uuid) returns text
language plpgsql security definer set search_path='' as $$
declare v public.record_versions;
begin
 select * into v from public.record_versions where id=p_version;
 if not found or not public.can_read_version(v.id,v.owner_id) then raise exception 'Source access denied'; end if;
 insert into public.audit_events(owner_id,actor_id,event,resource_id) values(v.owner_id,auth.uid(),'source_requested',v.id);
 return v.object_path;
end $$;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('health-records','health-records',false,5242880,array['application/pdf','image/png','image/jpeg']);
create policy source_upload on storage.objects for insert to authenticated with check(
 bucket_id='health-records' and (storage.foldername(name))[1]=auth.uid()::text
 and name ~ ('^'||auth.uid()::text||'/[0-9a-f-]{36}/source$')
);
create policy source_read on storage.objects for select to authenticated using(
 bucket_id='health-records' and ((storage.foldername(name))[1]=auth.uid()::text
 -- Doctor file access goes through the consent-checked server route; no signed URLs.
)
);
-- Explicitly deny untrusted table writes even if defaults change.
revoke all on public.memberships,public.record_drafts,public.record_versions,public.consent_grants,public.ingestion_tickets,public.ingestion_receipts,public.audit_events from anon,authenticated;
grant select on public.memberships,public.record_drafts,public.record_versions,public.consent_grants,public.ingestion_tickets,public.audit_events to authenticated;
revoke execute on function public.can_read_version(uuid,uuid), public.create_draft(uuid,uuid,text,text,date,text,text,text),public.review_draft(uuid,jsonb),public.grant_records(uuid,text,uuid[],timestamptz),public.revoke_grant(uuid),public.authorize_ingestion(uuid,text,timestamptz),public.revoke_ingestion(uuid),public.ingest_simulated(uuid,uuid,text,date,jsonb),public.read_source(uuid) from public,anon;
grant execute on function public.can_read_version(uuid,uuid), public.create_draft(uuid,uuid,text,text,date,text,text,text),public.review_draft(uuid,jsonb),public.grant_records(uuid,text,uuid[],timestamptz),public.revoke_grant(uuid),public.authorize_ingestion(uuid,text,timestamptz),public.revoke_ingestion(uuid),public.ingest_simulated(uuid,uuid,text,date,jsonb),public.read_source(uuid) to authenticated;

create function public.read_draft_source(p_draft uuid) returns text
language plpgsql security definer set search_path='' as $$
declare d public.record_drafts;
begin
 select * into d from public.record_drafts where id=p_draft and owner_id=auth.uid();
 if not found then raise exception 'Owned draft required'; end if;
 insert into public.audit_events(owner_id,actor_id,event,resource_id) values(d.owner_id,auth.uid(),'draft_source_requested',d.id);
 return d.object_path;
end $$;
revoke execute on function public.read_draft_source(uuid) from public,anon;
grant execute on function public.read_draft_source(uuid) to authenticated;

create policy orphan_source_cleanup on storage.objects for delete to authenticated using(
 bucket_id='health-records' and (storage.foldername(name))[1]=auth.uid()::text
 and not exists(select 1 from public.record_drafts d where d.object_path=name)
);
