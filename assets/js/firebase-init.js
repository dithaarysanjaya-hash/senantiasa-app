// ============================================================
// FIREBASE (login + sinkron data online lewat Firestore)
// ============================================================
// Ini SATU-SATUNYA file yg pakai "import" ES module (Firebase SDK cuma disediakan dlm bentuk
// itu) -- semua file JS lain di app ini sengaja tetap <script> klasik (tanpa build step). Modul
// dieksekusi "deferred" oleh browser (baru jalan setelah HTML selesai di-parse, tapi TIDAK
// dijamin sebelum <script> klasik lain yg ditulis sesudahnya) -- makanya semua yg dipakai file
// lain diekspos lewat variabel global `window.*`, dan file lain (auth.js, data.js) menunggu event
// "firebase-siap" dulu kalau globalnya belum ada saat mereka jalan.
//
// firebaseConfig di bawah ini BUKAN rahasia (Firebase sendiri yg bilang ini publik & aman
// ditaruh di kode client) -- keamanan sebenarnya datang dari Firestore Security Rules & harus
// login dulu (Firebase Authentication), bukan dari menyembunyikan config ini.
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import {
  getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import {
  getFirestore, doc, getDoc, setDoc, onSnapshot
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCvt5Jz0VNTqF-jPn6cblAMELXndbF7SQ8",
  authDomain: "senantiasa-5598a.firebaseapp.com",
  projectId: "senantiasa-5598a",
  storageBucket: "senantiasa-5598a.firebasestorage.app",
  messagingSenderId: "262254971400",
  appId: "1:262254971400:web:3da62d3a154216a0e55fbd"
};

const fbApp = initializeApp(firebaseConfig);
const auth = getAuth(fbApp);
const db = getFirestore(fbApp);

window.firebaseAuth = {
  onAuthStateChanged: (cb) => onAuthStateChanged(auth, cb),
  signOut: () => signOut(auth),
  currentUser: () => auth.currentUser
};
window.firebaseSignIn = (email, password) => signInWithEmailAndPassword(auth, email, password);
window.firestoreDb = {
  getDoc: (path) => getDoc(doc(db, path)),
  setDoc: (path, data) => setDoc(doc(db, path), data),
  // `cb` dipanggil tiap ada perubahan (baik dari device ini sendiri MAUPUN device lain);
  // `errCb` kalau koneksi/izinnya bermasalah. Return value: fungsi utk berhenti mendengarkan.
  onSnapshot: (path, cb, errCb) => onSnapshot(doc(db, path), cb, errCb)
};

window.dispatchEvent(new Event('firebase-siap'));
