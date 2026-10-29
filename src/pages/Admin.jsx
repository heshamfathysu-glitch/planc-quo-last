import { useEffect, useRef, useState } from "react";
import { useSetting, setSetting, list, put, remove, useCollection, CLOUD } from "../lib/store.js";
import { createUser, getTeamCode, setTeamCode } from "../lib/firebase.js";
import { DEFAULT_TERMS } from "../data/catalog.js";
import { themeOf } from "../pdf/engine.js";
import { toast, download, ConfirmButton } from "../ui.jsx";
import { errorText } from "../lib/notify.js";
import { useAuth } from "../auth.jsx";

const TABS = [
  { id: "pricing", label: "قائمة الأسعار" },
  { id: "guide", label: "دليل الأسعار" },
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
      {tab === "guide" && <Guide />}
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
    } catch (e) { if (!e?.notified) toast("الملف غير صالح. يجب أن يكون pricing.json فيه قائمة الخدمات.", "error"); }
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

const SERVICE_TITLES = { photo: "تصوير فوتوغرافي", video: "تصوير فيديو", website: "موقع إلكتروني", landing: "صفحة هبوط", consult: "استشارة تسويقية", identity: "هوية بصرية", accounts: "إدارة حسابات السوشيال ميديا", package: "باقة مخصصة" };

// price ranges the team sees while making a quote (Wizard.jsx PriceGuide)
function Guide() {
  const saved = useSetting("priceGuide", null);
  const ref = useRef();
  const [draft, setDraft] = useState(null);
  const g = draft || saved || { v: 1, sections: [] };

  async function load(file) {
    try {
      const j = JSON.parse(await file.text());
      if (!Array.isArray(j.sections)) throw new Error();
      await setSetting("priceGuide", j);
      setDraft(null);
      toast("تم تحميل دليل الأسعار");
    } catch (e) { if (!e?.notified) toast("الملف غير صالح. يجب أن يكون price-guide.json فيه أقسام الخدمات.", "error"); }
  }
  const secOf = (sid) => g.sections.find((x) => x.service === sid);
  const setItems = (sid, items) => {
    const has = secOf(sid);
    const sections = has
      ? g.sections.map((x) => (x.service === sid ? { ...x, items } : x))
      : [...g.sections, { service: sid, title: SERVICE_TITLES[sid], items }];
    setDraft({ ...g, sections });
  };
  const numOrNull = (v) => (v === "" ? null : Number(v) || 0);

  return (
    <div className="card" style={{ display: "grid", gap: 16 }}>
      <p className="sub" style={{ margin: 0 }}>نطاقات أسعار يراها الفريق أثناء إنشاء العرض، في خطوة كل خدمة وقبل زر إنشاء عرض السعر. لا تظهر في ملف العرض ولا تُحفظ في كود التطبيق. فعّل "تكلفة" للبنود التي هي تكلفة داخلية.</p>
      <div className="row">
        <button className="lq" onClick={() => ref.current.click()}>رفع ملف price-guide.json</button>
        {draft && <button className="lq primary" onClick={async () => { await setSetting("priceGuide", draft); setDraft(null); toast("تم الحفظ"); }}>حفظ التعديلات</button>}
        <input ref={ref} type="file" accept=".json" hidden onChange={(e) => e.target.files[0] && load(e.target.files[0])} />
      </div>
      {Object.entries(SERVICE_TITLES).map(([sid, title]) => {
        const items = secOf(sid)?.items || [];
        const upd = (i, p) => setItems(sid, items.map((it, j) => (j === i ? { ...it, ...p } : it)));
        return (
          <div key={sid} className="block">
            <b>{title}</b>
            {items.map((it, i) => (
              <div key={i} className="row" style={{ alignItems: "end" }}>
                <label className="f" style={{ flex: "2 1 200px" }}>البند<input className="in" value={it.label || ""} onChange={(e) => upd(i, { label: e.target.value })} /></label>
                <label className="f" style={{ flex: "1 1 90px" }}>من<input className="in" type="number" dir="ltr" value={it.from ?? ""} onChange={(e) => upd(i, { from: numOrNull(e.target.value) })} /></label>
                <label className="f" style={{ flex: "1 1 90px" }}>إلى<input className="in" type="number" dir="ltr" value={it.to ?? ""} onChange={(e) => upd(i, { to: numOrNull(e.target.value) })} /></label>
                <label className="f" style={{ flex: "1 1 110px" }}>الوحدة<input className="in" value={it.unit || ""} onChange={(e) => upd(i, { unit: e.target.value })} /></label>
                <label className="f" style={{ flex: "2 1 160px" }}>ملاحظة<input className="in" value={it.note || ""} onChange={(e) => upd(i, { note: e.target.value })} /></label>
                <label className="check" style={{ display: "flex", gap: 6, alignItems: "center", minHeight: 46 }}><input type="checkbox" checked={!!it.cost} onChange={(e) => upd(i, { cost: e.target.checked })} />تكلفة</label>
                <button className="lq sm danger" onClick={() => setItems(sid, items.filter((_, j) => j !== i))}>حذف</button>
              </div>
            ))}
            <button className="lq sm" style={{ justifySelf: "start" }} onClick={() => setItems(sid, [...items, { label: "" }])}>+ بند</button>
          </div>
        );
      })}
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
            <input className="in auto" style={{ flex: 1 }} value={x.title} onChange={(e) => upd(i, { title: e.target.value })} />
            <label className="row sub"><input type="checkbox" checked={x.default !== false} onChange={(e) => upd(i, { default: e.target.checked })} /> تلقائي</label>
            <button className="lq icon sm danger" aria-label="حذف البند" onClick={() => setItems(t.filter((_, j) => j !== i))}>×</button>
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
  ["bar", "الشريط العلوي"],
  ["ink", "النص الأساسي والعناوين"],
  ["muted", "النص الثانوي والتواريخ"],
  ["line", "الخطوط وحدود الصناديق"],
  ["box", "صندوق النقاط ومربع الاعتماد"],
  ["box2", "الصندوق الأزرق"],
  ["banner", "خلفية شريط الخصم"],
  ["bannerInk", "نص شريط الخصم"],
  ["totalBg", "خلفية الإجمالي"],
  ["accent", "مبلغ الإجمالي والعناوين الخضراء"],
];

function Theme() {
  const saved = useSetting("theme", null);
  const palette = useSetting("palette", []);
  const [th, setTh] = useState(null);
  const t = themeOf(th || saved); // a theme saved for the earlier template no longer applies
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
                {palette.map((c) => <button key={c} type="button" title={c} onClick={() => setTh({ ...t, [k]: rgb(c) })} style={{ width: 22, height: 22, borderRadius: 6, border: "1px solid var(--line)", background: c, cursor: "pointer" }} />)}
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
        <button className="lq sm" onClick={() => setSetting("palette", [...new Set([...palette, newColor])]).then(() => toast("تمت إضافة اللون"))}>+ إضافة لون</button>
        {palette.map((c) => <button key={c} className="badge" style={{ border: 0, cursor: "pointer", background: c }} title="حذف" aria-label={`حذف اللون ${c}`} onClick={() => setSetting("palette", palette.filter((x) => x !== c)).then(() => toast("تم حذف اللون"))}>{c} ×</button>)}
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
    catch (x) { setErr(x.code === "auth/email-already-in-use" ? "البريد مستخدم بالفعل." : x.code === "auth/weak-password" ? "كلمة المرور قصيرة (6 أحرف على الأقل)." : x.code === "auth/invalid-email" ? "صيغة البريد غير صحيحة." : errorText(x)); }
  }
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <TeamAccess />
      <p className="sub" style={{ margin: "8px 0 0" }}>حسابات بالبريد وكلمة المرور (للمدير أو من يدخل لوحة التحكم)</p>
      <form className="card grid g4" onSubmit={add}>
        <input className="in" aria-label="الاسم" placeholder="الاسم" value={f.name || ""} onChange={(e) => setF({ ...f, name: e.target.value })} required />
        <input className="in" type="email" dir="ltr" aria-label="البريد" autoComplete="off" placeholder="البريد" value={f.email || ""} onChange={(e) => setF({ ...f, email: e.target.value })} required />
        <input className="in" type="text" dir="ltr" aria-label="كلمة مرور مؤقتة" autoComplete="new-password" placeholder="كلمة مرور مؤقتة" value={f.password || ""} onChange={(e) => setF({ ...f, password: e.target.value })} required />
        <select className="in" aria-label="الصلاحية" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}><option value="user">مستخدم</option><option value="admin">أدمن</option></select>
        <button className="lq primary">إضافة مستخدم</button>
        {err && <div className="err">{err}</div>}
      </form>
      <div className="card tablewrap">
        <table className="t cards">
          <thead><tr><th>الاسم</th><th>البريد</th><th>الصلاحية</th></tr></thead>
          <tbody>
            {(users || []).map((u) => (
              <tr key={u.id}>
                <td className="lead">{u.name}</td><td className="ltr-cell sub"><a href={`mailto:${u.email}`}>{u.email}</a></td>
                <td className="end">
                  <select className="in auto" value={u.role} disabled={u.id === user.uid} aria-label={`صلاحية ${u.name}`} onChange={(e) => put("users", { ...u, role: e.target.value }, user).then(() => toast("تم تحديث الصلاحية"))}>
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

// Team members enter with their name and this one code, no accounts.
function TeamAccess() {
  const { user } = useAuth();
  const [members] = useCollection("members");
  const [code, setCode] = useState("");
  const [saved, setSaved] = useState(null);
  const [show, setShow] = useState(false);
  useEffect(() => { getTeamCode().then((c) => { setSaved(c); setCode((cur) => cur || c); }, () => setSaved("")); }, []);
  async function save(e) {
    e.preventDefault();
    const c = code.trim();
    if (c.length < 4) return toast("اجعل الرمز 4 أحرف أو أرقام على الأقل.", "error");
    try { await setTeamCode(c); setSaved(c); toast("تم حفظ رمز الفريق"); } catch (x) { toast(errorText(x), "error"); }
  }
  async function signOutAll() {
    for (const m of members || []) await remove("members", m.id);
    toast("تم إخراج الجميع. يدخلون من جديد بالرمز الحالي.");
  }
  const sorted = [...(members || [])].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  return (
    <div className="card" style={{ display: "grid", gap: 14 }}>
      <form className="row" style={{ gap: 10, flexWrap: "wrap", alignItems: "end" }} onSubmit={save}>
        <label className="f" style={{ flex: "1 1 220px" }}>رمز دخول الفريق
          <span className="sub">يكتبه كل شخص مع اسمه مرة واحدة على جهازه. من لا يعرفه لا يرى شيئا.</span>
          <input className="in" dir="ltr" type={show ? "text" : "password"} autoComplete="off" value={code} onChange={(e) => setCode(e.target.value)} placeholder={saved === "" ? "لم يُحدد بعد" : ""} />
        </label>
        <button type="button" className="lq" onClick={() => setShow(!show)}>{show ? "إخفاء" : "إظهار"}</button>
        <button className="lq primary" disabled={code.trim() === (saved || "")}>حفظ الرمز</button>
      </form>
      {saved === "" && <div className="warn">لم يُحدد رمز بعد، لذلك لا يستطيع أحد الدخول بالاسم. اكتب رمزا واحفظه.</div>}
      <div className="row" style={{ gap: 10 }}>
        <b>دخلوا بالاسم ({sorted.length})</b>
        <span className="spacer" />
        {sorted.length > 0 && <ConfirmButton className="lq sm danger" ask="اضغط مرة أخرى لإخراج الجميع" onConfirm={signOutAll}>إخراج الجميع</ConfirmButton>}
      </div>
      {sorted.length > 0 && (
        <div className="tablewrap">
          <table className="t cards">
            <thead><tr><th>الاسم</th><th>تاريخ الدخول</th><th></th></tr></thead>
            <tbody>
              {sorted.map((m) => (
                <tr key={m.id}>
                  <td className="lead">{m.name}</td>
                  <td className="sub">{String(m.createdAt || "").slice(0, 10)}</td>
                  <td className="end"><button className="lq sm danger" onClick={() => remove("members", m.id).then(() => toast(`تم إخراج ${m.name}`), () => {})} disabled={m.id === user.uid}>إخراج</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="sub" style={{ margin: 0 }}>لإبعاد شخص: غيّر الرمز ثم اضغط «إخراج الجميع»، فيدخل الباقون بالرمز الجديد.</p>
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
    toast("تم تنزيل النسخة الاحتياطية");
  }
  async function imp(file) {
    let j;
    try { j = JSON.parse(await file.text()); } catch { return toast("الملف غير صالح. اختر ملف نسخة احتياطية بصيغة JSON.", "error"); }
    let n = 0;
    for (const c of COLS) for (const o of j[c] || []) { await put(c, o, user); n++; }
    toast(`تمت استعادة ${n} سجل`);
  }
  return (
    <div className="grid">
      <div className="card row">
        <button className="lq" onClick={exp}>تنزيل نسخة احتياطية</button>
        <button className="lq" onClick={() => ref.current.click()}>استعادة من نسخة</button>
        <input ref={ref} type="file" accept=".json" hidden onChange={(e) => e.target.files[0] && imp(e.target.files[0])} />
        <span className="sub">مفيد لنقل بيانات الوضع التجريبي إلى Firebase بعد الربط.</span>
      </div>
      <ClearQuotes />
    </div>
  );
}

// Start over: deletes every saved quote (clients, companies and settings stay).
function ClearQuotes() {
  const [quotes] = useCollection("quotes");
  const [busy, setBusy] = useState(false);
  const n = quotes?.length ?? 0;
  async function clear() {
    setBusy(true);
    try {
      for (const q of await list("quotes")) await remove("quotes", q.id);
      toast("تم حذف كل العروض");
    } catch { /* remove() already showed the error */ }
    setBusy(false);
  }
  return (
    <div className="card grid">
      <b>البدء من الصفر</b>
      <span className="sub">
        {CLOUD ? "يحذف كل العروض المحفوظة في قاعدة البيانات" : "يحذف كل العروض المحفوظة في هذا المتصفح"} ({n} عرض). العملاء والشركات والإعدادات تبقى كما هي.
        لا يمكن التراجع عن الحذف، فنزّل نسخة احتياطية أولا.
      </span>
      <div className="row">
        <ConfirmButton disabled={busy || !n} onConfirm={clear} ask={`اضغط مرة أخرى لحذف ${n} عرض`}>
          {busy ? "جار الحذف..." : "حذف كل العروض"}
        </ConfirmButton>
      </div>
    </div>
  );
}
