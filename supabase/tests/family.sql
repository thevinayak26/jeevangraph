\set ON_ERROR_STOP on
begin;
create function public.test_assert(ok boolean,msg text) returns void language plpgsql as $$begin if ok is distinct from true then raise exception 'FAIL: %',msg;end if;raise notice 'PASS: %',msg;end$$;
create function public.test_denied(statement text,msg text) returns void language plpgsql as $$begin begin execute statement;exception when others then raise notice 'PASS: %',msg;return;end;raise exception 'FAIL: %',msg;end$$;
insert into auth.users values('30000000-0000-4000-8000-000000000001'),('30000000-0000-4000-8000-000000000002'),('30000000-0000-4000-8000-000000000003'),('30000000-0000-4000-8000-000000000004');
insert into public.memberships(user_id,role,organization) values('30000000-0000-4000-8000-000000000004','doctor','Synthetic clinic');
insert into storage.objects(bucket_id,name) values('health-records','30000000-0000-4000-8000-000000000002/40000000-0000-4000-8000-000000000001/source'),('health-records','30000000-0000-4000-8000-000000000002/40000000-0000-4000-8000-000000000002/source');
set local role authenticated;
select set_config('request.jwt.claim.sub','30000000-0000-4000-8000-000000000002',true);
select public.add_family_assertion('Type 2 diabetes',48,null) as assertion_id \gset
select public.create_draft('40000000-0000-4000-8000-000000000001',null,'Synthetic source','lab_report','2026-01-06','Synthetic clinic','30000000-0000-4000-8000-000000000002/40000000-0000-4000-8000-000000000001/source','application/pdf');
select public.review_draft('40000000-0000-4000-8000-000000000001','{"notes":"Synthetic","observations":[]}') as source_id \gset
select public.add_family_assertion('Synthetic renal follow-up',null,:'source_id') as documented_id \gset
select public.grant_records('30000000-0000-4000-8000-000000000004','Read-only consultation',array[:'source_id']::uuid[],now()+interval '1 hour') as read_grant \gset
select set_config('request.jwt.claim.sub','30000000-0000-4000-8000-000000000004',true);
select public.test_assert((select count(*)=1 from public.record_versions),'read grant preserves original record access');
select public.test_assert((select count(*)=0 from public.authorized_analysis_versions()),'read grant does not authorize analysis');
select set_config('request.jwt.claim.sub','30000000-0000-4000-8000-000000000002',true);
select public.grant_records_with_analysis('30000000-0000-4000-8000-000000000004','Explicit numerical analysis',array[:'source_id']::uuid[],now()+interval '1 hour') as analysis_grant \gset
select set_config('request.jwt.claim.sub','30000000-0000-4000-8000-000000000004',true);
select public.test_assert((select count(*)=1 from public.authorized_analysis_versions()),'separate analysis grant enables authorized projection');
select set_config('request.jwt.claim.sub','30000000-0000-4000-8000-000000000002',true);
select public.revoke_grant(:'analysis_grant');
select set_config('request.jwt.claim.sub','30000000-0000-4000-8000-000000000004',true);
select public.test_assert((select count(*)=0 from public.authorized_analysis_versions()),'revoked analysis grant cannot fall back to read-only analysis');
select public.test_assert((select count(*)=1 from public.record_versions),'independent read grant remains valid');
select set_config('request.jwt.claim.sub','30000000-0000-4000-8000-000000000002',true);

select set_config('request.jwt.claim.sub','30000000-0000-4000-8000-000000000001',true);
select public.test_assert((select count(*)=0 from public.visible_family_assertions()),'unlinked assertions stay private');
select public.create_family_invitation('30000000-0000-4000-8000-000000000002','father','biological',true) as invitation \gset
select (:'invitation'::jsonb->>'id') as invite_id, (:'invitation'::jsonb->>'token') as invite_token \gset
select public.test_denied('select token_hash from public.family_invitations','invitation token hashes not exposed to clients');
select set_config('request.jwt.claim.sub','30000000-0000-4000-8000-000000000003',true);
select public.test_denied(format('select public.accept_family_invitation(%L,%L,true)',:'invite_id',:'invite_token'),'one-time secret cannot be used by wrong account');
select public.test_assert((select count(*)=0 from public.family_invitations),'unrelated account cannot enumerate invitations');
select set_config('request.jwt.claim.sub','30000000-0000-4000-8000-000000000002',true);
select public.test_denied(format('select public.accept_family_invitation(%L,%L,false)',:'invite_id',:'invite_token'),'adult attestation required');
select public.test_denied(format('select public.accept_family_invitation(%L,%L,true)',:'invite_id',repeat('a',64)),'wrong secret rejected');
select public.accept_family_invitation(:'invite_id',:'invite_token',true) as link_id \gset
select public.test_denied(format('select public.accept_family_invitation(%L,%L,true)',:'invite_id',:'invite_token'),'accepted invitation cannot be replayed');
select set_config('request.jwt.claim.sub','30000000-0000-4000-8000-000000000001',true);
select public.test_assert((select count(*)=0 from public.visible_family_assertions()),'relationship acceptance grants no condition access');
select public.test_assert((select count(*)=0 from public.record_versions),'relationship acceptance grants no report access');
select set_config('request.jwt.claim.sub','30000000-0000-4000-8000-000000000002',true);
select public.share_family_assertion(:'assertion_id','30000000-0000-4000-8000-000000000001','Family history discussion',now()+interval '1 hour') as share_id \gset
select public.share_family_assertion(:'documented_id','30000000-0000-4000-8000-000000000001','Family history discussion',now()+interval '1 hour') as document_share \gset
select set_config('request.jwt.claim.sub','30000000-0000-4000-8000-000000000001',true);
select public.test_assert((select count(*)=2 from public.visible_family_assertions()),'only explicitly shared assertions become visible');
select public.test_assert((select source_version_id is null from public.visible_family_assertions() where id=:'documented_id'),'relative supporting source UUID is withheld');
select public.test_assert((select count(*)=0 from public.family_assertions),'raw assertion table remains owner-only');
select public.test_denied(format('select public.share_family_assertion(%L,%L,%L,now()+interval ''1 hour'')',:'assertion_id','30000000-0000-4000-8000-000000000004','Onward sharing'),'recipient cannot onward-share another relative assertion');
select public.test_denied(format('select public.read_source(%L)',:'source_id'),'sharing a condition does not share original source');
select public.add_reported_family_history('mother','adoptive','Breast cancer',44) as reported_id \gset
select set_config('request.jwt.claim.sub','30000000-0000-4000-8000-000000000004',true);
select public.test_assert((select count(*)=0 from public.visible_family_assertions()),'doctor membership does not expose family assertions');
select public.test_assert((select count(*)=0 from public.reported_family_history),'doctor membership does not expose patient-reported family history');
select set_config('request.jwt.claim.sub','30000000-0000-4000-8000-000000000002',true);
select public.revoke_family_share(:'share_id');
select set_config('request.jwt.claim.sub','30000000-0000-4000-8000-000000000001',true);
select public.test_assert((select count(*)=0 from public.visible_family_assertions() where id=:'assertion_id'),'independent revocation removes relative condition');
select set_config('request.jwt.claim.sub','30000000-0000-4000-8000-000000000002',true);
select record_id from public.record_versions where id=:'source_id' \gset
select public.create_draft('40000000-0000-4000-8000-000000000002',:'record_id','Corrected synthetic source','lab_report','2026-01-06','Synthetic clinic','30000000-0000-4000-8000-000000000002/40000000-0000-4000-8000-000000000002/source','application/pdf');
select public.review_draft('40000000-0000-4000-8000-000000000002','{"notes":"Corrected synthetic","observations":[]}');
select public.test_assert((select superseded_at is not null from public.record_versions where id=:'source_id'),'source correction supersedes previous immutable version');
select set_config('request.jwt.claim.sub','30000000-0000-4000-8000-000000000001',true);
select public.test_assert((select count(*)=0 from public.visible_family_assertions()),'source correction invalidates document-linked relative assertion');
select public.end_family_link(:'link_id');
select set_config('request.jwt.claim.sub','30000000-0000-4000-8000-000000000002',true);
select public.test_denied(format('select public.share_family_assertion(%L,%L,%L,now()+interval ''1 hour'')',:'assertion_id','30000000-0000-4000-8000-000000000001','Family history discussion'),'ended relationship cannot receive new shares');
reset role;
set local role anon;
select public.test_denied('select * from public.family_assertions','anonymous family table access denied');
select public.test_denied('select * from public.visible_family_assertions()','anonymous family projection denied');
rollback;
