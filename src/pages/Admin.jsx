import { useRef, useState } from "react";
import { useSetting, setSetting, list, put, useCollection, CLOUD } from "../lib/store.js";
import { createUser } from "../lib/firebase.js";
import { DEFAULT_TERMS } from "../data/catalog.js";
import { MASTER_THEME } from "../pdf/engine.js";
import { toast, download } from "../ui.jsx";
import { useAuth } from "../auth.jsx";

const TABS = [
  { id: "pricing", label: "قائمة الأسعار" },
  { id: "terms", label: "مكتبة الشروط" },
  { id: "theme", label: "الألوان والخط" },
  { id: "users", label: "المستخدمون" },
  { id: "backup", label: "نسخ احتياطي" },
];

export default function Admin() {
  const [tab, setTab] = useState("pricing");
  return (
    <div>
      <div className="page-head"><h1>لوحة التحكم</h1></div>
      <div className="tabs" style={{ marginBottom: 20 }}>
        {TABS.map((t) => <button key={t.id} className={`tab${tab === t.id ? " on" : ""}`} onClick={() => setTab(t.id)}>{t.label}</button>)}
      </div>
      {tab === "pricing" && <Pricing />}
      {tab === "terms" && <Terms />}
      {tab === "theme" && <Theme />}
      {tab === "users" && <Users />}
      {tab === "backup" && <Backup />}
    </div>
  );
}

function Pricing() {
  const pricing = useSetting("pricing", null);
  const ref = useRef();
  const [draft, setDraft] = useState(null);
  const p = draft || pricing;

  async function load(file) {
    try {
      const j = JSON.parse(await file.text());
      if (!j.services) throw new Error();
      await setSetting("pricing", j);
      setDraft(null);
      toast("تم تحميل قائمة الأسعار");
    } catch { toast("الملف غير صالح"); }
  }
  const setTier = (k, i, price) => setDraft({ ...p, services: { ...p.services, [k]: { ...p.services[k], tiers: p.services[k].tiers.map((t, j) => (j === i ? { ...t, price: Number(price) || 0 } : t)) } } });

  return (
    <div className="card" style={{ display: "grid", gap: 16 }}>
      <p className="sub" style={{ margin: 0 }}>قائمة داخلية لا تظهر للعملاء ولا تُحفظ في كود التطبيق. تُحسب منها أسعار التصوير والريلز تلقائيا.</p>
      <div className="row">
        <button className="lq" onClick={() => ref.current.click()}>رفع ملف pricing.json</button>
        {draft && <button className="lq primary" onClick={async () => { await setSetting("pricing", draft); setDraft(null); toast("تم الحفظ"); }}>حفظ التعديلات</button>}
        <input ref={ref} type="file" accept=".json" hidden onChange={(e) => e.target.files[0] && load(e.target.files[0])} />
      </div>
      {!p ? <div className="warn">لم تُضف قائمة الأسعار بعد.</div> : Object.entries(p.services).map(([k, s]) => (
        <div key={k} className="block">
          <b>{s.title}</b>
          <div className="row">
            {s.tiers.map((t, i) => (
              <label key={i} className="f" style={{ width: 150 }}>
                {t.min_qty ?? 1} – {t.max_qty ?? "∞"}
                <input className="in" type="number" value={t.price} onChange={(e) => setTier(k, i, e.target.value)} />
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function Terms() {
  const saved = useSetting("terms", DEFAULT_TERMS);
  const [items, setItems] = useState(null);
  const t = items || saved;
  const upd = (i, p) => setItems(t.map((x, j) => (j === i ? { ...x, ...p } : x)));
  return (
    <div className="card" style={{ display: "grid", gap: 12 }}>
      <p className="sub" style={{ margin: 0 }}>البنود المفعلة تضاف تلقائيا لكل عرض جديد، والبقية متاحة للإضافة من المحرر.</p>
      {t.map((x, i) => (
        <div key={i} className="block">
          <div className="row">
            <input className="in" style={{ flex: 1, width: "auto" }} value={x.title} onChange={(e) => upd(i, { title: e.target.value })} />
            <label className="row sub"><input type="checkbox" checked={x.default !== false} onChange={(e) => upd(i, { default: e.target.checked })} /> تلقائي</label>
            <button className="lq icon sm danger" onClick={() => setItems(t.filter((_, j) => j !== i))}>×</button>
          </div>
          <textarea className="in" value={x.text} onChange={(e) => upd(i, { text: e.target.value })} />
        </div>
      ))}
      <div className="row">
        <button className="lq" onClick={() => setItems([...t, { title: "", text: "", default: false }])}>+ بند</button>
        {items && <button className="lq primary" onClick={async () => { await setSetting("terms", items); setItems(null); toast("تم الحفظ"); }}>حفظ</button>}
      </div>
    </div>
  );
}

const hex = (rgb) => "#" + rgb.map((v) => v.toString(16).padStart(2, "0")).join("");
const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const ROLES = [
  ["navy", "اللون الرئيسي (الشريط، العناوين، الإجماليات)"],
  ["ink", "النص الأساسي"],
  ["muted", "النص الثانوي"],
  ["line", "الخطوط"],
  ["head", "رأس الخيار والأرقام"],
  ["panel", "مربعات البيانات والاعتماد"],
  ["red", "الخصم"],
];

function Theme() {
  const saved = useSetting("theme", null);
  const palette = useSetting("palette", []);
  const [th, setTh] = useState(null);
  const t = { ...MASTER_THEME, ...(th || saved || {}) };
  const [newColor, setNewColor] = useState("#05034d");

  return (
    <div className="card" style={{ display: "grid", gap: 16 }}>
      <p className="sub" style={{ margin: 0 }}>القالب الأصلي هو الافتراضي. أي تغيير هنا يطبق على كل العروض، أما المقاسات وأحجام الخطوط والشعار فثابتة.</p>
      <div className="grid g2">
        {ROLES.map(([k, l]) => (
          <label key={k} className="f">{l}
            <div className="row">
              <input type="color" value={hex(t[k])} onChange={(e) => setTh({ ...t, [k]: rgb(e.target.value) })} />
              <div className="chips">
                {palette.map((c) => <button key={c} type="button" title={c} onClick={() => setTh({ ...t, [k]: rgb(c) })} style={{ width: 22, height: 22, borderRadius: 6, border: "1px solid #fff4", background: c, cursor: "pointer" }} />)}
              </div>
            </div>
          </label>
        ))}
        <label className="f">وزن خط العناوين والإجماليات (IBM Plex Sans Arabic)
          <select className="in" value={t.titleWeight} onChange={(e) => setTh({ ...t, titleWeight: e.target.value })}>
            <option value="regular">Regular (كالقالب الأصلي)</option>
            <option value="bold">Bold</option>
          </select>
        </label>
      </div>
      <div className="row">
        <span className="sub">لوحة الألوان المعتمدة:</span>
        <input type="color" value={newColor} onChange={(e) => setNewColor(e.target.value)} />
        <button className="lq sm" onClick={() => setSetting("palette", [...new Set([...palette, newColor])])}>+ إضافة لون</button>
        {palette.map((c) => <button key={c} className="badge" style={{ border: 0, cursor: "pointer", background: c }} title="حذف" onClick={() => setSetting("palette", palette.filter((x) => x !== c))}>{c} ×</button>)}
      </div>
      <div className="row">
        {th && <button className="lq primary" onClick={async () => { await setSetting("theme", th); setTh(null); toast("تم الحفظ"); }}>حفظ</button>}
        <button className="lq" onClick={async () => { await setSetting("theme", null); setTh(null); toast("تمت العودة للقالب الأصلي"); }}>العودة للقالب الأصلي</button>
      </div>
    </div>
  );
}

function Users() {
  const { user } = useAuth();
  const [users] = useCollection("users");
  const [f, setF] = useState({ role: "user" });
  const [err, setErr] = useState("");
  if (!CLOUD) return <div className="card sub">إدارة المستخدمين تعمل بعد ربط Firebase. حاليا الدخول تجريبي على هذا المتصفح فقط.</div>;
  async function add(e) {
    e.preventDefault(); setErr("");
    try { await createUser(f); setF({ role: "user" }); toast("تمت إضافة المستخدم"); }
    catch (x) { setErr(x.code === "auth/email-already-in-use" ? "البريد مستخدم بالفعل" : x.code === "auth/weak-password" ? "كلمة المرور قصيرة (6 أحرف على الأقل)" : String(x.message)); }
  }
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <form className="card grid g4" onSubmit={add}>
        <input className="in" placeholder="الاسم" value={f.name || ""} onChange={(e) => setF({ ...f, name: e.target.value })} required />
        <input className="in" type="email" dir="ltr" placeholder="البريد" value={f.email || ""} onChange={(e) => setF({ ...f, email: e.target.value })} required />
        <input className="in" type="text" dir="ltr" placeholder="كلمة مرور مؤقتة" value={f.password || ""} onChange={(e) => setF({ ...f, password: e.target.value })} required />
        <select className="in" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}><option value="user">مستخدم</option><option value="admin">أدمن</option></select>
        <button className="lq primary">إضافة مستخدم</button>
        {err && <div className="err">{err}</div>}
      </form>
      <div className="card tablewrap">
        <table className="t">
          <thead><tr><th>الاسم</th><th>البريد</th><th>الصلاحية</th></tr></thead>
          <tbody>
            {(users || []).map((u) => (
              <tr key={u.id}>
                <td>{u.name}</td><td dir="ltr" style={{ textAlign: "right" }}>{u.email}</td>
                <td>
                  <select className="in" style={{ width: "auto" }} value={u.role} disabled={u.id === user.uid} onChange={(e) => put("users", { ...u, role: e.target.value }, user)}>
                    <option value="user">مستخدم</option><option value="admin">أدمن</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const COLS = ["quotes", "clients", "companies", "settings"];
function Backup() {
  const ref = useRef();
  const { user } = useAuth();
  async function exp() {
    const out = {};
    for (const c of COLS) out[c] = await list(c);
    download(`planc-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(out, null, 1), "application/json");
  }
  async function imp(file) {
    const j = JSON.parse(await file.text());
    let n = 0;
    for (const c of COLS) for (const o of j[c] || []) { await put(c, o, user); n++; }
    toast(`تمت استعادة ${n} سجل`);
  }
  return (
    <div className="card row">
      <button className="lq" onClick={exp}>تنزيل نسخة احتياطية</button>
      <button className="lq" onClick={() => ref.current.click()}>استعادة من نسخة</button>
      <input ref={ref} type="file" accept=".json" hidden onChange={(e) => e.target.files[0] && imp(e.target.files[0])} />
      <span className="sub">مفيد لنقل بيانات الوضع التجريبي إلى Firebase بعد الربط.</span>
    </div>
  );
}
