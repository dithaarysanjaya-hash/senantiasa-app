// ============================================================
// GERBANG LOGIN (Firebase Authentication)
// ============================================================
// Menggantikan gerbang password sederhana versi sebelumnya (yg cuma dicek di browser, gampang
// dilewati) dgn login sungguhan yg diverifikasi server Google -- password TIDAK PERNAH lewat
// atau tersimpan di kode app ini sama sekali. Setelah login sukses, dipicu muatData() (data.js,
// sekarang async krn coba ambil dari Firestore dulu) baru render() (app.js).
(function () {
  const gerbang = document.getElementById('gerbangKunci');
  if (!gerbang) return;

  const form = document.getElementById('formGerbangKunci');
  const inputEmail = document.getElementById('inputEmailGerbang');
  const inputPassword = document.getElementById('inputGerbangKunci');
  const error = document.getElementById('errorGerbangKunci');
  const tombolMasuk = form.querySelector('button[type="submit"]');

  function pesanErrorLogin(kode) {
    if (kode === 'auth/invalid-credential' || kode === 'auth/wrong-password' || kode === 'auth/user-not-found') return 'Email atau password salah.';
    if (kode === 'auth/invalid-email') return 'Format email tidak valid.';
    if (kode === 'auth/too-many-requests') return 'Terlalu banyak percobaan gagal. Coba lagi beberapa menit lagi.';
    if (kode === 'auth/network-request-failed') return 'Tidak ada koneksi internet.';
    return 'Gagal masuk, coba lagi.';
  }

  async function mulaiSetelahLogin() {
    gerbang.hidden = true;
    await muatData();
    render();
  }

  function pasangListenerAuth() {
    window.firebaseAuth.onAuthStateChanged((user) => {
      if (user) {
        mulaiSetelahLogin();
      } else {
        gerbang.hidden = false;
      }
    });
  }

  if (window.firebaseAuth) pasangListenerAuth();
  else window.addEventListener('firebase-siap', pasangListenerAuth, { once: true });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    error.hidden = true;
    tombolMasuk.disabled = true;
    tombolMasuk.textContent = 'Memeriksa...';
    try {
      if (!window.firebaseSignIn) throw { code: 'auth/network-request-failed' };
      await window.firebaseSignIn(inputEmail.value.trim(), inputPassword.value);
      // Sisanya (sembunyikan gerbang, muat data, render) ditangani onAuthStateChanged di atas.
    } catch (err) {
      error.textContent = pesanErrorLogin(err.code);
      error.hidden = false;
      inputPassword.value = '';
      inputPassword.focus();
    } finally {
      tombolMasuk.disabled = false;
      tombolMasuk.textContent = 'Masuk';
    }
  });
})();
