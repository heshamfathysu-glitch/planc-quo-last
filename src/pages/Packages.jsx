// Admin > الباقات: the fixed packages the team adds to a quote in one tap.
// Stored in Firestore settings/packages ({ v: 1, packages: [...] }), never in
// this public repository. Each package: title, a short Latin/Arabic line under
// it (eyebrow), price, what it includes, and "addon" for extras such as
// faster delivery.
import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth.jsx";
import { useSetting, setSetting, newId } from "../lib/store.js";
import { quoteFromPackage } from "../lib/quoteOps.js";
import { fmt } from "../lib/format.js";
import { toast, download, ConfirmButton } from "../ui.jsx";

const blank = () => ({ id: newId(), title: "", eyebrow: "", price: "", includes: [], addon: false });

function PackageForm({ init, onSave, onCancel }) {
  const [f, setF] = useState({ ...init, includesText: (init.includes || []).join("\n") });
  const ok = f.title.trim() && Number(f.price) >= 0 && f.price !== "";
  return (
    <form className="card pkg-form" onSubmit={(e) => {
      e.preventDefault();
      if (!ok) return;
      const { includesText, ...rest } = f;
      onSave({ ...rest, title: f.title.trim(), eyebrow: f.eyebrow.trim(), price: Number(f.price) || 0, includes: includesText.split("\n").map((x) => x.trim()).filter(Boolean) });
    }}>
      <div className="grid g2">
        <label className="f">اسم الباقة<input className="in" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="مثال: جلسة تصوير إعلاني" /></label>
        <label className="f">السعر قبل الضريبة (ر.س)<input className="in" type="number" min="0" dir="ltr" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} /></label>
      </div>
      <label className="f">سطر صغير فوق الاسم (اختياري)<input className="in" dir="auto" value={f.eyebrow} onChange={(e) => setF({ ...f, eyebrow: e.target.value })} placeholder="PLAN/C STUDIO · UP TO 6 HOURS" /></label>
      <label className="f">ماذا تشمل (كل سطر نقطة، تظهر في صندوق «ماذا يشمل» في العرض)<textarea className="in" rows={4} value={f.includesText} onChange={(e) => setF({ ...f, includesText: e.target.value })} /></label>
      <label className="row sub"><input type="checkbox" checked={!!f.addon} onChange={(e) => setF({ ...f, addon: e.target.checked })} /> إضافة على باقة أخرى (مثل أولوية التسليم)</label>
      <div className="row">
        <button className="lq primary" disabled={!ok}>حفظ الباقة</button>
        <button type="button" className="lq" onClick={onCancel}>إلغاء</button>
      </div>
    </form>
  );
}

export default function Packages() {
  const saved = useSetting("packages", null);
  const { user } = useAuth();
  const nav = useNavigate();
  const ref = useRef();
  const [edit, setEdit] = useState(null); // package being edited or added
  const [busy, setBusy] = useState(false);
  const list = saved?.packages || [];

  const store = async (packages) => { await setSetting("packages", { v: 1, packages }); };
  async function save(p) {
    const exists = list.some((x) => x.id === p.id);
    await store(exists ? list.map((x) => (x.id === p.id ? p : x)) : [...list, p]);
    setEdit(null);
    toast(exists ? "تم حفظ الباقة" : "تمت إضافة الباقة");
  }
  async function build(p) {
    if (busy) return;
    setBusy(true);
    try { nav(`/quote/${(await quoteFromPackage(p, user)).id}`); toast("تم إنشاء عرض من الباقة. اكتب اسم العميل."); } catch { setBusy(false); }
  }
  async function load(file) {
    try {
      const j = JSON.parse(await file.text());
      if (!Array.isArray(j.packages)) throw new Error();
      await store(j.packages.map((p) => ({ id: p.id || newId(), ...p })));
      toast("تم تحميل الباقات");
    } catch (e) {
      if (!e?.notified) toast("الملف غير صالح. ارفع ملف packages.json.", "error");
    }
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <p className="sub" style={{ margin: 0 }}>الأسعار بالريال السعودي ولا تشمل ضريبة القيمة المضافة. الباقات داخلية ولا تُحفظ في كود التطبيق، ويضيفها الفريق للعرض بضغطة من «إضافة الخدمات والبنود».</p>
      <div className="row">
        <button className="lq primary plus-btn" onClick={() => setEdit(blank())}>+ إضافة باقة</button>
        <button className="lq sm" onClick={() => ref.current.click()}>رفع packages.json</button>
        {list.length > 0 && <button className="lq sm" onClick={() => download("packages.json", JSON.stringify({ v: 1, packages: list }, null, 2), "application/json")}>تنزيل الباقات</button>}
        <input ref={ref} type="file" accept=".json" hidden onChange={(e) => { if (e.target.files[0]) load(e.target.files[0]); e.target.value = ""; }} />
      </div>
      {edit && !list.some((x) => x.id === edit.id) && <PackageForm init={edit} onSave={save} onCancel={() => setEdit(null)} />}
      {!list.length && !edit && <div className="card empty">لا توجد باقات بعد.</div>}
      <div className="pkg-grid">
        {list.map((p) => edit?.id === p.id ? <PackageForm key={p.id} init={p} onSave={save} onCancel={() => setEdit(null)} /> : (
          <article key={p.id} className={`card pkg${p.addon ? " addon" : ""}`}>
            <div className="pkg-head">
              <div>
                {p.eyebrow && <div className="eyebrow-en" dir="auto">{p.eyebrow}</div>}
                <h3>{p.title}</h3>
              </div>
              <div className="pkg-price"><b dir="ltr">{p.addon ? "+" : ""}{fmt(p.price)}</b><small>SAR</small></div>
            </div>
            {p.includes?.length > 0 && <ul className="dash-list">{p.includes.map((x, i) => <li key={i}>{x}</li>)}</ul>}
            <div className="pkg-actions">
              <button className="lq navy" disabled={busy} onClick={() => build(p)}>بناء عرض بهذه الباقة</button>
              <button className="lq sm" onClick={() => setEdit(p)}>تعديل</button>
              <ConfirmButton className="lq sm danger" aria-label={`حذف ${p.title}`} onConfirm={() => store(list.filter((x) => x.id !== p.id)).then(() => toast("تم حذف الباقة"))}>حذف</ConfirmButton>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
