# 📸 Octoleven - Native Android App & Supabase Backend (Couple PAP)

Aplikasi privat Native Android untuk pasangan berbagi foto spontan harian (**PAP Hari Ini**) dengan antarmuka estetika **Neo-Brutalism** (border tebal 3px, drop shadow tegas, warna pastel pop, dan tipografi modern). Aplikasi ini terhubung langsung ke **Supabase** (Database Postgres, Authentication & Storage gratis) dan memiliki proyek **Native Android** (`/android`).

---

## ✨ Fitur Utama

1. **Beranda & PAP Hari Ini**:
   - Penghitung hari jadian (*"Rio + Nadia • 127 hari bersama"*) & streak.
   - Tombol utama **PAP HARI INI** untuk mengambil foto HD langsung dari kamera HP atau memilih dari galeri.
   - Pilihan stiker cepat (*Cafe ☕, Kuliah 📚, Kangen 🥺, Kerja 💻, Jalan 🛵, Makan 🍜*).
   - **Bento Quick Actions**: Mood Tracker interaktif dan hitung mundur kencan berikutnya.
   - Reel polaroid momen terbaru.

2. **Feed Privat & Memori**:
   - Galeri kronologis dengan tata letak polaroid miring aesthetic.
   - Filter feed berdasarkan pengirim.
   - **Reaksi Emoji Interaktif** (❤️, 🥹, 😂, 🔥, 💌) dengan efek partikel melayang (*floating emoji animation*).
   - Kolom bisikan / komentar singkat antar pasangan tersinkron secara *Real-time*.

3. **Supabase Cloud Backend**:
   - **Bebas biaya penyimpanan foto!** Foto PAP diunggah ke Supabase Storage bucket `pap-photos` secara gratis.
   - Database Postgres dengan Supabase Realtime subscriptions.

4. **Ruang Kita (Pairing & Profil)**:
   - Kode undangan privat (`OCTO-7K92`) dengan tombol salin instan dan tautan undangan.
   - Form untuk menautkan akun menggunakan kode dari pasangan.

---

## ⚡ Panduan Langkah demi Langkah: Penyiapan Supabase

### 1. Buat Project Baru di Supabase
1. Buka [Supabase Dashboard](https://supabase.com) dan buat project baru (Gratis).
2. Setelah project siap, masuk ke **Project Settings → API**.
3. Salin **Project URL** dan **anon / public key**.

### 2. Atur Konfigurasi di `supabase-config.js`
Buka file `supabase-config.js` dan masukkan credential Anda:
```javascript
export const supabaseConfig = {
  url: "https://xyzcompany.supabase.co",
  anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
};
```

### 3. Buat Skema Database & Storage Bucket
1. Buka menu **SQL Editor** di Supabase Dashboard Anda.
2. Buka file [`schema.sql`](file:///c:/Antigravity/belajar/schema.sql) di repositori ini, salin seluruh kontennya, dan tempelkan ke SQL Editor Supabase.
3. Klik tombol **RUN**. Ini akan otomatis membuat tabel `couples`, `members`, `paps`, `reactions`, `comments`, `pair_codes`, mengaktifkan *Realtime*, serta membuat Storage Bucket `pap-photos`.

---

## 📱 Cara Menjalankan & Build Native App Android

Aplikasi ini dipaketkan menggunakan proyek Native Android (`/android`).

### 1. Sinkronisasi Aset Web ke Native Android
Setiap kali ada perubahan pada file web (`index.html`, `app.js`, `styles.css`, `supabase-config.js`), jalankan perintah berikut:

```bash
npm run sync
```

Perintah ini akan menyalin file web terbaru ke dalam folder native Android `android/app/src/main/assets/public`.

### 2. Buka dan Build APK di Android Studio
Buka proyek Android dengan perintah:

```bash
npm run open:android
```
atau buka folder `c:\Antigravity\belajar\android` langsung melalui **Android Studio**.

Dari Android Studio:
1. Hubungkan HP Android via kabel USB (atau jalankan Emulator).
2. Klik tombol **Run 'app'** (segitiga hijau) untuk menginstal aplikasi natif di HP.
3. Untuk menghasilkan file APK yang siap dibagikan ke pasangan: pilih menu **Build → Build Bundle(s) / APK(s) → Build APK(s)**.

---

## 🌐 Menjalankan secara Lokal di Browser (Opsional)

Untuk pengujian cepat di laptop/browser:
```bash
python -m http.server 3000
```
Buka browser di `http://localhost:3000`.
