import { z } from 'zod';
export const uuid = z.uuid();
export const reportContent = z
  .object({
    notes: z.string().max(10000),
    observations: z
      .array(
        z
          .object({
            label: z.string().min(1).max(100),
            value: z.string().min(1).max(100),
            unit: z.string().max(60),
            sourceExcerpt: z.string().min(1).max(1000),
            sourcePage: z.number().int().min(1).max(9999),
          })
          .strict(),
      )
      .max(100),
  })
  .strict();
export const grantInput = z.object({
  recipient: uuid,
  purpose: z.string().trim().min(5).max(200),
  versions: z.array(uuid).min(1).max(50),
  hours: z.coerce.number().int().min(1).max(720),
});
export function safeUploadType(bytes: Uint8Array): string | null {
  if (
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46 &&
    bytes[4] === 0x2d
  )
    return 'application/pdf';
  if ([137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v)) return 'image/png';
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'image/jpeg';
  return null;
}
