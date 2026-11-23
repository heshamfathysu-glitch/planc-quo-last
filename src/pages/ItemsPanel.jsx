// "إضافة الخدمات والبنود" in the quote editor: add a package, items priced
// from the internal price list, or a custom item, then see the document's
// items and subtotal. Items go to the first option's price card.
import { useState } from "react";
import { useSetting } from "../lib/store.js";
import { unitPrice, fmt } from "../pdf/engine.js";
import { addItems, removeItem, cardItems } from "../lib/quoteOps.js";
import { toast } from "../ui.jsx";

const IC = {
  box: "M21 8 12 3 3 8v8l9 5 9-5zM3 8l9 5 9-5M12 13v8",
  calc: "M6 3h12v18H6zM9 7h6M9 11h.01M12 11h.01M15 11h.01M9 14h.01M12 14h.01M15 14h.01M9 17h.01M12 17h.01M15 17h.01",
  doc: "M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5M12 12v6M9 15h6",
  plus: "M12 5v14M5 12h14",
  x: "M6 6l12 12M18 6 6 18",
};
const Ico = ({ d }) => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
);
const n = (v) => <bdi className="nums" dir="ltr">{fmt(Number(v) || 0)}</bdi>;

function Packages({ add }) {
  const saved = useSetting("packages", null);
  const pkgs = saved?.packages || [];
  if (!pkgs.length) return <div className="empty sub">لا توجد باقات بعد. يضيفها الأدمن من لوحة التحكم &gt; الباقات.</div>;
  return (
    <div className="pk-list">
      {pkgs.map((p) => (
        <div key={p.id} className={`pk-row${p.addon ? " addon" : ""}`}>
          <div>
            <b>{p.title}</b>
            {p.eyebrow && <small dir="auto">{p.eyebrow}</small>}
          </div>
          <span className="pk-price">{p.addon ? "+" : ""}{n(p.price)}</span>
          <button type="button" className="add-sq" aria-label={`إضافة ${p.title}`} onClick={() => add([{ title: p.title, amount: Number(p.price) || 0 }], (p.includes || []).filter(Boolean), p.title)}>
            <Ico d={IC.plus} />
          </button>
        </div>
      ))}
    </div>
  );
}

function Calculator({ add, pricing }) {
  const [qty, setQty] = useState({});
  const services = Object.entries(pricing?.services || {});
  if (!services.length) return <div className="empty sub">لم تُرفع قائمة الأسعار بعد (لوحة التحكم &gt; قائمة الأسعار).</div>;
  const rows = services.map(([k, s]) => {
    const q = Number(qty[k]) || 0;
    let price = 0, err = "";
    if (q > 0) { try { price = unitPrice(k, q, pricing); } catch { err = "لا يوجد سعر لهذه الكمية"; } }
    return { k, s, q, price, err };
  });
  const picked = rows.filter((r) => r.q > 0 && !r.err);
  const total = picked.reduce((s, r) => s + r.q * r.price, 0);
  return (
    <div className="calc">
      <div className="grid g2">
        {rows.map(({ k, s, q, price, err }) => (
          <label className="f" key={k}>{s.title}
            <input className="in" type="number" min="0" dir="ltr" value={qty[k] ?? ""} placeholder="0" onChange={(e) => setQty({ ...qty, [k]: e.target.value })} />
            {q > 0 && <span className={err ? "err" : "sub"}>{err || <>سعر الوحدة {n(price)} ريال</>}</span>}
          </label>
        ))}
      </div>
      <div className="calc-sum">التكلفة المحسوبة من قائمة الأسعار: <b>{n(total)}</b> ر.س</div>
      <button type="button" className="lq primary" disabled={!picked.length} onClick={() => {
        add(picked.map((r) => ({ service: r.k, qty: r.q })), [], "البنود المحسوبة");
        setQty({});
      }}>إدراج البنود المحسوبة</button>
    </div>
  );
}

function Custom({ add }) {
  const blank = { title: "", price: "", qty: 1, desc: "" };
  const [f, setF] = useState(blank);
  const ok = f.title.trim() && Number(f.qty) > 0;
  return (
    <form className="custom" onSubmit={(e) => {
      e.preventDefault();
      if (!ok) return;
      const qty = Number(f.qty) || 1;
      const price = Number(f.price) || 0;
      const desc = [qty > 1 ? `${fmt(qty)} × ${fmt(price)} ريال` : "", f.desc.trim()].filter(Boolean).join("، ");
      add([{ title: f.title.trim(), ...(desc ? { desc } : {}), amount: qty * price }], [], f.title.trim());
      setF(blank);
    }}>
      <label className="f">اسم الخدمة / البند<input className="in" placeholder="مثال: إدارة حملة إعلانية شهرية" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></label>
      <div className="grid g2">
        <label className="f">سعر الوحدة (ر.س)<input className="in" type="number" min="0" dir="ltr" placeholder="0" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} /></label>
        <label className="f">الكمية<input className="in" type="number" min="1" dir="ltr" value={f.qty} onChange={(e) => setF({ ...f, qty: e.target.value })} /></label>
      </div>
      <input className="in" aria-label="وصف مختصر" placeholder="وصف مختصر يظهر في ملف PDF (اختياري)..." value={f.desc} onChange={(e) => setF({ ...f, desc: e.target.value })} />
      <button className="lq primary wide" disabled={!ok}>+ إضافة</button>
    </form>
  );
}

export default function ItemsPanel({ data, setData, pricing }) {
  const [tab, setTab] = useState("packages");
  const add = (items, lines, name) => {
    setData(addItems(data, items, lines));
    toast(`تمت إضافة ${name}`);
  };
  const items = cardItems(data, pricing);
  const subtotal = items.reduce((s, it) => s + (Number(it.amount) || 0), 0);
  const TABS = [["packages", "الباقات", IC.box], ["calc", "حاسبة التسعير", IC.calc], ["custom", "بند مخصّص", IC.doc]];
  return (
    <>
      <section className="card panel">
        <h2 className="sec-h">إضافة الخدمات والبنود</h2>
        <div className="seg" role="tablist">
          {TABS.map(([id, label, d]) => (
            <button key={id} type="button" role="tab" aria-selected={tab === id} className={`seg-b${tab === id ? " on" : ""}`} onClick={() => setTab(id)}><Ico d={d} />{label}</button>
          ))}
        </div>
        <div className="seg-body">
          {tab === "packages" && <Packages add={add} />}
          {tab === "calc" && <Calculator add={add} pricing={pricing} />}
          {tab === "custom" && <Custom add={add} />}
        </div>
      </section>
      <section className="card panel">
        <div className="sec-row">
          <h2 className="sec-h">بنود المستند ({items.length})</h2>
          <span className="mono sub" dir="ltr">SUBTOTAL: {fmt(subtotal)} SAR</span>
        </div>
        {!items.length ? <div className="dashed">لم تُضف بنود بعد. اختر باقة من الأعلى أو أضف بندًا مخصّصًا.</div> : (
          <ul className="doc-items">
            {items.map((it, i) => (
              <li key={i}>
                <div><b>{it.title || "بند بدون اسم"}</b>{it.desc && <small>{it.desc}</small>}</div>
                <span className="pk-price">{n(it.amount)}</span>
                <button type="button" className="lq icon sm danger" aria-label={`حذف ${it.title || "البند"}`} onClick={() => setData(removeItem(data, i))}><Ico d={IC.x} /></button>
              </li>
            ))}
          </ul>
        )}
        <p className="sub" style={{ margin: "10px 0 0", fontSize: 13 }}>الإجمالي في ملف PDF يحسب الخصم والضريبة كما في القالب.</p>
      </section>
    </>
  );
}
