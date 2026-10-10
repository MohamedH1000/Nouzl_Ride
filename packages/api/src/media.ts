/**
 * Every property/room photo in this platform is a Cloudinary URL stored
 * verbatim in the DB, with NO transformation segment — so the raw file is
 * what gets served. Measured on a real listing: a single gallery photo is
 * ~683 KB, and a property detail page mounts seven of them. On a phone that
 * is both slow (visibly blank placeholders for seconds on a normal
 * connection) and expensive on a metered plan, for pixels no phone screen
 * can resolve anyway.
 *
 * Cloudinary applies transformations from the URL path, so the fix needs no
 * API call, no re-upload, and no DB change: insert a transformation segment
 * after `/upload/`.
 *
 *   f_auto  — serve WebP/AVIF when the client accepts it
 *   q_auto  — let Cloudinary pick a perceptually-lossless quality
 *   w_<n>   — cap the width at what the layout can actually show
 *   c_limit — only ever shrink, never upscale a smaller original
 *
 * Anything that is not a recognisable Cloudinary upload URL is returned
 * untouched, so a Supabase-storage or third-party URL still works — this is
 * a best-effort optimisation, never a hard dependency.
 */

/** Matches the `/image/upload/` segment a transformation is inserted after. */
const CLOUDINARY_UPLOAD = '/image/upload/';

export interface CdnImageOptions {
  /** Target width in device-independent pixels; scaled up for density. */
  width: number;
  /** Device pixel ratio, so a 3x phone still gets a crisp image. Clamped
   *  to 3 — beyond that the bytes cost more than the sharpness is worth. */
  pixelRatio?: number;
}

export function cdnImageUrl(url: string | null | undefined, options: CdnImageOptions): string | undefined {
  if (!url) return undefined;
  const index = url.indexOf(CLOUDINARY_UPLOAD);
  if (index === -1) return url;

  // An URL that already carries a transformation (someone pre-sized it, or
  // this ran twice) is left alone rather than stacking a second segment.
  const afterUpload = url.slice(index + CLOUDINARY_UPLOAD.length);
  if (/^[a-z]{1,3}_[^/]+\//.test(afterUpload)) return url;

  const ratio = Math.min(Math.max(options.pixelRatio ?? 2, 1), 3);
  const width = Math.round(options.width * ratio);
  const transform = `f_auto,q_auto,c_limit,w_${width}/`;
  return url.slice(0, index + CLOUDINARY_UPLOAD.length) + transform + afterUpload;
}
