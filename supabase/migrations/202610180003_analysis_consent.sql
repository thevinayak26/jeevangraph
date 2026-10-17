-- Existing read grants never silently expand to authorize derived numerical analysis.
alter table public.consent_grants drop constraint consent_grants_action_check;
alter table public.consent_grants add constraint consent_grants_action_check check(action in ('read','read_analyze'));
create or replace function public.can_read_version(v uuid,p uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid()=p or exists(select 1 from public.consent_grants g
 where g.owner_id=p and g.recipient_id=auth.uid() and v=any(g.version_ids)
 and g.revoked_at is null and g.expires_at>now() and g.action in ('read','read_analyze')
 and exists(select 1 from public.memberships m where m.user_id=auth.uid() and m.role='doctor' and m.active))
$$;
create function public.can_analyze_version(v uuid,p uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid()=p or exists(select 1 from public.consent_grants g
 where g.owner_id=p and g.recipient_id=auth.uid() and v=any(g.version_ids)
 and g.revoked_at is null and g.expires_at>now() and g.action='read_analyze'
 and exists(select 1 from public.memberships m where m.user_id=auth.uid() and m.role='doctor' and m.active))
$$;
create function public.grant_records_with_analysis(p_recipient uuid,p_purpose text,p_versions uuid[],p_expiry timestamptz) returns uuid
language plpgsql security definer set search_path='' as $$
declare v uuid;
begin
 v:=public.grant_records(p_recipient,p_purpose,p_versions,p_expiry);
 update public.consent_grants set action='read_analyze' where id=v;
 insert into public.audit_events(owner_id,actor_id,event,resource_id) values(auth.uid(),auth.uid(),'numerical_analysis_authorized',v);
 return v;
end $$;
create function public.authorized_analysis_versions() returns setof public.record_versions
language sql stable security definer set search_path='' as $$
 select v.* from public.record_versions v where auth.uid() is not null and public.can_analyze_version(v.id,v.owner_id)
 order by v.reviewed_at desc,v.id limit 500
$$;
revoke execute on function public.can_analyze_version(uuid,uuid) from public,anon,authenticated;
revoke execute on function public.grant_records_with_analysis(uuid,text,uuid[],timestamptz),public.authorized_analysis_versions() from public,anon;
grant execute on function public.grant_records_with_analysis(uuid,text,uuid[],timestamptz),public.authorized_analysis_versions() to authenticated;
