-- Local extraction remains untrusted until explicit patient review. Atomic publish avoids partial drafts.
create function public.publish_scanned_document(p_id uuid,p_title text,p_kind text,p_date date,p_facility text,p_path text,p_media text,p_content jsonb,p_confirmed boolean)
returns uuid language plpgsql security definer set search_path='' as $$
declare v uuid;
begin
 if auth.uid() is null or p_confirmed is distinct from true then raise exception 'Owner review required';end if;
 if not public.valid_review_content(p_content) then raise exception 'Invalid reviewed extraction';end if;
 perform public.create_draft(p_id,null,p_title,p_kind,p_date,p_facility,p_path,p_media);
 update public.record_drafts set extracted=p_content where id=p_id and owner_id=auth.uid();
 v:=public.review_draft(p_id,p_content);
 insert into public.audit_events(owner_id,actor_id,event,resource_id) values(auth.uid(),auth.uid(),'scanned_source_reviewed',v);
 return v;
end $$;
revoke execute on function public.publish_scanned_document(uuid,text,text,date,text,text,text,jsonb,boolean) from public,anon;
grant execute on function public.publish_scanned_document(uuid,text,text,date,text,text,text,jsonb,boolean) to authenticated;
