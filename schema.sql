-- ====================================================================
-- OCTOLEVEN - SUPABASE DATABASE & STORAGE SCHEMA
-- Salin seluruh teks ini dan tempel di: Supabase Dashboard -> SQL Editor
-- ====================================================================

-- 1. TABEL RUANG PASANGAN (couples)
CREATE TABLE IF NOT EXISTS couples (
  id TEXT PRIMARY KEY,
  invite_code TEXT UNIQUE NOT NULL,
  relationship_start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. TABEL KODE UNDANGAN PASANGAN (pair_codes)
CREATE TABLE IF NOT EXISTS pair_codes (
  code TEXT PRIMARY KEY,
  couple_id TEXT NOT NULL REFERENCES couples(id) ON DELETE CASCADE,
  owner_id TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. TABEL ANGGOTA PASANGAN (members)
CREATE TABLE IF NOT EXISTS members (
  id TEXT PRIMARY KEY,
  couple_id TEXT NOT NULL REFERENCES couples(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  avatar TEXT,
  mood_emoji TEXT DEFAULT '🥰',
  mood_text TEXT DEFAULT 'Lagi mikirin kamu!',
  next_date_label TEXT DEFAULT 'Malam Minggu 🍿',
  next_date_time TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. TABEL FOTO PAP / MOMEN (paps)
CREATE TABLE IF NOT EXISTS paps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  couple_id TEXT NOT NULL REFERENCES couples(id) ON DELETE CASCADE,
  sender_id TEXT NOT NULL,
  sender_name TEXT NOT NULL,
  sender_avatar TEXT,
  photo_url TEXT NOT NULL,
  sticker TEXT DEFAULT 'Cafe ☕',
  location_name TEXT DEFAULT 'Sekitaran Kota',
  caption TEXT,
  like_count INT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. TABEL REAKSI EMOJI (reactions)
CREATE TABLE IF NOT EXISTS reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pap_id UUID NOT NULL REFERENCES paps(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  user_name TEXT NOT NULL,
  emoji TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. TABEL KOMENTAR / BISIKAN (comments)
CREATE TABLE IF NOT EXISTS comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pap_id UUID NOT NULL REFERENCES paps(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  user_name TEXT NOT NULL,
  user_avatar TEXT,
  text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Realtime for key tables (Aman dari error jika di-run ulang)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'paps') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE paps;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'members') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE members;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'reactions') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE reactions;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'comments') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE comments;
  END IF;
END $$;

-- Disable RLS for easy initial couple access (or enable open policies)
ALTER TABLE couples DISABLE ROW LEVEL SECURITY;
ALTER TABLE pair_codes DISABLE ROW LEVEL SECURITY;
ALTER TABLE members DISABLE ROW LEVEL SECURITY;
ALTER TABLE paps DISABLE ROW LEVEL SECURITY;
ALTER TABLE reactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE comments DISABLE ROW LEVEL SECURITY;

-- 7. SUPABASE STORAGE BUCKET UNTUK FOTO PAP ('pap-photos')
INSERT INTO storage.buckets (id, name, public) 
VALUES ('pap-photos', 'pap-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Hapus kebijakan lama (jika ada) agar tidak error saat di-run ulang
DROP POLICY IF EXISTS "Public Read Access" ON storage.objects;
DROP POLICY IF EXISTS "Public Insert Access" ON storage.objects;
DROP POLICY IF EXISTS "Public Update Access" ON storage.objects;

-- Kebijakan akses bebas membaca & mengunggah di bucket pap-photos
CREATE POLICY "Public Read Access" ON storage.objects FOR SELECT USING (bucket_id = 'pap-photos');
CREATE POLICY "Public Insert Access" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'pap-photos');
CREATE POLICY "Public Update Access" ON storage.objects FOR UPDATE USING (bucket_id = 'pap-photos');
