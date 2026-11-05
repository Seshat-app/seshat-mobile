// Direct-upload helper for Cloudinary. We POST the image straight from the
// device to Cloudinary's unsigned upload endpoint - no API middleman, no
// Vercel bandwidth burn. The preset is configured server-side (in the
// Cloudinary dashboard) with restrictions on size, format, and folder.
//
// Returns the secure_url on success. The caller is responsible for then
// PATCH-ing /me with that URL so the app remembers the avatar.

import { File } from 'expo-file-system';

const CLOUD_NAME = 'dys1tdumg';
const AVATAR_PRESET = 'seshat_avatars';
// Unsigned Cloudinary preset for receipts. Configured server-side with:
//   - Unsigned
//   - Allowed formats: jpg, jpeg, png
//   - Max file size: ~5 MB
//   - Folder: seshat/seshat_receipts
//   - NO incoming transformations / NO face-detection auto-crop (those
//     would destroy the receipt before the OCR endpoint sees it).
const RECEIPT_PRESET = 'seshat_receipts';
const UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`;

export type CloudinaryUploadResult = {
  secureUrl: string;
  publicId: string;
};

/**
 * Generic upload of a local file:// image URI to Cloudinary using an
 * unsigned preset. Throws on network or validation errors.
 */
/** The file extension a Cloudinary upload should carry for a picker mime type (default jpg). */
function extensionFor(mime?: string | null): string {
  switch ((mime ?? '').toLowerCase()) {
    case 'image/png': return 'png';
    case 'image/webp': return 'webp';
    case 'image/heic': return 'heic';
    case 'image/heif': return 'heif';
    default: return 'jpg';
  }
}

async function uploadImage(
  localUri: string,
  preset: string,
  baseName: string,
  mime?: string | null,
): Promise<CloudinaryUploadResult> {
  // Tell Cloudinary what the file really is. It used to be labelled JPEG no matter what the picker
  // returned, so a PNG/WebP/HEIC pick failed the preset's format check.
  const type = (mime && mime.startsWith('image/')) ? mime : 'image/jpeg';
  const filename = `${baseName}.${extensionFor(type)}`;
  // Cloudinary's REST API accepts multipart/form-data with `file` and `upload_preset` fields.
  // Expo's fetch (the global fetch on SDK 57) rejects React Native's classic `{ uri, type, name }`
  // form part with "Unsupported FormDataPart implementation". It accepts any part that exposes
  // `bytes()`, so read the file with expo-file-system and hand it over in that shape.
  const file = new File(localUri);
  const form = new FormData();
  form.append('file', {
    name: filename,
    type,
    bytes: () => file.bytes(),
  } as any);
  form.append('upload_preset', preset);

  const res = await fetch(UPLOAD_URL, {
    method: 'POST',
    body: form,
  });
  if (!res.ok) {
    let detail = '';
    try { detail = (await res.json())?.error?.message ?? ''; } catch { /* swallow */ }
    throw new Error(friendlyUploadError(res.status, detail));
  }
  const json = await res.json();
  if (!json.secure_url || !json.public_id) {
    throw new Error('Cloudinary returned no URL');
  }
  return { secureUrl: json.secure_url, publicId: json.public_id };
}

/** A message a person can act on, not Cloudinary's raw error. The raw detail is kept in parentheses. */
function friendlyUploadError(status: number, detail: string): string {
  const d = detail.toLowerCase();
  let why = 'The upload failed. Please try again.';
  if (d.includes('too large') || d.includes('file size') || status === 413) why = 'That photo is too large. Pick a smaller one.';
  else if (d.includes('format') || d.includes('invalid image') || d.includes('not allowed')) why = 'That image type is not supported. Pick a JPG or PNG photo.';
  return detail ? `${why} (${detail})` : `${why} (${status})`;
}

export function uploadAvatar(localUri: string, mime?: string | null): Promise<CloudinaryUploadResult> {
  return uploadImage(localUri, AVATAR_PRESET, 'avatar', mime);
}

export function uploadReceipt(localUri: string, mime?: string | null): Promise<CloudinaryUploadResult> {
  return uploadImage(localUri, RECEIPT_PRESET, 'receipt', mime);
}
