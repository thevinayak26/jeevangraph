'use server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireSession } from '@/lib/supabase/server';
import { reportContent, safeUploadType } from '@/lib/secure-validation';
import { uploadSizeAllowed } from '@/lib/upload-limits';
export type ImportResult = { ok: boolean; message: string; versionId?: string };
export async function importScannedDocument(form: FormData): Promise<ImportResult> {
  try {
    const { db, user } = await requireSession();
    if (form.get('confirmed') !== 'yes') throw new Error('Review required');
    const title = z.string().trim().min(1).max(160).parse(form.get('title'));
    const facility = z.string().trim().min(1).max(160).parse(form.get('facility'));
    const kind = z
      .enum(['lab_report', 'prescription', 'imaging_report', 'immunization', 'other'])
      .parse(form.get('kind'));
    const date = form.get('date') ? z.iso.date().parse(form.get('date')) : null;
    const content = reportContent.parse(JSON.parse(String(form.get('content') ?? '')));
    const file = form.get('file');
    if (!(file instanceof File) || !uploadSizeAllowed(file.size))
      throw new Error('Unsupported file');
    const bytes = new Uint8Array(await file.arrayBuffer()),
      media = safeUploadType(bytes);
    if (!media || media !== file.type) throw new Error('Unsupported file');
    const id = crypto.randomUUID(),
      path = `${user.id}/${id}/source`;
    const upload = await db.storage
      .from('health-records')
      .upload(path, bytes, { contentType: media, upsert: false });
    if (upload.error) throw upload.error;
    const saved = await db.rpc('publish_scanned_document', {
      p_id: id,
      p_title: title,
      p_kind: kind,
      p_date: date,
      p_facility: facility,
      p_path: path,
      p_media: media,
      p_content: content,
      p_confirmed: true,
    });
    if (saved.error) {
      await db.storage.from('health-records').remove([path]);
      throw saved.error;
    }
    revalidatePath('/secure');
    revalidatePath('/secure/intelligence');
    revalidatePath('/secure/chat');
    return { ok: true, message: 'Reviewed source added to your history.', versionId: saved.data };
  } catch {
    return {
      ok: false,
      message:
        'Could not add this report. Check the fields, source type, 4 MB limit and connection, then retry. Your other reports are unchanged.',
    };
  }
}
