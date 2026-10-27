import { createContext, useContext, useEffect, useState } from "react";
import { CLOUD } from "./lib/store.js";
import * as fb from "./lib/firebase.js";

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

const LOCAL_KEY = "planc:me";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined); // undefined = loading
  const [notice, setNotice] = useState(""); // why a sign-in was refused

  useEffect(() => {
    if (CLOUD) return fb.watchUser((u, why) => { setUser(u); if (why || u) setNotice(why || ""); });
    try { setUser(JSON.parse(localStorage.getItem(LOCAL_KEY)) || null); } catch { setUser(null); }
  }, []);

  const save = (u) => { localStorage.setItem(LOCAL_KEY, JSON.stringify(u)); setUser(u); };
  const value = {
    user,
    notice,
    isAdmin: user?.role === "admin",
    // team members: name (and team code) only
    async enter(name, code) {
      setNotice("");
      if (CLOUD) return fb.enter(name, code);
      // local trial mode (no Firebase config): kept on this browser only
      save({ uid: "local", name, email: "", role: "user" });
    },
    // the dashboard: email and password
    async login(email, password) {
      setNotice("");
      if (CLOUD) return fb.login(email, password);
      save({ uid: "local", name: user?.name || "المدير", email, role: "admin" });
    },
    async logout() {
      if (CLOUD) return fb.logout();
      localStorage.removeItem(LOCAL_KEY);
      setUser(null);
    },
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
