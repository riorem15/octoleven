-- Buka gembok keamanan Supabase (RLS) sepenuhnya untuk semua tabel
-- Salin dan jalankan (Run) di Supabase SQL Editor

ALTER TABLE couples ENABLE ROW LEVEL SECURITY;
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE pair_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE paps ENABLE ROW LEVEL SECURITY;
ALTER TABLE reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Bebas akses" ON couples;
CREATE POLICY "Bebas akses" ON couples FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Bebas akses" ON members;
CREATE POLICY "Bebas akses" ON members FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Bebas akses" ON pair_codes;
CREATE POLICY "Bebas akses" ON pair_codes FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Bebas akses" ON paps;
CREATE POLICY "Bebas akses" ON paps FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Bebas akses" ON reactions;
CREATE POLICY "Bebas akses" ON reactions FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Bebas akses" ON comments;
CREATE POLICY "Bebas akses" ON comments FOR ALL USING (true) WITH CHECK (true);
