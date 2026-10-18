-- Optional, owner-only, patient-reported onboarding context. No relative access or clinical scoring.
create table public.welcome_assessments (
 owner_id uuid primary key references auth.users(id) on delete cascade,
 status text not null check(status in ('completed','skipped')),
 answers jsonb,
 updated_at timestamptz not null default now(),
 check((status='skipped' and answers is null) or (status='completed' and jsonb_typeof(answers)='object'))
);
alter table public.welcome_assessments enable row level security;
create policy welcome_owner_read on public.welcome_assessments for select to authenticated using(owner_id=auth.uid());
revoke all on public.welcome_assessments from public,anon,authenticated;
grant select on public.welcome_assessments to authenticated;
revoke all on public.welcome_assessments from anon;
create function public.save_welcome_assessment(p_answers jsonb default null) returns void
language plpgsql security definer set search_path='' as $$
declare k text; a jsonb;
begin
 if auth.uid() is null then raise exception 'Authentication required';end if;
 if p_answers is not null then
  if jsonb_typeof(p_answers) <> 'object' or octet_length(p_answers::text)>4096 then raise exception 'Invalid answers';end if;
  if (select count(*) from jsonb_object_keys(p_answers))<>10 or not(p_answers ?& array['region','environment','allergies','conditions','exposure','family_condition','relationship','basis','age_at_diagnosis','schema_version']) then raise exception 'Invalid answer keys';end if;
  for k in select unnest(array['region','environment','exposure','family_condition','relationship','basis']) loop
   if jsonb_typeof(p_answers->k) is distinct from 'string' then raise exception 'Invalid choice type';end if;
  end loop;
  if p_answers->'schema_version' is distinct from '1'::jsonb then raise exception 'Invalid schema version';end if;
  if p_answers->>'schema_version'<>'1' or not(p_answers->>'region'=any(array['undisclosed','north_india','south_india','east_india','west_india','central_india','northeast_india','outside_india'])) or not(p_answers->>'environment'=any(array['unknown','urban','rural','coastal','hilly'])) or not(p_answers->>'exposure'=any(array['unknown','none','dust_smoke','mosquitoes','both'])) or not(p_answers->>'family_condition'=any(array['unknown','none_known','diabetes','hypertension','breast_cancer','other'])) or not(p_answers->>'relationship'=any(array['unknown','parent','sibling','grandparent','aunt_uncle'])) or not(p_answers->>'basis'=any(array['unknown','biological','adoptive','social'])) then raise exception 'Invalid choice';end if;
  for k in select unnest(array['allergies','conditions']) loop
   a:=p_answers->k;
   if jsonb_typeof(a)<>'array' or jsonb_array_length(a) not between 1 and 7 then raise exception 'Invalid selections';end if;
   if exists(select 1 from jsonb_array_elements(a) v where jsonb_typeof(v) is distinct from 'string') then raise exception 'Invalid selection type';end if;
   if exists(select 1 from jsonb_array_elements_text(a) v where not(v=any(case when k='allergies' then array['none_known','unknown','medicine','food','dust_pollen','insect','other'] else array['none_known','unknown','diabetes','hypertension','asthma','kidney_condition','other'] end))) then raise exception 'Invalid selection';end if;
   if (select count(distinct v) from jsonb_array_elements_text(a) v)<>jsonb_array_length(a) or (jsonb_array_length(a)>1 and (a ?| array['none_known','unknown'])) then raise exception 'Conflicting selections';end if;
  end loop;
  if p_answers->>'family_condition' not in ('none_known','unknown') and p_answers->>'relationship'='unknown' then raise exception 'Relationship required';end if;
  if p_answers->'age_at_diagnosis'<>'null'::jsonb and (jsonb_typeof(p_answers->'age_at_diagnosis')<>'number' or (p_answers->>'age_at_diagnosis') !~ '^[0-9]{1,3}$' or (p_answers->>'age_at_diagnosis')::int>120) then raise exception 'Invalid age';end if;
 end if;
 insert into public.welcome_assessments(owner_id,status,answers) values(auth.uid(),case when p_answers is null then 'skipped' else 'completed' end,p_answers)
 on conflict(owner_id) do update set status=excluded.status,answers=excluded.answers,updated_at=now();
end $$;
revoke all on function public.save_welcome_assessment(jsonb) from public,anon;
grant execute on function public.save_welcome_assessment(jsonb) to authenticated;
create function public.clear_welcome_assessment() returns void language sql security definer set search_path='' as $$delete from public.welcome_assessments where owner_id=auth.uid()$$;
revoke all on function public.clear_welcome_assessment() from public,anon;
grant execute on function public.clear_welcome_assessment() to authenticated;
