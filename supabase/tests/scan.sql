\set ON_ERROR_STOP on
begin;
create function public.scan_assert(ok boolean,msg text) returns void language plpgsql as $$begin if ok is distinct from true then raise exception 'FAIL: %',msg;end if;end$$;
insert into auth.users values('90000000-0000-4000-8000-000000000001'),('90000000-0000-4000-8000-000000000002');
insert into storage.objects(bucket_id,name) values('health-records','90000000-0000-4000-8000-000000000001/91000000-0000-4000-8000-000000000001/source'),('health-records','90000000-0000-4000-8000-000000000001/91000000-0000-4000-8000-000000000002/source');
set local role authenticated;
select set_config('request.jwt.claim.sub','90000000-0000-4000-8000-000000000001',true);
select public.publish_scanned_document('91000000-0000-4000-8000-000000000001','Synthetic lab','lab_report','2026-01-06','Synthetic clinic','90000000-0000-4000-8000-000000000001/91000000-0000-4000-8000-000000000001/source','application/pdf','{"notes":"Synthetic","observations":[{"label":"Creatinine","value":"0.90","unit":"mg/dL","sourceExcerpt":"Creatinine: 0.90 mg/dL","sourcePage":1}]}',true);
select public.scan_assert((select count(*)=1 from public.record_versions),'confirmed own scan publishes one immutable source');
select public.scan_assert((select count(*)=1 from public.record_drafts where status='reviewed'),'scan is reviewed atomically');
do $$begin
 begin perform public.publish_scanned_document('91000000-0000-4000-8000-000000000002','Synthetic lab','lab_report','2026-01-06','Synthetic clinic','90000000-0000-4000-8000-000000000001/91000000-0000-4000-8000-000000000002/source','application/pdf','{"notes":"Synthetic","observations":[]}',false);raise exception 'UNEXPECTED';exception when others then if sqlerrm='UNEXPECTED' then raise;end if;end;
end$$;
select public.scan_assert((select count(*)=1 from public.record_versions),'missing human confirmation cannot publish');
select set_config('request.jwt.claim.sub','90000000-0000-4000-8000-000000000002',true);
select public.scan_assert((select count(*)=0 from public.record_versions),'other account sees no imported source');
do $$begin
 begin perform public.publish_scanned_document('91000000-0000-4000-8000-000000000002','Synthetic lab','lab_report','2026-01-06','Synthetic clinic','90000000-0000-4000-8000-000000000001/91000000-0000-4000-8000-000000000002/source','application/pdf','{"notes":"Synthetic","observations":[]}',true);raise exception 'UNEXPECTED';exception when others then if sqlerrm='UNEXPECTED' then raise;end if;end;
end$$;
set local role anon;
do $$begin
 begin perform public.publish_scanned_document(null,null,null,null,null,null,null,null,true);raise exception 'UNEXPECTED';exception when insufficient_privilege then null;end;
end$$;
rollback;
