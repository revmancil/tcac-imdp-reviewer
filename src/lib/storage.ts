// Supabase Storage wrapper for uploaded candidate documents (replaces the
// Cloudflare R2 binding). Uses the service-role key server-side so uploads
// and downloads bypass Storage RLS — the bucket itself should be created as
// **private** in the Supabase dashboard; access is gated by the app's own
// officer-scope checks in src/index.tsx, not by Storage policies.

import { createClient } from '@supabase/supabase-js';

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'uploads';

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  { auth: { persistSession: false } }
);

export async function putFile(key: string, data: ArrayBuffer, contentType: string): Promise<void> {
  const { error } = await supabase.storage.from(BUCKET).upload(key, data, {
    contentType,
    upsert: true,
  });
  if (error) throw error;
}

export interface StoredFile {
  body: Blob;
  contentType: string;
}

export async function getFile(key: string): Promise<StoredFile | null> {
  const { data, error } = await supabase.storage.from(BUCKET).download(key);
  if (error || !data) return null;
  return { body: data, contentType: data.type || 'application/octet-stream' };
}
