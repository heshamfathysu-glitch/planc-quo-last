import { lazy, Suspense, useEffect, useState } from "react";
import { HashRouter, Routes, Route, NavLink, Link, useLocation, useNavigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth.jsx";
import { CLOUD, DEMO } from "./lib/store.js";
import { Toaster, Loading, Footer } from "./ui.jsx";
import { createDraft } from "./lib/newQuote.js";
import { THEME, LOGO, BACKGROUND } from "./theme.js";
import NeatBackground from "./NeatBackground.jsx";
import Intro from "./Intro.jsx";
import Login from "./pages/Login.jsx";
import Home from "./pages/Home.jsx";
import NotFound from "./pages/NotFound.jsx";

// heavier pages (PDF engine, admin tools) load on first visit
const Wizard = lazy(() => import("./pages/Wizard.jsx"));
const Editor = lazy(() => import("./pages/Editor.jsx"));
const Quotes = lazy(() => import("./pages/Quotes.jsx"));
const Clients = lazy(() => import("./pages/Clients.jsx"));
const Companies = lazy(() => import("./pages/Companies.jsx"));
const Dashboard = lazy(() => import("./pages/Dashboard.jsx"));
const Admin = lazy(() => import("./pages/Admin.jsx"));

const TITLES = [
  ["/new/", "عرض سعر جديد"],
  ["/quote/", "تعديل عرض السعر"],
  ["/quotes", "سجل العروض"],
  ["/clients", "سجل العملاء"],
  ["/companies", "شركات التسويق والإنتاج"],
  ["/dashboard", "ملخص العروض"],
  ["/admin", "لوحة التحكم"],
];
const APP_TITLE = "عروض أسعار PLAN C";
function usePageTitle(pathname) {
  useEffect(() => {
    const hit = pathname === "/" ? null : TITLES.find(([p]) => pathname.startsWith(p));
    document.title = hit ? `${hit[1]} | ${APP_TITLE}` : pathname === "/" ? APP_TITLE : `الصفحة غير موجودة | ${APP_TITLE}`;
  }, [pathname]);
}

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
  // close right away: the next page may still be loading in the background
  const close = () => setOpen(false);
  useEffect(close, [loc.pathname]);
  useEffect(() => {
    if (!open) return;
    const k = (e) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open]);
  const inMore = ["/companies", "/dashboard", "/admin"].some((p) => loc.pathname.startsWith(p));
  return (
    <>
      <nav className="bottomnav" aria-label="التنقل الرئيسي">
        <NavLink to="/" end><Icon d={I.home} />الرئيسية</NavLink>
        <NavLink to="/quotes"><Icon d={I.quotes} />العروض</NavLink>
        <button className="plus" aria-label="إنشاء عرض سعر جديد" onClick={async () => nav(`/new/${(await createDraft(user)).id}`)}>
          <span className="disc"><Icon d={I.plus} /></span>عرض جديد
        </button>
        <NavLink to="/clients"><Icon d={I.clients} />العملاء</NavLink>
        <button className={open || inMore ? "on" : ""} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}><Icon d={I.more} />المزيد</button>
      </nav>
      {open && (
        <>
          <div className="sheet-backdrop" onClick={() => setOpen(false)} />
          <div className="sheet" role="dialog" aria-modal="true" aria-label="المزيد">
            <div className="grip" />
            <div className="user">{user.name}</div>
            <NavLink to="/companies" onClick={close}>شركات التسويق والإنتاج</NavLink>
            <NavLink to="/dashboard" onClick={close}>الملخص</NavLink>
            {isAdmin && <NavLink to="/admin" onClick={close}>لوحة التحكم</NavLink>}
            <button className="item danger" onClick={logout}>{DEMO ? "إنهاء التجربة" : "تسجيل الخروج"}</button>
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
  usePageTitle(loc.pathname);
  return (
    <div className={`shell${focus ? " focus" : ""}`}>
      <header className="topbar">
        <Link to="/" aria-label="الصفحة الرئيسية"><img className="logo" src={LOGO} alt="PLAN C" width="69" height="32" /></Link>
        <nav aria-label="القائمة">
          <NavLink to="/" end>الرئيسية</NavLink>
          <NavLink to="/quotes">سجل العروض</NavLink>
          <NavLink to="/clients">العملاء</NavLink>
          <NavLink to="/companies">شركات التسويق والإنتاج</NavLink>
          <NavLink to="/dashboard">الملخص</NavLink>
          {isAdmin && <NavLink to="/admin">لوحة التحكم</NavLink>}
        </nav>
        <div className="who">
          {!CLOUD && <span className="badge st-expired">{DEMO ? "دخول تجريبي" : "وضع تجريبي"}</span>}
          <span className="name">{user.name}</span>
          <button className="lq sm" onClick={logout}>{DEMO ? "إنهاء التجربة" : "خروج"}</button>
        </div>
      </header>
      <main id="main"><Suspense fallback={<Loading />}>{children}</Suspense><Footer /></main>
      <BottomNav isAdmin={isAdmin} user={user} logout={logout} />
      <Toaster />
    </div>
  );
}

function Gate() {
  const { user, isAdmin } = useAuth();
  if (user === undefined) return <Loading />;
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
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Shell>
  );
}

export default function App() {
  useEffect(() => { document.documentElement.dataset.theme = THEME; }, []);
  return (
    <AuthProvider>
      <Intro />
      {BACKGROUND === "neat" ? <NeatBackground /> : (
        <div className="photo-bg" aria-hidden="true"><i className="bg-blue" /><i className="bg-orange" /><i className="bg-green" /></div>
      )}
      <HashRouter>
        <Gate />
      </HashRouter>
    </AuthProvider>
  );
}
