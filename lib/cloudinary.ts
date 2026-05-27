// Direct-upload helper for Cloudinary. We POST the image straight from the
// device to Cloudinary's unsigned upload endpoint - no API middleman, no
// Vercel bandwidth burn. The preset is configured server-side (in the
// Cloudinary dashboard) with restrictions on size, format, and folder.
//
// Returns the secure_url on success. The caller is responsible for then
// PATCH-ing /me with that URL so the app remembers the avatar.

const CLOUD_NAME = 'dys1tdumg';
const UPLOAD_PRESET = 'seshat_avatars';
const UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`;

export type CloudinaryUploadResult = {
  secureUrl: string;
  publicId: string;
};

/**
 * Upload a local image URI (file:// from expo-image-picker) to Cloudinary.
 * Throws on network or validation errors so the caller can show a toast.
 */
export async function uploadAvatar(localUri: string): Promise<CloudinaryUploadResult> {
  // Cloudinary's REST API accepts multipart/form-data with `file` and
  // `upload_preset` fields. React Native's FormData polyfills the upload
  // shape transparently for fetch.
  const form = new FormData();
  // The cast to `any` is unfortunate but standard for RN file uploads - the
  // FormData type definition was written for the browser and expects Blob.
  form.append('file', {
    uri: localUri,
    type: 'image/jpeg',
    name: 'avatar.jpg',
  } as any);
  form.append('upload_preset', UPLOAD_PRESET);

  const res = await fetch(UPLOAD_URL, {
    method: 'POST',
    body: form,
  });
  if (!res.ok) {
    let detail = '';
    try { detail = (await res.json())?.error?.message ?? ''; } catch { /* swallow */ }
    throw new Error(`Cloudinary upload failed (${res.status})${detail ? `: ${detail}` : ''}`);
  }
  const json = await res.json();
  if (!json.secure_url || !json.public_id) {
    throw new Error('Cloudinary returned no URL');
  }
  return { secureUrl: json.secure_url, publicId: json.public_id };
}
