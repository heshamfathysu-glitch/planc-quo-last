import { useState } from "react";
import { useAuth } from "../auth.jsx";
import { CLOUD } from "../lib/store.js";
import { resetPassword } from "../lib/firebase.js";
import logoWhite from "../assets/logo_white.png";

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setErr(""); setBusy(true);
    try { await login(email.trim(), password, name.trim()); }
    catch { setErr("البريد أو كلمة المرور غير صحيحة"); }
    finally { setBusy(false); }
  }

  return (
    <form className="login card" onSubmit={submit}>
      <img src={logoWhite} alt="PLAN C" />
      <h1 style={{ fontSize: 22, textAlign: "center" }}>عروض أسعار PLAN C</h1>
      {!CLOUD && (
        <>
          <p className="sub" style={{ textAlign: "center", margin: 0 }}>وضع تجريبي: البيانات تحفظ في هذا المتصفح فقط حتى يُربط Firebase.</p>
          <label className="f">الاسم<input className="in" value={name} onChange={(e) => setName(e.target.value)} required /></label>
        </>
      )}
      <label className="f">البريد الإلكتروني<input className="in" type="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} required={CLOUD} /></label>
      {CLOUD && <label className="f">كلمة المرور<input className="in" type="password" dir="ltr" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>}
      {err && <div className="err">{err}</div>}
      <button className="lq primary" disabled={busy}>دخول</button>
      {CLOUD && (
        <button type="button" className="lq sm" onClick={() => email && resetPassword(email).then(() => setErr("أرسلنا رابط تعيين كلمة المرور إلى بريدك"))}>
          نسيت كلمة المرور
        </button>
      )}
    </form>
  );
}
