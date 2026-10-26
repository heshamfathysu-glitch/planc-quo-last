import { useState } from "react";
import { useAuth } from "../auth.jsx";
import { CLOUD } from "../lib/store.js";
import { enterDemo } from "../lib/demo.js";
import { resetPassword } from "../lib/firebase.js";
import { LOGO } from "../theme.js";
import { Footer } from "../ui.jsx";
import { errorText } from "../lib/notify.js";

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
    catch (x) {
      const c = String(x?.code || "");
      setErr(c.includes("too-many-requests") ? "محاولات كثيرة، انتظر قليلا ثم حاول مرة أخرى."
        : c.includes("network") ? errorText(x)
        : "البريد أو كلمة المرور غير صحيحة.");
    }
    finally { setBusy(false); }
  }

  return (
    <>
    <form className="login card" onSubmit={submit}>
      <img src={LOGO} alt="PLAN C" width="129" height="60" />
      <h1>عروض أسعار PLAN C</h1>
      {!CLOUD && (
        <>
          <p className="sub" style={{ textAlign: "center", margin: 0 }}>وضع تجريبي: البيانات تحفظ في هذا المتصفح فقط حتى يُربط Firebase.</p>
          <label className="f">الاسم<input className="in" value={name} onChange={(e) => setName(e.target.value)} required /></label>
        </>
      )}
      <label className="f">البريد الإلكتروني<input className="in" type="email" dir="ltr" autoComplete="username" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} required={CLOUD} /></label>
      {CLOUD && <label className="f">كلمة المرور<input className="in" type="password" dir="ltr" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>}
      {err && <div className={err.startsWith("أرسلنا") ? "ok-msg" : "err"} role="alert">{err}</div>}
      <button className="lq primary" disabled={busy}>{busy ? "جار الدخول..." : "دخول"}</button>
      {CLOUD && (
        <button type="button" className="lq sm" onClick={() => {
          if (!email.trim()) return setErr("اكتب بريدك أولا ثم اضغط نسيت كلمة المرور.");
          resetPassword(email.trim()).then(() => setErr("أرسلنا رابط تعيين كلمة المرور إلى بريدك.")).catch((x) => setErr(errorText(x)));
        }}>
          نسيت كلمة المرور
        </button>
      )}
      {CLOUD && (
        <div className="demo-entry">
          <span className="sub">أو جرّب الموقع بدون حساب</span>
          <button type="button" className="lq" onClick={enterDemo}>دخول تجريبي مباشر</button>
          <span className="sub small">البيانات في التجربة تُحفظ على هذا الجهاز فقط ولا تصل لقاعدة البيانات.</span>
        </div>
      )}
    </form>
    <Footer />
    </>
  );
}
