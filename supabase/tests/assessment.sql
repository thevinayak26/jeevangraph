\set ON_ERROR_STOP on
begin;
create function public.test_assessment(ok boolean,msg text) returns void language plpgsql as $$begin if ok is distinct from true then raise exception 'FAIL: %',msg;end if;end$$;
insert into auth.users values('80000000-0000-4000-8000-000000000001'),('80000000-0000-4000-8000-000000000002');
set local role authenticated;
select set_config('request.jwt.claim.sub','80000000-0000-4000-8000-000000000001',true);
select public.save_welcome_assessment('{"schema_version":1,"region":"undisclosed","environment":"unknown","allergies":["unknown"],"conditions":["unknown"],"exposure":"unknown","family_condition":"unknown","relationship":"unknown","basis":"unknown","age_at_diagnosis":null}');
select public.test_assessment((select count(*)=1 from public.welcome_assessments),'owner can read own answers');
select set_config('request.jwt.claim.sub','80000000-0000-4000-8000-000000000002',true);
select public.test_assessment((select count(*)=0 from public.welcome_assessments),'another account cannot read questionnaire');
select public.clear_welcome_assessment();
select set_config('request.jwt.claim.sub','80000000-0000-4000-8000-000000000001',true);
select public.test_assessment((select count(*)=1 from public.welcome_assessments),'another account cannot clear owner answers');
select public.save_welcome_assessment(null);
select public.test_assessment((select status='skipped' and answers is null from public.welcome_assessments),'skip clears previous health answers');
select public.clear_welcome_assessment();
select public.test_assessment((select count(*)=0 from public.welcome_assessments),'owner can clear answers');
-- Permission denials and malformed direct RPC bypass attempts must fail.
do $$begin
 begin perform public.save_welcome_assessment('{"schema_version":1,"region":null,"environment":"unknown","allergies":["unknown"],"conditions":["unknown"],"exposure":"unknown","family_condition":"unknown","relationship":"unknown","basis":"unknown","age_at_diagnosis":null}');raise exception 'UNEXPECTED';exception when others then if sqlerrm='UNEXPECTED' then raise;end if;end;
 begin insert into public.welcome_assessments(owner_id,status) values(auth.uid(),'skipped');raise exception 'UNEXPECTED';exception when insufficient_privilege then null;end;
end$$;
set local role anon;
do $$begin
 begin perform public.save_welcome_assessment(null);raise exception 'UNEXPECTED';exception when insufficient_privilege then null;end;
end$$;
rollback;
