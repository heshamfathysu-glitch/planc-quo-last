// Firebase backend: Authentication (email + password) and Firestore.
import { initializeApp, deleteApp } from "firebase/app";
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut,
  createUserWithEmailAndPassword, sendPasswordResetEmail, signInAnonymously, connectAuthEmulator,
} from "firebase/auth";
import {
  getFirestore, collection, doc, getDoc, getDocs, setDoc, deleteDoc, onSnapshot, connectFirestoreEmulator,
} from "firebase/firestore";
import { firebaseConfig, adminEmail } from "../firebaseConfig.js";

const app = firebaseConfig ? initializeApp(firebaseConfig) : null;
const auth = app ? getAuth(app) : null;
const fs = app ? getFirestore(app) : null;

// test builds only (VITE_EMULATOR=1): use the local Firebase emulators
const EMU = !!import.meta.env.VITE_EMULATOR;
if (app && EMU) {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(fs, "127.0.0.1", 8080);
}

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

// Team members enter with a name and the team code: an anonymous sign-in plus
// a members/{uid} record that the rules accept only with the right code.
let pending = null; // the name and code being entered right now
const NAME_KEY = "planc:name";
const savedName = () => { try { return localStorage.getItem(NAME_KEY); } catch { return null; } };
export async function enter(name, code) {
  pending = { name, code };
  try { await signInAnonymously(auth); } catch (e) { pending = null; throw e; }
}

async function guest(u) {
  const fresh = pending;
  pending = null;
  const out = async (why) => { await signOut(auth).catch(() => {}); return [null, why]; };
  try {
    let m = await within(8000, db.get("members", u.uid));
    if (!m && fresh) {
      m = { id: u.uid, name: fresh.name, code: fresh.code, createdAt: new Date().toISOString() };
      await within(8000, db.put("members", m));
    }
    if (!m) return out("انتهت جلسة الدخول. اكتب اسمك ورمز الفريق من جديد.");
    try { localStorage.setItem(NAME_KEY, m.name); } catch { /* private mode */ }
    return [{ uid: u.uid, name: m.name, role: "user" }];
  } catch (e) {
    const denied = e?.code === "permission-denied";
    // already inside and the network is slow: open anyway with the saved name
    if (!fresh && !denied) return [{ uid: u.uid, name: savedName() || "مستخدم", role: "user" }];
    return out(!denied ? "تعذر الدخول. تأكد من الاتصال بالإنترنت ثم حاول مرة أخرى."
      : fresh ? "رمز الفريق غير صحيح." : "انتهت جلسة الدخول. اكتب اسمك ورمز الفريق من جديد.");
  }
}

// cb(user) once sign-in is known; cb(null, why) when an account can't be used.
export function watchUser(cb) {
  return onAuthStateChanged(auth, async (u) => {
    if (!u) return cb(null);
    if (u.isAnonymous) return cb(...(await guest(u)));
    const byEmail = !!adminEmail && u.email?.toLowerCase() === adminEmail.toLowerCase();
    let profile = {};
    let unknown = false; // signed in, but not added in Admin > Users
    try {
      profile = (await within(8000, db.get("users", u.uid))) || {};
      unknown = !profile.id;
    } catch (e) {
      unknown = e?.code === "permission-denied";
      // otherwise offline or slow: open anyway, each page shows its own error
    }
    if (unknown && !byEmail) {
      // say why instead of opening pages that can't read anything
      await signOut(auth).catch(() => {});
      return cb(null, "هذا البريد غير مضاف للموقع. ادخل باسمك ورمز الفريق.");
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

// the team code lives apart from settings so only the admin can read it
export const getTeamCode = () => db.get("access", "team").then((d) => d?.code || "");
export const setTeamCode = (code) => db.put("access", { id: "team", code, updatedAt: new Date().toISOString() });

// Admin adds a user without being signed out: use a second app instance.
export async function createUser({ email, password, name, role }) {
  const tmp = initializeApp(firebaseConfig, "create-" + Date.now());
  try {
    const tmpAuth = getAuth(tmp);
    if (EMU) connectAuthEmulator(tmpAuth, "http://127.0.0.1:9099", { disableWarnings: true });
    const cred = await createUserWithEmailAndPassword(tmpAuth, email, password);
    await db.put("users", { id: cred.user.uid, email, name, role, createdAt: new Date().toISOString() });
    return cred.user.uid;
  } finally {
    await deleteApp(tmp);
  }
}
