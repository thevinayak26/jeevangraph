'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireSession } from '@/lib/supabase/server';
import { grantInput, reportContent, safeUploadType, uuid } from '@/lib/secure-validation';
function text(f: FormData, key: string) {
  return String(f.get(key) ?? '');
}
async function mutate(run: () => Promise<void>) {
  let failed = false;
  try {
    await run();
  } catch {
    failed = true;
  }
  revalidatePath('/secure');
  redirect('/secure?status=' + (failed ? 'failed' : 'saved'));
}
export async function uploadRecord(f: FormData) {
  await mutate(async () => {
    const { db, user } = await requireSession();
    const title = z.string().trim().min(1).max(160).parse(text(f, 'title'));
    const facility = z.string().trim().min(1).max(160).parse(text(f, 'facility'));
    const kind = z
      .enum(['lab_report', 'prescription', 'imaging_report', 'immunization', 'other'])
      .parse(text(f, 'kind'));
    const date = text(f, 'date') ? z.iso.date().parse(text(f, 'date')) : null;
    const record = text(f, 'record') ? uuid.parse(text(f, 'record')) : null;
    const file = f.get('file');
    if (!(file instanceof File) || file.size === 0 || file.size > 5 * 1024 * 1024)
      throw new Error('Invalid file');
    const bytes = new Uint8Array(await file.arrayBuffer());
    const media = safeUploadType(bytes);
    if (!media || media !== file.type) throw new Error('Unsupported file content');
    const id = crypto.randomUUID();
    const path = `${user.id}/${id}/source`;
    const uploaded = await db.storage
      .from('health-records')
      .upload(path, bytes, { contentType: media, upsert: false });
    if (uploaded.error) throw uploaded.error;
    const result = await db.rpc('create_draft', {
      p_id: id,
      p_record: record,
      p_title: title,
      p_kind: kind,
      p_date: date,
      p_facility: facility,
      p_path: path,
      p_media: media,
    });
    if (result.error) {
      await db.storage.from('health-records').remove([path]);
      throw result.error;
    }
  });
}
export async function reviewRecord(f: FormData) {
  await mutate(async () => {
    const { db } = await requireSession();
    if (f.get('confirmed') !== 'yes') throw new Error('Review required');
    const content = reportContent.parse(JSON.parse(text(f, 'content')));
    const { error } = await db.rpc('review_draft', {
      p_id: uuid.parse(text(f, 'id')),
      p_content: content,
    });
    if (error) throw error;
  });
}
export async function grantRecords(f: FormData) {
  await mutate(async () => {
    const { db } = await requireSession();
    const input = grantInput.parse({
      recipient: text(f, 'recipient'),
      purpose: text(f, 'purpose'),
      versions: f.getAll('versions'),
      hours: text(f, 'hours'),
    });
    if (f.get('confirmed') !== 'yes') throw new Error('Explicit consent required');
    const { error } = await db.rpc('grant_records', {
      p_recipient: input.recipient,
      p_purpose: input.purpose,
      p_versions: input.versions,
      p_expiry: new Date(Date.now() + input.hours * 3600000).toISOString(),
    });
    if (error) throw error;
  });
}
export async function revokeGrant(f: FormData) {
  await mutate(async () => {
    const { db } = await requireSession();
    const { error } = await db.rpc('revoke_grant', { p_id: uuid.parse(text(f, 'id')) });
    if (error) throw error;
  });
}
export async function authorizeIngestion(f: FormData) {
  await mutate(async () => {
    const { db } = await requireSession();
    if (f.get('confirmed') !== 'yes') throw new Error('Explicit delivery authorization required');
    const { error } = await db.rpc('authorize_ingestion', {
      p_facility: uuid.parse(text(f, 'recipient')),
      p_org: z.string().min(1).max(160).parse(text(f, 'organization')),
      p_expiry: new Date(Date.now() + 3600000).toISOString(),
    });
    if (error) throw error;
  });
}
export async function revokeIngestion(f: FormData) {
  await mutate(async () => {
    const { db } = await requireSession();
    const { error } = await db.rpc('revoke_ingestion', { p_id: uuid.parse(text(f, 'id')) });
    if (error) throw error;
  });
}
export async function simulateIngestion(f: FormData) {
  await mutate(async () => {
    const { db } = await requireSession();
    const content = reportContent.parse(JSON.parse(text(f, 'content')));
    const { error } = await db.rpc('ingest_simulated', {
      p_ticket: uuid.parse(text(f, 'ticket')),
      p_key: uuid.parse(text(f, 'key')),
      p_title: z.string().min(1).max(160).parse(text(f, 'title')),
      p_date: z.iso.date().parse(text(f, 'date')),
      p_content: content,
    });
    if (error) throw error;
  });
}
