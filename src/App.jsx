import { HashRouter, Routes, Route, NavLink, Navigate, Link } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth.jsx";
import { CLOUD } from "./lib/store.js";
import { Toaster } from "./ui.jsx";
import logoWhite from "./assets/logo_white.png";
import Login from "./pages/Login.jsx";
import Home from "./pages/Home.jsx";
import Wizard from "./pages/Wizard.jsx";
import Editor from "./pages/Editor.jsx";
import Quotes from "./pages/Quotes.jsx";
import Clients from "./pages/Clients.jsx";
import Companies from "./pages/Companies.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Admin from "./pages/Admin.jsx";

function Shell({ children }) {
  const { user, isAdmin, logout } = useAuth();
  return (
    <div className="shell">
      <header className="topbar">
        <Link to="/"><img className="logo" src={logoWhite} alt="PLAN C" /></Link>
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
          <span>{user.name}</span>
          <button className="lq sm" onClick={logout}>خروج</button>
        </div>
      </header>
      <main>{children}</main>
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
  return (
    <AuthProvider>
      <HashRouter>
        <Gate />
      </HashRouter>
    </AuthProvider>
  );
}
