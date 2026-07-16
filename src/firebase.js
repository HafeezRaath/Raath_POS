// src/firebase.js
import { initializeApp } from 'firebase/app';
import { getFirestore, enableIndexedDbPersistence } from 'firebase/firestore';
import { getAuth } from 'firebase/auth'

// 🔥 TUMHARI CONFIG (Screenshot se li hai)
const firebaseConfig = {
  apiKey: "AIzaSyCne5p_sobCUrG-nvL3rcHMD55zHeW_Bhc",
  authDomain: "raath-pos-sync-v2.firebaseapp.com",
  projectId: "raath-pos-sync-v2",
  storageBucket: "raath-pos-sync-v2.firebasestorage.app",
  messagingSenderId: "763495667744",
  appId: "1:763495667744:web:bbb0017b2fe5f2271a8445",
  measurementId: "G-NX9MXRPZNY"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

// Enable offline persistence for Firestore
enableIndexedDbPersistence(db).catch((err) => {
  if (err.code === 'failed-precondition') {
    console.warn('[Firebase] Multi-tab persistence conflict. Sync may be limited across tabs.');
  } else if (err.code === 'unimplemented') {
    console.warn('[Firebase] Browser does not support IndexedDB persistence.');
  }
});

console.log('✅ Firebase connected');