-- Phase 3: invalidate derived results on correction, and independently consent family context.
alter table public.record_versions add column superseded_at timestamptz;
with ordered as (
 select id,row_number() over(partition by record_id order by reviewed_at desc,id desc) n
 from public.record_versions
) update public.record_versions v set superseded_at=now() from ordered o where v.id=o.id and o.n>1;
create function public.mark_previous_versions() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 perform pg_advisory_xact_lock(hashtextextended(new.record_id::text,0));
 update public.record_versions set superseded_at=now() where record_id=new.record_id and superseded_at is null;
 new.superseded_at:=null;
 return new;
end $$;
create trigger supersede_previous_version before insert on public.record_versions for each row execute function public.mark_previous_versions();
revoke execute on function public.mark_previous_versions() from public,anon,authenticated;
create table public.family_invitations (
 id uuid primary key default gen_random_uuid(), inviter_id uuid not null references auth.users(id),
 invitee_id uuid not null references auth.users(id), relationship text not null check(relationship in ('mother','father','parent','child','sibling','half_sibling','grandparent','grandchild','aunt_uncle','niece_nephew','other')),
 basis text not null check(basis in ('biological','adoptive','social','unknown')),
 token_hash text not null, adult_attested boolean not null check(adult_attested),
 expires_at timestamptz not null, accepted_at timestamptz, revoked_at timestamptz,
 created_at timestamptz not null default now(),check(inviter_id<>invitee_id)
);
create table public.family_links (
 id uuid primary key default gen_random_uuid(), invitation_id uuid not null unique references public.family_invitations(id),
 inviter_id uuid not null references auth.users(id), invitee_id uuid not null references auth.users(id),
 relationship text not null,basis text not null, created_at timestamptz not null default now(),ended_at timestamptz
);
create unique index active_family_pair on public.family_links(least(inviter_id,invitee_id),greatest(inviter_id,invitee_id)) where ended_at is null;
create table public.family_assertions (
 id uuid primary key default gen_random_uuid(),owner_id uuid not null references auth.users(id),
 condition text not null check(length(condition) between 1 and 120), age_at_diagnosis int check(age_at_diagnosis between 0 and 120),
 source_kind text not null check(source_kind in ('self_reported','document_linked')),source_version_id uuid references public.record_versions(id),
 created_at timestamptz not null default now(),withdrawn_at timestamptz,
 check((source_kind='self_reported' and source_version_id is null) or (source_kind='document_linked' and source_version_id is not null))
);
create table public.family_assertion_shares (
 id uuid primary key default gen_random_uuid(),assertion_id uuid not null references public.family_assertions(id),
 owner_id uuid not null references auth.users(id),recipient_id uuid not null references auth.users(id),
 link_id uuid not null references public.family_links(id),purpose text not null check(length(purpose) between 5 and 200),
 expires_at timestamptz not null,revoked_at timestamptz,created_at timestamptz not null default now(),check(owner_id<>recipient_id)
);
create table public.reported_family_history (
 id uuid primary key default gen_random_uuid(),owner_id uuid not null references auth.users(id),
 relationship text not null check(relationship in ('mother','father','parent','child','sibling','half_sibling','grandparent','grandchild','aunt_uncle','niece_nephew','other')),
 basis text not null check(basis in ('biological','adoptive','social','unknown')),
 condition text not null check(length(condition) between 1 and 120),age_at_diagnosis int check(age_at_diagnosis between 0 and 120),
 created_at timestamptz not null default now(),withdrawn_at timestamptz
);
alter table public.family_invitations enable row level security;
alter table public.family_links enable row level security;
alter table public.family_assertions enable row level security;
alter table public.family_assertion_shares enable row level security;
alter table public.reported_family_history enable row level security;
create policy invitation_parties on public.family_invitations for select to authenticated using(auth.uid() in (inviter_id,invitee_id));
create policy link_parties on public.family_links for select to authenticated using(auth.uid() in (inviter_id,invitee_id));
create policy assertion_owner on public.family_assertions for select to authenticated using(auth.uid()=owner_id);
create policy share_parties on public.family_assertion_shares for select to authenticated using(auth.uid() in (owner_id,recipient_id));
create policy reported_owner on public.reported_family_history for select to authenticated using(auth.uid()=owner_id);
create index assertion_share_recipient on public.family_assertion_shares(recipient_id,expires_at);
create function public.create_family_invitation(p_invitee uuid,p_relationship text,p_basis text,p_adult boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v uuid; token text;
begin
 if auth.uid() is null or p_adult is distinct from true or p_invitee=auth.uid() or p_invitee is null then raise exception 'Named adult-relative invitation required';end if;
 if (select count(*) from public.family_invitations where inviter_id=auth.uid() and created_at>now()-interval '1 day')>=20 then raise exception 'Daily invitation limit';end if;
 token:=replace(gen_random_uuid()::text||gen_random_uuid()::text,'-','');
 insert into public.family_invitations(inviter_id,invitee_id,relationship,basis,token_hash,adult_attested,expires_at)
 values(auth.uid(),p_invitee,p_relationship,p_basis,encode(sha256(convert_to(token,'UTF8')),'hex'),true,now()+interval '24 hours') returning id into v;
 insert into public.audit_events(owner_id,actor_id,event,resource_id) values(auth.uid(),auth.uid(),'family_invitation_created',v);
 return jsonb_build_object('id',v,'token',token,'expires_in_hours',24);
end $$;
create function public.accept_family_invitation(p_id uuid,p_token text,p_adult boolean) returns uuid
language plpgsql security definer set search_path='' as $$
declare i public.family_invitations; v uuid;
begin
 select * into i from public.family_invitations where id=p_id for update;
 if not found or p_adult is distinct from true or auth.uid()<>i.invitee_id or i.accepted_at is not null or i.revoked_at is not null or i.expires_at<=now() or p_token is null or length(p_token)<>64 or i.token_hash<>encode(sha256(convert_to(p_token,'UTF8')),'hex') then raise exception 'Invitation unavailable';end if;
 insert into public.family_links(invitation_id,inviter_id,invitee_id,relationship,basis) values(i.id,i.inviter_id,i.invitee_id,i.relationship,i.basis) returning id into v;
 update public.family_invitations set accepted_at=now() where id=i.id;
 insert into public.audit_events(owner_id,actor_id,event,resource_id) values(i.inviter_id,auth.uid(),'family_link_accepted',v),(i.invitee_id,auth.uid(),'family_link_accepted',v);
 return v;
end $$;
create function public.revoke_family_invitation(p_id uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 update public.family_invitations set revoked_at=now() where id=p_id and inviter_id=auth.uid() and accepted_at is null and revoked_at is null;
 if not found then raise exception 'Owned pending invitation required';end if;
 insert into public.audit_events(owner_id,actor_id,event,resource_id) values(auth.uid(),auth.uid(),'family_invitation_revoked',p_id);
end $$;
create function public.end_family_link(p_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare l public.family_links;
begin
 update public.family_links set ended_at=now() where id=p_id and auth.uid() in (inviter_id,invitee_id) and ended_at is null returning * into l;
 if not found then raise exception 'Active relationship required';end if;
 insert into public.audit_events(owner_id,actor_id,event,resource_id) values(l.inviter_id,auth.uid(),'family_link_ended',p_id),(l.invitee_id,auth.uid(),'family_link_ended',p_id);
end $$;
create function public.add_family_assertion(p_condition text,p_age int,p_source uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare v uuid;
begin
 if auth.uid() is null or (p_source is not null and not exists(select 1 from public.record_versions where id=p_source and owner_id=auth.uid() and superseded_at is null)) then raise exception 'Own current source required';end if;
 insert into public.family_assertions(owner_id,condition,age_at_diagnosis,source_kind,source_version_id) values(auth.uid(),p_condition,p_age,case when p_source is null then 'self_reported' else 'document_linked' end,p_source) returning id into v;
 insert into public.audit_events(owner_id,actor_id,event,resource_id) values(auth.uid(),auth.uid(),'family_assertion_created',v);
 return v;
end $$;
create function public.withdraw_family_assertion(p_id uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 update public.family_assertions set withdrawn_at=now() where id=p_id and owner_id=auth.uid() and withdrawn_at is null;
 if not found then raise exception 'Own active assertion required';end if;
 insert into public.audit_events(owner_id,actor_id,event,resource_id) values(auth.uid(),auth.uid(),'family_assertion_withdrawn',p_id);
end $$;
create function public.share_family_assertion(p_assertion uuid,p_recipient uuid,p_purpose text,p_expiry timestamptz) returns uuid
language plpgsql security definer set search_path='' as $$
declare a public.family_assertions; l uuid; v uuid;
begin
 select * into a from public.family_assertions where id=p_assertion and owner_id=auth.uid() and withdrawn_at is null;
 if not found or p_expiry is null or p_expiry<=now() or p_expiry>now()+interval '30 days' or (a.source_version_id is not null and not exists(select 1 from public.record_versions where id=a.source_version_id and superseded_at is null)) then raise exception 'Own current assertion and valid expiry required';end if;
 select id into l from public.family_links where ended_at is null and ((inviter_id=auth.uid() and invitee_id=p_recipient) or (invitee_id=auth.uid() and inviter_id=p_recipient));
 if l is null then raise exception 'Accepted active relative required';end if;
 insert into public.family_assertion_shares(assertion_id,owner_id,recipient_id,link_id,purpose,expires_at) values(a.id,auth.uid(),p_recipient,l,p_purpose,p_expiry) returning id into v;
 insert into public.audit_events(owner_id,actor_id,event,resource_id) values(auth.uid(),auth.uid(),'family_assertion_shared',v);
 return v;
end $$;
create function public.revoke_family_share(p_id uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 update public.family_assertion_shares set revoked_at=now() where id=p_id and owner_id=auth.uid() and revoked_at is null;
 if not found then raise exception 'Own active share required';end if;
 insert into public.audit_events(owner_id,actor_id,event,resource_id) values(auth.uid(),auth.uid(),'family_share_revoked',p_id);
end $$;
create function public.visible_family_assertions() returns table(id uuid,owner_id uuid,condition text,age_at_diagnosis int,source_kind text,source_version_id uuid,created_at timestamptz)
language sql stable security definer set search_path='' as $$
 select a.id,a.owner_id,a.condition,a.age_at_diagnosis,a.source_kind,case when a.owner_id=auth.uid() then a.source_version_id else null end,a.created_at
 from public.family_assertions a where a.withdrawn_at is null
 and (a.source_version_id is null or exists(select 1 from public.record_versions v where v.id=a.source_version_id and v.superseded_at is null))
 and (a.owner_id=auth.uid() or exists(select 1 from public.family_assertion_shares s join public.family_links l on l.id=s.link_id where s.assertion_id=a.id and s.owner_id=a.owner_id and s.recipient_id=auth.uid() and s.revoked_at is null and s.expires_at>now() and l.ended_at is null))
$$;
create function public.add_reported_family_history(p_relationship text,p_basis text,p_condition text,p_age int) returns uuid
language plpgsql security definer set search_path='' as $$
declare v uuid;
begin
 if auth.uid() is null then raise exception 'Authentication required';end if;
 insert into public.reported_family_history(owner_id,relationship,basis,condition,age_at_diagnosis) values(auth.uid(),p_relationship,p_basis,p_condition,p_age) returning id into v;
 insert into public.audit_events(owner_id,actor_id,event,resource_id) values(auth.uid(),auth.uid(),'family_history_reported',v);
 return v;
end $$;
create function public.withdraw_reported_family_history(p_id uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 update public.reported_family_history set withdrawn_at=now() where id=p_id and owner_id=auth.uid() and withdrawn_at is null;
 if not found then raise exception 'Own active reported history required';end if;
 insert into public.audit_events(owner_id,actor_id,event,resource_id) values(auth.uid(),auth.uid(),'reported_family_history_withdrawn',p_id);
end $$;
revoke all on public.family_invitations,public.family_links,public.family_assertions,public.family_assertion_shares,public.reported_family_history from anon,authenticated;
grant select(id,inviter_id,invitee_id,relationship,basis,expires_at,accepted_at,revoked_at,created_at) on public.family_invitations to authenticated;
grant select on public.family_links,public.family_assertions,public.family_assertion_shares,public.reported_family_history to authenticated;
revoke execute on function public.create_family_invitation(uuid,text,text,boolean),public.accept_family_invitation(uuid,text,boolean),public.revoke_family_invitation(uuid),public.end_family_link(uuid),public.add_family_assertion(text,int,uuid),public.withdraw_family_assertion(uuid),public.share_family_assertion(uuid,uuid,text,timestamptz),public.revoke_family_share(uuid),public.visible_family_assertions(),public.add_reported_family_history(text,text,text,int),public.withdraw_reported_family_history(uuid) from public,anon;
grant execute on function public.create_family_invitation(uuid,text,text,boolean),public.accept_family_invitation(uuid,text,boolean),public.revoke_family_invitation(uuid),public.end_family_link(uuid),public.add_family_assertion(text,int,uuid),public.withdraw_family_assertion(uuid),public.share_family_assertion(uuid,uuid,text,timestamptz),public.revoke_family_share(uuid),public.visible_family_assertions(),public.add_reported_family_history(text,text,text,int),public.withdraw_reported_family_history(uuid) to authenticated;
