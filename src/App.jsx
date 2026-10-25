import { useEffect, useState } from "react";
import { HashRouter, Routes, Route, NavLink, Navigate, Link, useLocation, useNavigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth.jsx";
import { CLOUD } from "./lib/store.js";
import { Toaster } from "./ui.jsx";
import { createDraft } from "./lib/newQuote.js";
import { THEME, LOGO } from "./theme.js";
import Login from "./pages/Login.jsx";
import Home from "./pages/Home.jsx";
import Wizard from "./pages/Wizard.jsx";
import Editor from "./pages/Editor.jsx";
import Quotes from "./pages/Quotes.jsx";
import Clients from "./pages/Clients.jsx";
import Companies from "./pages/Companies.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Admin from "./pages/Admin.jsx";

const Icon = ({ d }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
);
const I = {
  home: "M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z",
  quotes: "M7 3h7l5 5v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM14 3v5h5M9 13h6M9 17h6",
  plus: "M12 5v14M5 12h14",
  clients: "M16 20v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 20v-1a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8",
  more: "M4 6h16M4 12h16M4 18h16",
};

function BottomNav({ isAdmin, user, logout }) {
  const nav = useNavigate();
  const loc = useLocation();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [loc.pathname]);
  const inMore = ["/companies", "/dashboard", "/admin"].some((p) => loc.pathname.startsWith(p));
  return (
    <>
      <nav className="bottomnav">
        <NavLink to="/" end><Icon d={I.home} />الرئيسية</NavLink>
        <NavLink to="/quotes"><Icon d={I.quotes} />العروض</NavLink>
        <button className="plus" onClick={async () => nav(`/new/${(await createDraft(user)).id}`)}>
          <span className="disc"><Icon d={I.plus} /></span>عرض جديد
        </button>
        <NavLink to="/clients"><Icon d={I.clients} />العملاء</NavLink>
        <button className={open || inMore ? "on" : ""} onClick={() => setOpen(true)}><Icon d={I.more} />المزيد</button>
      </nav>
      {open && (
        <>
          <div className="sheet-backdrop" onClick={() => setOpen(false)} />
          <div className="sheet" role="dialog">
            <div className="grip" />
            <div className="user">{user.name}</div>
            <NavLink to="/companies">شركات التسويق والإنتاج</NavLink>
            <NavLink to="/dashboard">الملخص</NavLink>
            {isAdmin && <NavLink to="/admin">لوحة التحكم</NavLink>}
            <button className="item danger" onClick={logout}>تسجيل الخروج</button>
          </div>
        </>
      )}
    </>
  );
}

function Shell({ children }) {
  const { user, isAdmin, logout } = useAuth();
  const loc = useLocation();
  const focus = loc.pathname.startsWith("/new/");
  return (
    <div className={`shell${focus ? " focus" : ""}`}>
      <header className="topbar">
        <Link to="/"><img className="logo" src={LOGO} alt="PLAN C" /></Link>
        <nav>
          <NavLink to="/" end>الرئيسية</NavLink>
          <NavLink to="/quotes">سجل العروض</NavLink>
          <NavLink to="/clients">العملاء</NavLink>
          <NavLink to="/companies">شركات التسويق والإنتاج</NavLink>
          <NavLink to="/dashboard">الملخص</NavLink>
          {isAdmin && <NavLink to="/admin">لوحة التحكم</NavLink>}
        </nav>
        <div className="who">
          {!CLOUD && <span className="badge st-expired">وضع تجريبي</span>}
          <span className="name">{user.name}</span>
          <button className="lq sm" onClick={logout}>خروج</button>
        </div>
      </header>
      <main>{children}</main>
      <BottomNav isAdmin={isAdmin} user={user} logout={logout} />
      <Toaster />
    </div>
  );
}

function Gate() {
  const { user, isAdmin } = useAuth();
  if (user === undefined) return <div className="empty">...</div>;
  if (!user) return <Login />;
  return (
    <Shell>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/new/:id" element={<Wizard />} />
        <Route path="/quote/:id" element={<Editor />} />
        <Route path="/quotes" element={<Quotes />} />
        <Route path="/clients" element={<Clients />} />
        <Route path="/companies" element={<Companies />} />
        <Route path="/dashboard" element={<Dashboard />} />
        {isAdmin && <Route path="/admin" element={<Admin />} />}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Shell>
  );
}

export default function App() {
  useEffect(() => { document.documentElement.dataset.theme = THEME; }, []);
  return (
    <AuthProvider>
      <HashRouter>
        <Gate />
      </HashRouter>
    </AuthProvider>
  );
}
