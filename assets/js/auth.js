// ============================================================
// GERBANG LOGIN (Firebase Authentication)
// ============================================================
// Login sungguhan yg diverifikasi server Google -- password TIDAK PERNAH lewat atau tersimpan
// di kode app ini sama sekali. Setelah login sukses, dipicu muatData() (data.js, async krn coba
// ambil dari Firestore dulu) baru render() (app.js).
//
// Markup kotak login (logo+form) SENGAJA tidak ada sama sekali di HTML awal (lihat Senantiasa.html
// -- cuma ada #gerbangKunci berisi spinner polos) -- baru disisipkan lewat JS di sini, dan HANYA
// kalau Firebase sudah memastikan user ini BENAR belum login. User yg sesinya masih valid jadi
// TIDAK PERNAH menerima/merender kotak form itu sama sekali (bukan cuma disembunyikan CSS),
// supaya tidak ada kemungkinan "kedip" kotak login tiap refresh -- yg keliatan sekejap (kalau
// koneksi lambat) cuma spinner polos, bukan sesuatu yg mirip halaman login.
(function () {
  const gerbang = document.getElementById('gerbangKunci');
  if (!gerbang) return;

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

  function tampilkanFormLogin() {
    gerbang.innerHTML = `
      <div class="gerbang-kunci__kotak">
        <img src="assets/img/logo.png?v=20260924m" alt="" class="gerbang-kunci__logo">
        <h1>Senantiasa</h1>
        <p>Masuk untuk membuka aplikasi.</p>
        <form id="formGerbangKunci">
          <input type="email" id="inputEmailGerbang" placeholder="Email" autocomplete="username" autofocus>
          <input type="password" id="inputGerbangKunci" placeholder="Password" autocomplete="current-password">
          <button type="submit">Masuk</button>
        </form>
        <p id="errorGerbangKunci" class="gerbang-kunci__error" hidden>Password salah, coba lagi.</p>
      </div>
    `;

    const form = document.getElementById('formGerbangKunci');
    const inputEmail = document.getElementById('inputEmailGerbang');
    const inputPassword = document.getElementById('inputGerbangKunci');
    const error = document.getElementById('errorGerbangKunci');
    const tombolMasuk = form.querySelector('button[type="submit"]');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      error.hidden = true;
      tombolMasuk.disabled = true;
      tombolMasuk.textContent = 'Memeriksa...';
      try {
        if (!window.firebaseSignIn) throw { code: 'auth/network-request-failed' };
        await window.firebaseSignIn(inputEmail.value.trim(), inputPassword.value);
        // Sisanya (sembunyikan gerbang, muat data, render) ditangani onAuthStateChanged di bawah.
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
  }

  function pasangListenerAuth() {
    window.firebaseAuth.onAuthStateChanged((user) => {
      if (user) mulaiSetelahLogin();
      else tampilkanFormLogin();
    });
  }

  if (window.firebaseAuth) pasangListenerAuth();
  else window.addEventListener('firebase-siap', pasangListenerAuth, { once: true });
})();
