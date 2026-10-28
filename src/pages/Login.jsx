import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth.jsx";
import { CLOUD } from "../lib/store.js";
import { resetPassword } from "../lib/firebase.js";
import { logoNavy, logoWhite } from "../theme.js";
import { Footer } from "../ui.jsx";
import { errorText } from "../lib/notify.js";

const authError = (x) => {
  const c = String(x?.code || "");
  return c.includes("too-many-requests") ? "محاولات كثيرة، انتظر قليلا ثم حاول مرة أخرى."
    : c.includes("operation-not-allowed") || c.includes("admin-restricted") ? "الدخول بالاسم غير مفعّل بعد. فعّل Anonymous في Firebase."
    : c.includes("network") ? errorText(x)
    : null;
};

// Team members enter with their name and the team code, nothing to sign up for.
export default function Login() {
  const { enter, notice } = useAuth();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setErr(""); setBusy(true);
    try { await enter(name.trim(), code.trim()); }
    catch (x) { setErr(authError(x) || errorText(x)); }
    finally { setBusy(false); }
  }

  return (
    <>
    <form className="login card" onSubmit={submit}>
      <img className="logo-on-light" src={logoNavy} alt="PLAN C" width="129" height="60" />
      <img className="logo-on-dark" src={logoWhite} alt="" width="129" height="60" />
      <h1>عروض أسعار PLAN C</h1>
      {!CLOUD && <p className="sub" style={{ textAlign: "center", margin: 0 }}>وضع تجريبي: البيانات تحفظ في هذا المتصفح فقط حتى يُربط Firebase.</p>}
      <label className="f">اسمك<input className="in" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} required /></label>
      {CLOUD && <label className="f">رمز الفريق<input className="in" type="password" dir="ltr" autoComplete="current-password" value={code} onChange={(e) => setCode(e.target.value)} required /></label>}
      {(err || notice) && <div className="err" role="alert">{err || notice}</div>}
      <button className="lq primary" disabled={busy}>{busy ? "جار الدخول..." : "دخول"}</button>
      <div className="alt-entry"><Link to="/admin">دخول لوحة التحكم</Link></div>
    </form>
    <Footer />
    </>
  );
}

// Only the dashboard asks for email and password.
export function AdminLogin({ alone }) {
  const { login, user, notice } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setErr(""); setBusy(true);
    try { await login(email.trim(), password); }
    catch (x) { setErr(authError(x) || "البريد أو كلمة المرور غير صحيحة."); }
    finally { setBusy(false); }
  }

  const form = (
    <form className="login card" onSubmit={submit}>
      <img className="logo-on-light" src={logoNavy} alt="PLAN C" width="129" height="60" />
      <img className="logo-on-dark" src={logoWhite} alt="" width="129" height="60" />
      <h1>لوحة التحكم</h1>
      <p className="sub" style={{ textAlign: "center", margin: 0 }}>للمدير فقط: ادخل بالبريد وكلمة المرور.</p>
      {user?.email && <div className="err" role="alert">هذا الحساب ليس حساب مدير.</div>}
      <label className="f">البريد الإلكتروني<input className="in" type="email" dir="ltr" autoComplete="username" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
      <label className="f">كلمة المرور<input className="in" type="password" dir="ltr" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
      {(err || (alone && notice)) && <div className={err.startsWith("أرسلنا") ? "ok-msg" : "err"} role="alert">{err || notice}</div>}
      <button className="lq primary" disabled={busy}>{busy ? "جار الدخول..." : "دخول"}</button>
      {CLOUD && (
        <button type="button" className="lq sm" onClick={() => {
          if (!email.trim()) return setErr("اكتب بريدك أولا ثم اضغط نسيت كلمة المرور.");
          resetPassword(email.trim()).then(() => setErr("أرسلنا رابط تعيين كلمة المرور إلى بريدك.")).catch((x) => setErr(errorText(x)));
        }}>
          نسيت كلمة المرور
        </button>
      )}
      {alone && <div className="alt-entry"><Link to="/">الدخول بالاسم</Link></div>}
    </form>
  );
  return alone ? <>{form}<Footer /></> : form;
}
