// Firebase backend: Authentication (email + password) and Firestore.
import { initializeApp, deleteApp } from "firebase/app";
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut,
  createUserWithEmailAndPassword, sendPasswordResetEmail,
} from "firebase/auth";
import {
  getFirestore, collection, doc, getDoc, getDocs, setDoc, deleteDoc, onSnapshot,
} from "firebase/firestore";
import { firebaseConfig, adminEmail } from "../firebaseConfig.js";

const app = firebaseConfig ? initializeApp(firebaseConfig) : null;
const auth = app ? getAuth(app) : null;
const fs = app ? getFirestore(app) : null;

// Firestore rejects undefined values
const clean = (o) => JSON.parse(JSON.stringify(o));

export const db = {
  async list(col) {
    const snap = await getDocs(collection(fs, col));
    return snap.docs.map((d) => d.data());
  },
  async get(col, id) {
    const d = await getDoc(doc(fs, col, id));
    return d.exists() ? d.data() : null;
  },
  async put(col, obj) {
    await setDoc(doc(fs, col, obj.id), clean(obj));
    return obj;
  },
  async remove(col, id) { await deleteDoc(doc(fs, col, id)); },
  subscribe(col, cb) { return onSnapshot(collection(fs, col), () => cb()); },
};

// Gives up on a slow network so the app never waits forever.
const within = (ms, p) => Promise.race([p, new Promise((_, no) => setTimeout(() => no(new Error("timeout")), ms))]);

// cb(user) once sign-in is known; cb(null, why) when an account can't be used.
export function watchUser(cb) {
  return onAuthStateChanged(auth, async (u) => {
    if (!u) return cb(null);
    const byEmail = !!adminEmail && u.email?.toLowerCase() === adminEmail.toLowerCase();
    let profile = {};
    try {
      profile = (await within(8000, db.get("users", u.uid))) || {};
    } catch (e) {
      // an account made outside Admin > Users has no profile, so the rules
      // refuse it: sign out and say why instead of loading forever
      if (!byEmail && e?.code === "permission-denied") {
        await signOut(auth).catch(() => {});
        return cb(null, "هذا الحساب غير مضاف للموقع بعد. اطلب من المدير إضافته من لوحة التحكم > المستخدمون.");
      }
      // offline or slow: open anyway, each page shows its own error
    }
    const isAdmin = profile.role === "admin" || byEmail;
    if (isAdmin && !profile.id) {
      // first sign-in of the admin: create the profile so the user list shows it
      profile = { id: u.uid, email: u.email, name: u.email.split("@")[0], role: "admin", createdAt: new Date().toISOString() };
      db.put("users", profile).catch(() => {});
    }
    cb({ uid: u.uid, email: u.email, name: profile.name || u.email, role: isAdmin ? "admin" : profile.role || "user" });
  });
}

export const login = (email, password) => signInWithEmailAndPassword(auth, email, password);
export const logout = () => signOut(auth);
export const resetPassword = (email) => sendPasswordResetEmail(auth, email);

// Admin adds a user without being signed out: use a second app instance.
export async function createUser({ email, password, name, role }) {
  const tmp = initializeApp(firebaseConfig, "create-" + Date.now());
  try {
    const cred = await createUserWithEmailAndPassword(getAuth(tmp), email, password);
    await db.put("users", { id: cred.user.uid, email, name, role, createdAt: new Date().toISOString() });
    return cred.user.uid;
  } finally {
    await deleteApp(tmp);
  }
}
