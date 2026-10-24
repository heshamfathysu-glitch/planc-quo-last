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

export function watchUser(cb) {
  return onAuthStateChanged(auth, async (u) => {
    if (!u) return cb(null);
    let profile = (await db.get("users", u.uid)) || {};
    const isAdmin = profile.role === "admin" || (adminEmail && u.email?.toLowerCase() === adminEmail.toLowerCase());
    if (isAdmin && !profile.id) {
      // first sign-in of the admin: create the profile so the user list shows it
      profile = { id: u.uid, email: u.email, name: u.email.split("@")[0], role: "admin", createdAt: new Date().toISOString() };
      await db.put("users", profile);
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
