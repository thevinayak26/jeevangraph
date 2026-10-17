\set ON_ERROR_STOP on
begin;
create function public.test_assert(ok boolean,msg text) returns void language plpgsql as $$begin if ok is distinct from true then raise exception 'FAIL: %',msg;end if;raise notice 'PASS: %',msg;end$$;
create function public.test_denied(statement text,msg text) returns void language plpgsql as $$begin begin execute statement;exception when others then raise notice 'PASS: %',msg;return;end;raise exception 'FAIL: %',msg;end$$;
insert into auth.users values ('00000000-0000-4000-8000-000000000001'),('00000000-0000-4000-8000-000000000002'),('00000000-0000-4000-8000-000000000003'),('00000000-0000-4000-8000-000000000004'),('00000000-0000-4000-8000-000000000005');
insert into public.memberships(user_id,role,organization) values('00000000-0000-4000-8000-000000000002','doctor','Clinic A'),('00000000-0000-4000-8000-000000000004','facility','Hospital A'),('00000000-0000-4000-8000-000000000005','platform','Operations');
insert into storage.objects(bucket_id,name) values('health-records','00000000-0000-4000-8000-000000000001/10000000-0000-4000-8000-000000000001/source');
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
select public.create_draft('10000000-0000-4000-8000-000000000001',null,'Synthetic renal report','lab_report','2026-01-06','Hospital A','00000000-0000-4000-8000-000000000001/10000000-0000-4000-8000-000000000001/source','application/pdf');
select public.test_assert((select count(*)=1 from public.record_drafts),'owner sees draft');
select public.review_draft('10000000-0000-4000-8000-000000000001','{"notes":"Synthetic","observations":[]}'::jsonb) as version_id \gset
select public.test_denied($q$select public.review_draft('10000000-0000-4000-8000-000000000001','{"notes":"changed","observations":[]}')$q$,'review replay denied');
select public.test_denied($q$update public.record_versions set title='tampered'$q$,'immutable version update denied');
select public.test_denied($q$insert into public.memberships values(auth.uid(),'doctor','Self',true)$q$,'self role escalation denied');
select public.test_denied($q$select public.grant_records('00000000-0000-4000-8000-000000000003','Consultation',array['10000000-0000-4000-8000-000000000099']::uuid[],now()+interval '1 hour')$q$,'unverified recipient denied');
select public.test_denied($q$select public.grant_records('00000000-0000-4000-8000-000000000002','Consultation',array['10000000-0000-4000-8000-000000000099']::uuid[],now()+interval '1 hour')$q$,'foreign or missing version denied');
select public.grant_records('00000000-0000-4000-8000-000000000002','Consultation',array[:'version_id']::uuid[],now()+interval '1 hour') as grant_id \gset
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
select public.test_assert((select count(*)=1 from public.record_versions),'named doctor reads selected version');
select public.test_assert((select count(*)=0 from public.record_drafts),'doctor cannot see drafts');
select public.test_assert((select count(*)=0 from storage.objects),'doctor cannot mint storage links');
select public.test_assert(public.read_source(:'version_id') is not null,'doctor source request authorized');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000003',true);
select public.test_assert((select count(*)=0 from public.record_versions),'wrong patient cannot read');
select public.test_assert((select count(*)=0 from public.consent_grants),'wrong patient cannot see receipts');
select public.test_denied(format('select public.read_source(%L)',:'version_id'),'wrong patient source denied');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000005',true);
select public.test_assert((select count(*)=0 from public.record_versions),'platform admin has no chart access');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000004',true);
select public.test_assert((select count(*)=0 from public.record_versions),'facility has no chart access');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
select public.revoke_grant(:'grant_id');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
select public.test_assert((select count(*)=0 from public.record_versions),'revocation blocks subsequent reads');
select public.test_denied(format('select public.read_source(%L)',:'version_id'),'revocation blocks subsequent source delivery');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
select public.grant_records('00000000-0000-4000-8000-000000000002','Consultation',array[:'version_id']::uuid[],now()+interval '1 hour') as expiring_grant \gset
reset role;
update public.consent_grants set expires_at=now()-interval '1 second' where id=:'expiring_grant';
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
select public.test_assert((select count(*)=0 from public.record_versions),'expiry blocks reads');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
select public.authorize_ingestion('00000000-0000-4000-8000-000000000004','Hospital A',now()+interval '1 hour') as ticket_id \gset
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000003',true);
select public.test_denied(format('select public.ingest_simulated(%L,%L,%L,%L,%L)',:'ticket_id','20000000-0000-4000-8000-000000000001','Report','2026-03-17','{"notes":"test","observations":[]}'),'wrong facility ingestion denied');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000004',true);
select public.ingest_simulated(:'ticket_id','20000000-0000-4000-8000-000000000001','Report','2026-03-17','{"notes":"test","observations":[]}') as delivered_id \gset
select public.test_assert(public.ingest_simulated(:'ticket_id','20000000-0000-4000-8000-000000000001','Report','2026-03-17','{"notes":"test","observations":[]}')=:'delivered_id'::uuid,'same-key retry returns same receipt');
select public.test_denied(format('select public.ingest_simulated(%L,%L,%L,%L,%L)',:'ticket_id','20000000-0000-4000-8000-000000000001','Changed','2026-03-17','{"notes":"test","observations":[]}'),'changed replay rejected');
select public.test_assert((select count(*)=0 from public.record_drafts),'facility cannot read submitted patient draft');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
select public.test_assert((select count(*)=1 from public.record_drafts where status='pending'),'facility delivery awaits patient review');
select public.test_assert((select count(*)>0 from public.audit_events),'patient sees audit history');
reset role;
set local role anon;
select public.test_denied('select * from public.record_versions','anonymous record access denied');
select public.test_denied('select public.read_source(gen_random_uuid())','anonymous RPC access denied');
rollback;
