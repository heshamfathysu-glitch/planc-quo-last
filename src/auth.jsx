import { createContext, useContext, useEffect, useState } from "react";
import { CLOUD } from "./lib/store.js";
import * as fb from "./lib/firebase.js";
import { DEMO, leaveDemo } from "./lib/demo.js";

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

const LOCAL_KEY = "planc:me";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined); // undefined = loading

  useEffect(() => {
    if (CLOUD) return fb.watchUser(setUser);
    try { setUser(JSON.parse(localStorage.getItem(LOCAL_KEY)) || null); } catch { setUser(null); }
  }, []);

  const value = {
    user,
    isAdmin: user?.role === "admin",
    async login(email, password, name) {
      if (CLOUD) return fb.login(email, password);
      // local trial mode: the first person on this browser is the admin
      const u = { uid: "local", name: name || "مستخدم", email, role: "admin" };
      localStorage.setItem(LOCAL_KEY, JSON.stringify(u));
      setUser(u);
    },
    async logout() {
      if (CLOUD) return fb.logout();
      if (DEMO) return leaveDemo();
      localStorage.removeItem(LOCAL_KEY);
      setUser(null);
    },
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
