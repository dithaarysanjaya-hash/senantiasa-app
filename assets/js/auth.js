// ============================================================
// GERBANG PASSWORD (bukan keamanan sungguhan!)
// ============================================================
// App ini di-hosting sbg situs statis di GitHub Pages -- TIDAK ADA server, jadi TIDAK MUNGKIN ada
// autentikasi asli (server yg cek password sebelum kasih data). Gerbang ini cuma penghalang biar
// orang yg random nemu link-nya tidak langsung bisa buka & pakai app-nya -- siapa pun yg cukup
// teknis (buka DevTools, baca source file ini, atau langsung ubah localStorage) bisa melewatinya.
// Password TIDAK disimpan mentah di sini, cuma hash SHA-256-nya, supaya minimal tidak kebaca
// polos kalau ada yg buka file ini -- tapi hash pendek spt ini tetap bisa di-brute-force offline
// kalau benar2 diincar. Jangan andalkan ini utk data yg benar2 rahasia.
(function () {
  const HASH_BENAR = 'b829a7eb61b65156f8fedb74a7f83e6a4fcb1feb552af216830d8cf54e516ad5';
  const KUNCI_STORAGE = 'senantiasa_terbuka_v1';

  const gerbang = document.getElementById('gerbangKunci');
  if (!gerbang) return;

  // Browser/konteks yg tidak dukung Web Crypto itu sangat jarang -- drpd app jadi TIDAK BISA
  // dibuka sama sekali karena ini, gerbang dilewati (cuma penghalang, bukan pengaman sungguhan).
  if (!window.crypto || !window.crypto.subtle) { gerbang.hidden = true; return; }

  if (localStorage.getItem(KUNCI_STORAGE) === '1') { gerbang.hidden = true; return; }

  async function hashSha256(teks) {
    const data = new TextEncoder().encode(teks);
    const buf = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  const form = document.getElementById('formGerbangKunci');
  const input = document.getElementById('inputGerbangKunci');
  const error = document.getElementById('errorGerbangKunci');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const hash = await hashSha256(input.value);
    if (hash === HASH_BENAR) {
      localStorage.setItem(KUNCI_STORAGE, '1');
      gerbang.hidden = true;
    } else {
      error.hidden = false;
      input.value = '';
      input.focus();
    }
  });
})();
