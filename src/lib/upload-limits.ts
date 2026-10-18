// Leave room for multipart fields inside Vercel's function payload limit.
export const MAX_UPLOAD_BYTES = 4_000_000;
export function uploadSizeAllowed(size: number) {
  return Number.isSafeInteger(size) && size > 0 && size <= MAX_UPLOAD_BYTES;
}
