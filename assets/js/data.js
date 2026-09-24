// Lapisan data: simpan/muat dari localStorage, backup/restore JSON, dan helper hitung stok.
// Semua data hidup di browser (localStorage) -- tidak butuh server/internet. Karena itu WAJIB
// rutin "Unduh Cadangan" di menu Pengaturan supaya data tidak hilang kalau cache browser
// terhapus atau ganti komputer.

const STORAGE_KEY = 'senantiasa_inventory_v1';
// Tokopedia SENGAJA dikeluarkan dari daftar channel aktif (keputusan bisnis) -- baik dari
// pelacakan stok maupun pembukuan. Warna/logo-nya (KELAS_CHANNEL/CHANNEL_LOGO di ui.js)
// TETAP disimpan supaya transaksi lama yg masih menyebut "Tokopedia" (data sebelum
// perubahan ini) masih bisa tampil dgn benar -- cuma tidak lagi jadi pilihan utk data baru.
const CHANNEL_LIST = ['Toko', 'Shopee', 'TikTok Shop'];
const BATAS_HARI_PERINGATAN_BACKUP = 14;
const BATAS_HARI_PERINGATAN_CEK_STOK = 2;

// Link toko fisik & marketplace -- dipakai utk tombol "Buka Toko" & pengingat cek stok manual.
// Tidak ada koneksi/API ke platform ini, murni tautan pintasan (lihat catatan di PANDUAN.md).
const CHANNEL_LINK = {
  Shopee: 'https://shopee.co.id/senantiasa_',
  'TikTok Shop': 'https://www.tiktok.com/@senantiasa_?is_from_webapp=1&sender_device=pc'
};
const LOKASI_TOKO_MAPS = 'https://maps.app.goo.gl/MNizTHdhYiy6SAoW8';

const KATEGORI_DEFAULT = ['Top', 'Outer', 'Rok', 'Skirt', 'Bikini', 'Dress', 'Kebaya'];
const KOLEKSI_DEFAULT = ['Kasuari', 'Pesisir', 'Setala'];

// ---------- Pembukuan (cashflow) ----------
// Terpisah dari menu Transaksi (yg melacak PERGERAKAN BARANG) krn harga jual di transaksi
// tidak selalu = uang yg benar2 diterima (potongan platform, promo, ongkir, dst tidak tetap).
const CHANNEL_PEMBUKUAN = CHANNEL_LIST;
const KELOMPOK_BIAYA_DEFAULT = ['Operasional', 'Ongkos Jahit', 'Ongkos Kirim', 'Belanja Bahan'];
const RINCIAN_BIAYA_DEFAULT = {
  'Operasional': ['Listrik', 'Keamanan', 'WiFi', 'Sewa', 'Konsumsi', 'Lain-lain'],
  'Ongkos Jahit': ['Penjahit 1', 'Penjahit 2'],
  'Ongkos Kirim': [],
  'Belanja Bahan': ['Kain', 'Perlengkapan Jahit']
};

// ---------- Pembukuan workspace LAIN (di luar bisnis Senantiasa) ----------
// Dinda Personal Finance & Retro Gaming Space Seririt: pembukuan cashflow yg BERDIRI SENDIRI
// (data, kategori, & saldo tidak campur sama sekali dgn Senantiasa maupun satu sama lain --
// lihat DATA.pembukuanWs). Beda dgn pembukuan Senantiasa di atas: kategori "Uang Masuk" di sini
// JUGA bebas ditambah/dihapus user (kelompokMasukList), bukan tetap ikut daftar channel toko --
// krn kedua ini bukan bisnis online-shop yg jual lewat channel marketplace. Catatannya juga
// selalu per TANGGAL (bukan rekap per periode kayak "Uang Masuk" Senantiasa).
const PEMBUKUAN_WS_INFO = {
  dinda: {
    judul: 'Dinda Personal Finance',
    deskripsi: 'Cashflow keuangan pribadi Dinda per periode',
    kelompokMasukDefault: ['Gaji', 'Bonus/THR', 'Transfer Masuk', 'Lain-lain'],
    kelompokKeluarDefault: ['Belanja Harian', 'Tabungan', 'Cicilan/Utang', 'Hiburan', 'Transportasi', 'Kesehatan', 'Lain-lain']
  },
  retro: {
    judul: 'Retro Gaming Space Seririt',
    deskripsi: 'Cashflow usaha Retro Gaming Space Seririt per periode',
    kelompokMasukDefault: ['Sewa PS/Konsol', 'Penjualan Snack/Minuman', 'Top Up/Voucher Game', 'Lain-lain'],
    kelompokKeluarDefault: ['Sewa Tempat', 'Listrik & Internet', 'Perawatan Alat', 'Belanja Stok Snack', 'Gaji Penjaga', 'Lain-lain']
  }
};
const DAFTAR_WS_PEMBUKUAN = Object.keys(PEMBUKUAN_WS_INFO);

function wsPembukuanKosong(wsId) {
  const info = PEMBUKUAN_WS_INFO[wsId];
  return {
    list: [],
    kelompokMasukList: [...info.kelompokMasukDefault],
    rincianMasuk: {},
    kelompokKeluarList: [...info.kelompokKeluarDefault],
    rincianKeluar: {}
  };
}

let DATA = null;

function buatId(prefix) {
  return (prefix ? prefix + '_' : '') + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function stokChannelKosong() {
  const o = {};
  CHANNEL_LIST.forEach(c => o[c] = 0);
  return o;
}

function dataKosong() {
  const pembukuanWs = {};
  DAFTAR_WS_PEMBUKUAN.forEach(wsId => { pembukuanWs[wsId] = wsPembukuanKosong(wsId); });
  return {
    versi: 2,
    produk: [],
    transaksi: [],
    pembukuan: [],
    pembukuanWs,
    pengaturan: {
      lastBackupAt: null, cekStok: {}, kategoriList: [...KATEGORI_DEFAULT], koleksiList: [...KOLEKSI_DEFAULT],
      kelompokBiayaList: [...KELOMPOK_BIAYA_DEFAULT], rincianBiaya: JSON.parse(JSON.stringify(RINCIAN_BIAYA_DEFAULT))
    }
  };
}

// Migrasi varian lama (stokAwal berupa satu angka gabungan) jadi stok per channel.
// Angka lama dipindah semua ke channel "Toko" (paling aman/netral) supaya total stok tidak
// berubah -- lalu bisa dipindah-pindah manual ke channel lain lewat menu Transaksi/Edit Varian.
function migrasiVarianKeStokChannel(v) {
  if (typeof v.stokAwal === 'number' || !v.stokAwal) {
    const lama = v.stokAwal || 0;
    v.stokAwal = stokChannelKosong();
    v.stokAwal['Toko'] = lama;
  } else {
    CHANNEL_LIST.forEach(c => { if (typeof v.stokAwal[c] !== 'number') v.stokAwal[c] = 0; });
  }
  if (!v.hargaChannel) v.hargaChannel = {};
  return v;
}

// Dipakai HANYA saat aplikasi dibuka pertama kali di browser ini (belum ada data tersimpan
// sama sekali) -- mengisi katalog awal dari SEED_PRODUK (lihat seed-produk.js). Kalau nanti
// data dihapus lewat "Hapus Semua Data", itu tersimpan sbg data kosong (bukan absen), jadi
// tidak akan mengulang isi katalog awal ini lagi.
function dataAwalDenganKatalog() {
  const data = dataKosong();
  if (typeof SEED_PRODUK !== 'undefined') {
    const sekarang = new Date().toISOString();
    data.produk = SEED_PRODUK.map(p => ({
      id: buatId('prod'),
      nama: p.nama,
      kategori: p.kategori,
      koleksi: p.koleksi || '',
      catatan: p.catatan,
      foto: p.foto || null,
      stokMinim: p.stokMinim,
      varian: p.varian.map(v => migrasiVarianKeStokChannel({ id: buatId('var'), ...v })),
      createdAt: sekarang,
      updatedAt: sekarang
    }));
  }
  // Data dummy riwayat transaksi (lihat seed-transaksi.js) -- dicocokkan ke produk lewat
  // nama (krn id produk baru saja dibuat acak di atas), pakai varian pertama tiap produk.
  if (typeof SEED_TRANSAKSI !== 'undefined') {
    data.transaksi = SEED_TRANSAKSI.map(t => {
      const p = data.produk.find(pr => pr.nama === t.namaProduk);
      if (!p || !p.varian.length) return null;
      const v = p.varian[0];
      const waktu = new Date();
      waktu.setDate(waktu.getDate() - t.hariLalu);
      return {
        id: buatId('tx'),
        tipe: t.tipe,
        produkId: p.id,
        varianId: v.id,
        channel: t.channel,
        qty: t.qty,
        hargaSatuan: t.hargaSatuan || 0,
        catatan: t.catatan || '',
        tanggal: waktu.toISOString().slice(0, 10),
        createdAt: waktu.toISOString()
      };
    }).filter(Boolean);
  }
  return data;
}

function pastikanPengaturanLengkap(pengaturan) {
  pengaturan = pengaturan || {};
  pengaturan.cekStok = pengaturan.cekStok || {};
  pengaturan.kategoriList = (pengaturan.kategoriList && pengaturan.kategoriList.length) ? pengaturan.kategoriList : [...KATEGORI_DEFAULT];
  pengaturan.koleksiList = (pengaturan.koleksiList && pengaturan.koleksiList.length) ? pengaturan.koleksiList : [...KOLEKSI_DEFAULT];
  pengaturan.kelompokBiayaList = (pengaturan.kelompokBiayaList && pengaturan.kelompokBiayaList.length) ? pengaturan.kelompokBiayaList : [...KELOMPOK_BIAYA_DEFAULT];
  pengaturan.rincianBiaya = pengaturan.rincianBiaya || {};
  pengaturan.kelompokBiayaList.forEach(k => {
    if (!Array.isArray(pengaturan.rincianBiaya[k])) pengaturan.rincianBiaya[k] = [...(RINCIAN_BIAYA_DEFAULT[k] || [])];
  });
  return pengaturan;
}

// Migrasi-aman utk data lama (sebelum fitur Dinda/Retro Gaming ada) yg belum punya
// DATA.pembukuanWs sama sekali, ATAU sudah ada tapi field-nya belum lengkap.
function pastikanPembukuanWsLengkap(data) {
  data.pembukuanWs = data.pembukuanWs || {};
  DAFTAR_WS_PEMBUKUAN.forEach(wsId => {
    const info = PEMBUKUAN_WS_INFO[wsId];
    const ws = data.pembukuanWs[wsId] = data.pembukuanWs[wsId] || wsPembukuanKosong(wsId);
    ws.list = ws.list || [];
    ws.kelompokMasukList = (ws.kelompokMasukList && ws.kelompokMasukList.length) ? ws.kelompokMasukList : [...info.kelompokMasukDefault];
    ws.rincianMasuk = ws.rincianMasuk || {};
    ws.kelompokKeluarList = (ws.kelompokKeluarList && ws.kelompokKeluarList.length) ? ws.kelompokKeluarList : [...info.kelompokKeluarDefault];
    ws.rincianKeluar = ws.rincianKeluar || {};
  });
}

function normalisasiData(parsed) {
  parsed.produk = parsed.produk || [];
  parsed.produk.forEach(p => { p.koleksi = p.koleksi || ''; p.varian.forEach(migrasiVarianKeStokChannel); });
  parsed.transaksi = parsed.transaksi || [];
  parsed.pembukuan = parsed.pembukuan || [];
  parsed.pengaturan = pastikanPengaturanLengkap(parsed.pengaturan);
  pastikanPembukuanWsLengkap(parsed);
  return parsed;
}

// Muat dari localStorage SAJA -- dipakai sbg baseline/cadangan offline oleh muatData() di bawah,
// juga dipanggil balik kalau Firestore gagal diakses (mis. tidak ada internet).
function muatDataLokal() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return dataAwalDenganKatalog();
    return normalisasiData(JSON.parse(raw));
  } catch (e) {
    console.error('Gagal memuat data lokal, memakai data kosong.', e);
    return dataKosong();
  }
}

// ---------- Sinkron online (Firebase Firestore, lihat assets/js/firebase-init.js) ----------
// localStorage TETAP jadi cache/cadangan offline (app tetap bisa dibuka tanpa internet), tapi
// begitu login & online, Firestore jadi "sumber kebenaran" supaya data sama persis di device
// manapun -- lihat PANDUAN.md utk penjelasan lengkap ke user.
//
// Foto produk yg diupload manual (base64, lihat modalFormProduk di app.js) SENGAJA TIDAK ikut
// disinkronkan ke Firestore -- satu dokumen Firestore dibatasi ~1MB, sedangkan base64 foto bisa
// gampang bikin dokumennya kelebihan muatan. Foto asli katalog (yg dimuat otomatis dari nama
// file di assets/img/, sudah ikut ke-hosting lewat repo) TETAP sama di semua device; hanya foto
// custom yg baru di-upload yg tetap device-lokal saja sampai di-upload ulang di device lain.
let _lepasPendengarFirestore = null;
let _sedangTerimaDariFirestore = false;
let _timerSimpanFirestore = null;

function pathDokumenFirestore() {
  const user = window.firebaseAuth && window.firebaseAuth.currentUser();
  return user ? ('toko/' + user.uid) : null;
}

// Simpan foto lokal produk (base64) yg tidak ikut dokumen Firestore -- ditempel balik ke data
// yg baru datang dari server, dicocokkan lewat id produk, spy foto custom device ini tidak hilang
// cuma krn ada update dari device lain.
function tempelBalikFotoLokal(dataBaru, dataLamaLokal) {
  const petaFoto = new Map((dataLamaLokal.produk || []).map(p => [p.id, p.foto]));
  (dataBaru.produk || []).forEach(p => { if (!('foto' in p) || !p.foto) p.foto = petaFoto.get(p.id) || null; });
  return dataBaru;
}

function siapkanPayloadFirestore(data) {
  const salinan = JSON.parse(JSON.stringify(data)); // buang undefined & putus referensi
  salinan.produk = (salinan.produk || []).map(p => { const { foto, ...sisanya } = p; return sisanya; });
  return salinan;
}

// Tepat setelah login/reload, `auth.currentUser` sudah ada tapi TOKEN-nya kadang belum benar2
// siap dipakai Firestore sepersekian detik pertama -- muncul sbg "permission-denied" palsu
// (padahal Rules-nya sudah benar), hilang sendiri begitu dicoba lagi. Helper ini nyoba ulang
// max 2x dgn jeda dikit KHUSUS utk error itu, drpd langsung nyerah & pakai data lokal.
async function coba2xKalauPermissionDenied(fn) {
  for (let percobaan = 0; ; percobaan++) {
    try {
      return await fn();
    } catch (e) {
      if (e.code !== 'permission-denied' || percobaan >= 2) throw e;
      await new Promise((r) => setTimeout(r, 600));
    }
  }
}

async function muatData() {
  const dataLokal = muatDataLokal();
  DATA = dataLokal;

  const user = window.firebaseAuth && window.firebaseAuth.currentUser();
  if (!window.firestoreDb || !user) return DATA;
  try { await user.getIdToken(); } catch (e) { /* dibiarkan -- panggilan Firestore di bawah yg akan gagal & fallback kalau tokennya beneran bermasalah */ }

  const path = pathDokumenFirestore();
  try {
    const snap = await coba2xKalauPermissionDenied(() => window.firestoreDb.getDoc(path));
    if (snap.exists()) {
      DATA = tempelBalikFotoLokal(normalisasiData(snap.data()), dataLokal);
      simpanDataLokalSaja();
    } else {
      // Belum pernah sinkron sama sekali -- kirim data yg sudah ada di browser ini (kalau ada)
      // jadi dokumen pertama, supaya data lama TIDAK hilang begitu pindah ke Firestore.
      await window.firestoreDb.setDoc(path, siapkanPayloadFirestore(DATA));
    }
  } catch (e) {
    console.error('Gagal sinkron dari Firestore, pakai data tersimpan di browser ini dulu.', e);
    tampilkanToast('Tidak bisa terhubung ke server online -- memakai data tersimpan di browser ini dulu.', 'error');
  }

  pasangSinkronFirestoreRealtime();
  return DATA;
}

// Dengarkan perubahan Firestore scr live (dari device LAIN, atau tab lain di device ini) supaya
// halaman yg sedang terbuka otomatis ter-update tanpa perlu reload manual.
function pasangSinkronFirestoreRealtime(percobaanKe) {
  percobaanKe = percobaanKe || 0;
  if (_lepasPendengarFirestore) _lepasPendengarFirestore();
  const path = pathDokumenFirestore();
  if (!window.firestoreDb || !path) return;
  _lepasPendengarFirestore = window.firestoreDb.onSnapshot(path, (snap) => {
    // hasPendingWrites=true = ini "gema" dari tulisan kita sendiri yg belum dikonfirmasi server,
    // bukan data baru sungguhan -- diabaikan spy tidak render ulang dgn data yg sudah kita punya.
    if (snap.metadata.hasPendingWrites || !snap.exists()) return;
    _sedangTerimaDariFirestore = true;
    DATA = tempelBalikFotoLokal(normalisasiData(snap.data()), DATA);
    simpanDataLokalSaja();
    if (typeof render === 'function') render();
    _sedangTerimaDariFirestore = false;
  }, (e) => {
    console.error('Sinkron realtime Firestore terputus.', e);
    // Sama spt di muatData() -- "permission-denied" tepat setelah login/reload sering cuma
    // token yg belum siap sepersekian detik, bukan Rules yg beneran salah. Coba pasang ulang.
    if (e.code === 'permission-denied' && percobaanKe < 2) {
      setTimeout(() => pasangSinkronFirestoreRealtime(percobaanKe + 1), 600);
    }
  });
}

function simpanDataLokalSaja() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(DATA)); } catch (e) { /* lihat simpanData() utk penanganan penuh */ }
}

function jadwalkanSimpanFirestore() {
  const path = pathDokumenFirestore();
  // Kalau perubahan DATA ini justru BARU DATANG dari Firestore (bukan aksi user di device ini),
  // jangan dikirim balik -- percuma & bisa jadi lomba (race) dgn update lain yg lebih baru.
  if (!window.firestoreDb || !path || _sedangTerimaDariFirestore) return;
  clearTimeout(_timerSimpanFirestore);
  // Ditunda dikit (bukan langsung tiap panggilan) -- banyak aksi user memicu simpanData()
  // beberapa kali berturut-turut dlm waktu singkat, jadi digabung jadi 1 kali kirim ke server.
  _timerSimpanFirestore = setTimeout(() => {
    window.firestoreDb.setDoc(path, siapkanPayloadFirestore(DATA))
      .catch(e => console.error('Gagal sinkron ke Firestore', e));
  }, 800);
}

function simpanData() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DATA));
    jadwalkanSimpanFirestore();
    return true;
  } catch (e) {
    console.error('Gagal menyimpan data', e);
    tampilkanToast('Gagal menyimpan data (penyimpanan browser penuh). Segera unduh cadangan, lalu hapus beberapa foto produk untuk mengosongkan ruang.', 'error');
    return false;
  }
}

// ---------- Helper pencarian ----------
function cariProduk(id) { return DATA.produk.find(p => p.id === id) || null; }
function cariVarian(produkId, varianId) {
  const p = cariProduk(produkId);
  if (!p) return null;
  return p.varian.find(v => v.id === varianId) || null;
}

// ---------- Stok terhitung (stokAwal + efek seluruh transaksi) ----------
function efekTransaksi(t) {
  if (t.tipe === 'masuk') return t.qty;
  if (t.tipe === 'keluar') return -t.qty;
  if (t.tipe === 'koreksi') return t.qty; // qty koreksi boleh negatif
  return 0;
}

// Total stok = jumlah stok di SEMUA channel (stok kini dikelola terpisah per channel).
function hitungStok(produkId, varianId) {
  const v = cariVarian(produkId, varianId);
  if (!v) return 0;
  let stok = CHANNEL_LIST.reduce((a, c) => a + (v.stokAwal[c] || 0), 0);
  for (const t of DATA.transaksi) {
    if (t.produkId === produkId && t.varianId === varianId) stok += efekTransaksi(t);
  }
  return stok;
}

// Stok utk satu channel spesifik saja (dipakai di detail produk, ringkasan per channel, dsb).
function hitungStokChannel(produkId, varianId, channel) {
  const v = cariVarian(produkId, varianId);
  if (!v) return 0;
  let stok = v.stokAwal[channel] || 0;
  for (const t of DATA.transaksi) {
    if (t.produkId === produkId && t.varianId === varianId && t.channel === channel) stok += efekTransaksi(t);
  }
  return stok;
}

// ---------- Harga per channel (opsional per varian, fallback ke hargaJual umum) ----------
function hargaVarianUntukChannel(v, channel) {
  const override = v.hargaChannel && v.hargaChannel[channel];
  return (override !== undefined && override !== null && override !== '') ? override : (v.hargaJual || 0);
}

// Total stok satu channel, dijumlah dari semua produk & varian -- dipakai di Overview.
function totalStokChannel(channel) {
  let total = 0;
  for (const p of DATA.produk) {
    for (const v of p.varian) total += hitungStokChannel(p.id, v.id, channel);
  }
  return total;
}

function daftarVarianDenganStok() {
  const hasil = [];
  for (const p of DATA.produk) {
    for (const v of p.varian) {
      hasil.push({ produk: p, varian: v, stok: hitungStok(p.id, v.id) });
    }
  }
  return hasil;
}

// Daftar kategori/koleksi utk chip filter = gabungan master list (dari Pengaturan) + nilai
// apa pun yg sudah terpakai di data produk (jaga2 kalau ada nilai lama di luar master list).
function kategoriTerpakai() {
  const set = new Set(DATA.pengaturan.kategoriList);
  DATA.produk.forEach(p => { if (p.kategori) set.add(p.kategori); });
  return Array.from(set).sort();
}

function koleksiTerpakai() {
  const set = new Set(DATA.pengaturan.koleksiList);
  DATA.produk.forEach(p => { if (p.koleksi) set.add(p.koleksi); });
  return Array.from(set).sort();
}

// Karakter "|" sengaja dibuang dari SEMUA nama kelompok/rincian/kategori/koleksi (bukan cuma
// dirapikan) krn nama-nama ini disambung pakai "|" jadi satu string di atribut data-* tombol
// hapus/tambah di Pengaturan (mis. data-hapus-rincian="Operasional|Listrik") lalu dibongkar lagi
// pakai .split('|') -- kalau namanya sendiri mengandung "|", potongannya jadi salah/ke-truncate.
function bersihkanNamaKlasifikasi(s) {
  return (s || '').replace(/\|/g, '-').trim();
}

function tambahKlasifikasi(daftarKey, nilai) {
  nilai = bersihkanNamaKlasifikasi(nilai);
  if (!nilai) return false;
  const list = DATA.pengaturan[daftarKey];
  if (list.some(x => x.toLowerCase() === nilai.toLowerCase())) return false;
  list.push(nilai);
  simpanData();
  return true;
}

function hapusKlasifikasi(daftarKey, nilai) {
  DATA.pengaturan[daftarKey] = DATA.pengaturan[daftarKey].filter(x => x !== nilai);
  simpanData();
}

// ---------- Kelompok Biaya & Rincian (dipakai Pembukuan) ----------
// Sama pola dgn kategoriTerpakai/koleksiTerpakai di atas: gabungan master list + nilai apa pun
// yg sudah terpakai di catatan pembukuan (jaga2 kalau kelompok/rincian-nya sudah dihapus dari
// master list tapi masih ada di catatan lama).
function kelompokBiayaTerpakai() {
  const set = new Set(DATA.pengaturan.kelompokBiayaList);
  DATA.pembukuan.forEach(x => { if (x.kelompok) set.add(x.kelompok); });
  return Array.from(set);
}

function rincianBiayaTerpakai(kelompok) {
  const set = new Set(DATA.pengaturan.rincianBiaya[kelompok] || []);
  DATA.pembukuan.forEach(x => { if (x.kelompok === kelompok && x.rincian) set.add(x.rincian); });
  return Array.from(set);
}

function tambahRincianBiaya(kelompok, nilai) {
  nilai = bersihkanNamaKlasifikasi(nilai);
  if (!nilai || !kelompok) return false;
  if (!DATA.pengaturan.rincianBiaya[kelompok]) DATA.pengaturan.rincianBiaya[kelompok] = [];
  const list = DATA.pengaturan.rincianBiaya[kelompok];
  if (list.some(x => x.toLowerCase() === nilai.toLowerCase())) return false;
  list.push(nilai);
  simpanData();
  return true;
}

function hapusRincianBiaya(kelompok, nilai) {
  if (!DATA.pengaturan.rincianBiaya[kelompok]) return;
  DATA.pengaturan.rincianBiaya[kelompok] = DATA.pengaturan.rincianBiaya[kelompok].filter(x => x !== nilai);
  simpanData();
}

function hapusKelompokBiaya(nilai) {
  hapusKlasifikasi('kelompokBiayaList', nilai);
  delete DATA.pengaturan.rincianBiaya[nilai];
  simpanData();
}

// ---------- Ringkasan Pembukuan (cashflow) ----------
// Entri "masuk" adalah REKAP satu periode (bukan satu transaksi) -- dianggap "masuk rentang
// [dari,sampai]" kalau periodenya bersinggungan (overlap) dgn rentang tsb, nilainya diambil
// utuh (tidak dipro-rata harian) krn ini rekap kasar, bukan pembukuan akuntansi presisi.
function pembukuanDalamRentang(dari, sampai) {
  return DATA.pembukuan.filter(x => {
    if (x.tipe === 'masuk') return x.periodeDari <= sampai && x.periodeSampai >= dari;
    return x.tanggal >= dari && x.tanggal <= sampai;
  });
}

function totalPembukuan(dari, sampai) {
  const list = pembukuanDalamRentang(dari, sampai);
  const masuk = list.filter(x => x.tipe === 'masuk').reduce((a, x) => a + (x.jumlah || 0), 0);
  const keluar = list.filter(x => x.tipe === 'keluar').reduce((a, x) => a + (x.jumlah || 0), 0);
  return { masuk, keluar, bersih: masuk - keluar, list };
}

// ---------- Ringkasan Pembukuan workspace lain (Dinda Personal Finance, Retro Gaming) ----------
// Sama pola dgn kelompokBiayaTerpakai/rincianBiayaTerpakai/pembukuanDalamRentang/totalPembukuan
// di atas (khusus Senantiasa), cuma diparameterkan by wsId & mendukung tipe 'masuk'/'keluar'
// dua-duanya (bukan cuma 'keluar') krn kategorinya sama2 bebas diedit di kedua workspace ini.
function wsPembukuan(wsId) { return DATA.pembukuanWs[wsId]; }

function wsKelompokTerpakai(wsId, tipe) {
  const ws = wsPembukuan(wsId);
  const key = tipe === 'masuk' ? 'kelompokMasukList' : 'kelompokKeluarList';
  const set = new Set(ws[key]);
  ws.list.forEach(x => { if (x.tipe === tipe && x.kelompok) set.add(x.kelompok); });
  return Array.from(set);
}

function wsRincianTerpakai(wsId, tipe, kelompok) {
  const ws = wsPembukuan(wsId);
  const rincianKey = tipe === 'masuk' ? 'rincianMasuk' : 'rincianKeluar';
  const set = new Set(ws[rincianKey][kelompok] || []);
  ws.list.forEach(x => { if (x.tipe === tipe && x.kelompok === kelompok && x.rincian) set.add(x.rincian); });
  return Array.from(set);
}

function wsTambahKelompok(wsId, tipe, nilai) {
  nilai = bersihkanNamaKlasifikasi(nilai);
  if (!nilai) return false;
  const ws = wsPembukuan(wsId);
  const key = tipe === 'masuk' ? 'kelompokMasukList' : 'kelompokKeluarList';
  if (ws[key].some(x => x.toLowerCase() === nilai.toLowerCase())) return false;
  ws[key].push(nilai);
  simpanData();
  return true;
}

function wsHapusKelompok(wsId, tipe, nilai) {
  const ws = wsPembukuan(wsId);
  const key = tipe === 'masuk' ? 'kelompokMasukList' : 'kelompokKeluarList';
  const rincianKey = tipe === 'masuk' ? 'rincianMasuk' : 'rincianKeluar';
  ws[key] = ws[key].filter(x => x !== nilai);
  delete ws[rincianKey][nilai];
  simpanData();
}

function wsTambahRincian(wsId, tipe, kelompok, nilai) {
  nilai = bersihkanNamaKlasifikasi(nilai);
  if (!nilai || !kelompok) return false;
  const ws = wsPembukuan(wsId);
  const rincianKey = tipe === 'masuk' ? 'rincianMasuk' : 'rincianKeluar';
  if (!ws[rincianKey][kelompok]) ws[rincianKey][kelompok] = [];
  const list = ws[rincianKey][kelompok];
  if (list.some(x => x.toLowerCase() === nilai.toLowerCase())) return false;
  list.push(nilai);
  simpanData();
  return true;
}

function wsHapusRincian(wsId, tipe, kelompok, nilai) {
  const ws = wsPembukuan(wsId);
  const rincianKey = tipe === 'masuk' ? 'rincianMasuk' : 'rincianKeluar';
  if (!ws[rincianKey][kelompok]) return;
  ws[rincianKey][kelompok] = ws[rincianKey][kelompok].filter(x => x !== nilai);
  simpanData();
}

// Beda dgn pembukuanDalamRentang Senantiasa: di sini "Uang Masuk" JUGA per tanggal tunggal
// (bukan rekap periode), jadi cukup filter x.tanggal biasa utk kedua tipe.
function wsPembukuanDalamRentang(wsId, dari, sampai) {
  return wsPembukuan(wsId).list.filter(x => x.tanggal >= dari && x.tanggal <= sampai);
}

function wsTotalPembukuan(wsId, dari, sampai) {
  const list = wsPembukuanDalamRentang(wsId, dari, sampai);
  const masuk = list.filter(x => x.tipe === 'masuk').reduce((a, x) => a + (x.jumlah || 0), 0);
  const keluar = list.filter(x => x.tipe === 'keluar').reduce((a, x) => a + (x.jumlah || 0), 0);
  return { masuk, keluar, bersih: masuk - keluar, list };
}

// ---------- Backup / Restore ----------
function unduhCadangan() {
  const blob = new Blob([JSON.stringify(DATA, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const tgl = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `cadangan-inventory-senantiasa-${tgl}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  DATA.pengaturan.lastBackupAt = new Date().toISOString();
  simpanData();
}

function pulihkanDariFile(file, onDone) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      if (!parsed || !Array.isArray(parsed.produk) || !Array.isArray(parsed.transaksi)) {
        throw new Error('Format file tidak sesuai.');
      }
      DATA = parsed;
      DATA.produk.forEach(p => { p.koleksi = p.koleksi || ''; p.varian.forEach(migrasiVarianKeStokChannel); });
      DATA.pengaturan = pastikanPengaturanLengkap(DATA.pengaturan);
      pastikanPembukuanWsLengkap(DATA);
      simpanData();
      onDone(true, null);
    } catch (e) {
      onDone(false, e.message);
    }
  };
  reader.onerror = () => onDone(false, 'Gagal membaca file.');
  reader.readAsText(file);
}

function hariSejakBackupTerakhir() {
  if (!DATA.pengaturan.lastBackupAt) return Infinity;
  const ms = Date.now() - new Date(DATA.pengaturan.lastBackupAt).getTime();
  return ms / (1000 * 60 * 60 * 24);
}

// ---------- Pengingat cek stok marketplace (manual, tanpa koneksi ke platform) ----------
function hariSejakCekStok(channel) {
  const waktu = DATA.pengaturan.cekStok[channel];
  if (!waktu) return Infinity;
  const ms = Date.now() - new Date(waktu).getTime();
  return ms / (1000 * 60 * 60 * 24);
}

function tandaiCekStok(channel) {
  DATA.pengaturan.cekStok[channel] = new Date().toISOString();
  simpanData();
}

function perkiraanUkuranData() {
  try {
    const bytes = new Blob([JSON.stringify(DATA)]).size;
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  } catch (e) { return '-'; }
}
