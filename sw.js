// Service worker Senantiasa -- syarat teknis supaya browser menganggap app ini "installable"
// (jadi PWA), sekaligus cache app-shell (HTML/CSS/JS/ikon) spy tetap bisa dibuka offline.
//
// PENTING: service worker HANYA aktif kalau app dibuka lewat http:// atau https:// (termasuk
// http://localhost) -- browser menolak mendaftarkan SW dari file:// krn dianggap bukan
// "secure context". Kalau Senantiasa.html dibuka langsung dgn dobel-klik (file://), file ini
// tidak akan pernah jalan & tombol "Instal Aplikasi" di Pengaturan tidak akan muncul -- itu
// normal, bukan bug. Jalankan lewat server lokal (mis. .devserver.ps1) atau hosting spy PWA-nya
// aktif. Data TETAP di localStorage seperti biasa -- SW ini cuma cache file kode, bukan data.
//
// Naikkan angka versi ini tiap kali file inti (html/css/js) berubah, supaya klien lama otomatis
// buang cache basi & ambil ulang yg baru (lihat activate di bawah) -- samakan kebiasaannya dgn
// "?v=" di Senantiasa.html.
const CACHE_NAME = 'senantiasa-cache-v1';
const ASET_INTI = [
  './Senantiasa.html',
  './manifest.json',
  './assets/css/style.css',
  './assets/js/data.js',
  './assets/js/seed-produk.js',
  './assets/js/seed-transaksi.js',
  './assets/js/ui.js',
  './assets/js/rangepicker.js',
  './assets/js/app.js',
  './assets/img/logo.png',
  './assets/img/wordmark.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASET_INTI))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Strategi "network-first, fallback ke cache": tiap ada koneksi, SELALU coba ambil versi
// terbaru dari server dulu (biar update kode kepakai secepatnya begitu online) -- baru kalau
// gagal (offline/jaringan mati) jatuh ke salinan cache terakhir yg berhasil disimpan.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const salinan = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(e.request, salinan));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
