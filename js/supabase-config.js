// Konfigurasi Koneksi Supabase Warta Paroki
const SUPABASE_URL = 'https://ygttqhggmhkeniawaoxx.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_XCdQncVMoJd_IehFrxkyJA_SAj49G7L';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const STORAGE_BUCKET = 'warta-media';

// Validasi & Upload File Aman ke Supabase Storage
async function uploadToSupabaseStorage(file, folder) {
  if (!file) return null;

  const allowedTypes = [
    'image/jpeg', 'image/png', 'image/webp',
    'application/pdf',
    'video/mp4', 'video/webm'
  ];
  if (!allowedTypes.includes(file.type)) {
    throw new Error('Format file tidak diizinkan. Gunakan JPG, PNG, WEBP, PDF, MP4, atau WEBM.');
  }

  const maxBytes = 8 * 1024 * 1024; // Maksimal 8 MB
  if (file.size > maxBytes) {
    throw new Error('Ukuran file maksimal 8 MB.');
  }

  const ext = file.name.split('.').pop().toLowerCase().replace(/[^a-z0-9]/g, '');
  const safeFolder = folder.replace(/[^a-z0-9_-]/gi, '');
  const fileName = `${safeFolder}/${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${ext}`;

  const { error } = await supabaseClient.storage
    .from(STORAGE_BUCKET)
    .upload(fileName, file, { cacheControl: '3600', upsert: false });

  if (error) throw error;

  const { data: pubUrl } = supabaseClient.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(fileName);

  return pubUrl.publicUrl;
}