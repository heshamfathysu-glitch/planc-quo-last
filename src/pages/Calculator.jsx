import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth.jsx";
import { put, useSetting } from "../lib/store.js";
import { serviceLine, bundleLine, bundleDesc, totals } from "../lib/calc.js";
import { VIDEO_TYPES } from "../data/catalog.js";
import { money, toast } from "../ui.jsx";
import { fmt } from "../lib/format.js";
import PriceGuide from "../PriceGuide.jsx";

// Internal price calculator: quantities from the price list, fixed-price
// bundles, extra lines, discount, VAT and the margin after cost. Prices come
// from settings/pricing; nothing here reaches a client unless a quote is made.
const KEY = "planc:calc";
const EMPTY = { qty: {}, bundles: {}, extra: [], discount: "", cost: "" };
const load = () => {
  try { return { ...EMPTY, ...JSON.parse(localStorage.getItem(KEY) || "{}") }; } catch { return EMPTY; }
};
const bid = (b, i) => b.id || `b${i}`;
const REEL = Object.fromEntries(VIDEO_TYPES.filter((v) => v.pricing).map((v) => [v.pricing, v.id]));

function Stepper({ value, onChange, label }) {
  const n = Number(value) || 0;
  return (
    <div className="stepper">
      <button type="button" className="lq sm icon" aria-label={`إنقاص ${label}`} disabled={!n} onClick={() => onChange(Math.max(0, n - 1))}>−</button>
      <input className="in" type="number" min="0" inputMode="numeric" dir="ltr" aria-label={label} value={value || ""} placeholder="0" onChange={(e) => onChange(e.target.value)} />
      <button type="button" className="lq sm icon" aria-label={`زيادة ${label}`} onClick={() => onChange(n + 1)}>+</button>
    </div>
  );
}

export default function Calculator() {
  const nav = useNavigate();
  const { user } = useAuth();
  const pricing = useSetting("pricing", null);
  const guide = useSetting("priceGuide", null);
  const [st, setSt] = useState(load);
  const [busy, setBusy] = useState(false);
  useEffect(() => { localStorage.setItem(KEY, JSON.stringify(st)); }, [st]);

  const set = (p) => setSt((s) => ({ ...s, ...p }));
  const services = Object.entries(pricing?.services || {});
  const bundles = pricing?.bundles || [];

  const lines = services.map(([id]) => serviceLine(id, st.qty[id], pricing)).filter(Boolean);
  const bLines = bundles.map((b, i) => ({ b, i, line: bundleLine(b, st.bundles[bid(b, i)], pricing) })).filter((x) => x.line);
  const extras = st.extra.filter((x) => x.title || Number(x.price));
  const t = totals([...lines.map((l) => l.amount), ...bLines.map((x) => x.line.amount), ...extras.map((x) => x.price)], st.discount, st.cost);
  const empty = !lines.length && !bLines.length && !extras.length;
  const updExtra = (i, p) => set({ extra: st.extra.map((x, j) => (j === i ? { ...x, ...p } : x)) });

  // hand the numbers to the wizard: photos and the first reel type keep their
  // automatic pricing, everything else goes in as a custom line
  async function toQuote() {
    if (busy || empty) return;
    setBusy(true);
    const a = { preparer: user.name, issueDate: new Date().toISOString().slice(0, 10), validDays: 7, services: [], discount: t.disc || "" };
    const custom = [];
    const add = (sid) => { if (!a.services.includes(sid)) a.services.push(sid); };
    for (const l of lines) {
      if ((l.id === "menu_photo" || l.id === "social_photo") && !a.photo) { add("photo"); a.photo = { kind: l.id === "menu_photo" ? "menu" : "social", qty: l.qty }; }
      else if (REEL[l.id] && !a.video) { add("video"); a.video = { type: REEL[l.id], duration: "15-30", count: l.qty }; }
      else custom.push({ title: l.title, desc: `${l.qty} × ${fmt(l.unit)} ريال`, price: l.amount });
    }
    for (const { b, line } of bLines) custom.push({ title: line.qty > 1 ? `${b.title} × ${line.qty}` : b.title, desc: bundleDesc(b, pricing), price: line.amount });
    for (const x of extras) custom.push({ title: x.title || "خدمة إضافية", price: Number(x.price) || 0 });
    if (custom.length) { add("custom"); a.custom = { items: custom }; }
    try {
      const q = await put("quotes", { status: "draft", step: 0, answers: a }, user);
      toast("تم نقل الأرقام إلى عرض سعر جديد");
      nav(`/new/${q.id}`);
    } catch { setBusy(false); }
  }

  if (!pricing) return (
    <div>
      <div className="page-head"><h1>حاسبة الأسعار</h1></div>
      <div className="card warn">لم تُضف قائمة الأسعار بعد. ارفعها من <Link to="/admin">لوحة التحكم</Link> ثم عد إلى هنا.</div>
    </div>
  );

  return (
    <div>
      <div className="page-head">
        <h1>حاسبة الأسعار</h1>
        <div className="row">
          <span className="sub">للفريق فقط، لا تظهر للعميل</span>
          <button className="lq sm" disabled={empty && !st.discount && !st.cost} onClick={() => setSt(EMPTY)}>مسح</button>
        </div>
      </div>

      <div className="calc">
        <div className="calc-main">
          <section className="card calc-sec">
            <h2>الخدمات حسب الكمية</h2>
            <p className="sub">سعر الوحدة يتغير تلقائيا حسب شرائح الكمية في قائمة الأسعار.</p>
            {services.map(([id, s]) => {
              const l = serviceLine(id, st.qty[id], pricing);
              return (
                <div key={id} className={`calc-row${l ? " on" : ""}`}>
                  <div className="calc-name">
                    <b>{s.title}</b>
                    <small>
                      {s.tiers.map((tr, i) => (
                        <span key={i} className={l && l.unit === tr.price && !l.missing ? "tier on" : "tier"}>
                          <bdi dir="ltr">{tr.min_qty ?? 1}{tr.max_qty ? `–${tr.max_qty}` : "+"}</bdi>: {fmt(tr.price)}
                        </span>
                      ))}
                    </small>
                  </div>
                  <Stepper label={s.title} value={st.qty[id]} onChange={(v) => set({ qty: { ...st.qty, [id]: v } })} />
                  <div className="calc-amt">
                    {l ? <><b>{money(l.amount)}</b><small>{fmt(l.unit)} ريال {l.word && `لل${l.word}`}</small></> : <small>—</small>}
                  </div>
                  {l?.next && (
                    <button type="button" className="calc-hint" onClick={() => set({ qty: { ...st.qty, [id]: l.next.qty } })}>
                      أضف {l.next.add} ليصبح سعر ال{l.word} {fmt(l.next.unit)} ريال (الإجمالي {money(l.next.qty * l.next.unit)})
                    </button>
                  )}
                  {l?.missing && <div className="calc-hint warn">لا توجد شريحة سعر لهذه الكمية</div>}
                </div>
              );
            })}
          </section>

          <section className="card calc-sec">
            <h2>الباقات</h2>
            {!bundles.length
              ? <p className="sub">لا توجد باقات بعد. أضفها من <Link to="/admin">لوحة التحكم ← قائمة الأسعار</Link>، مثل باقة ريلز بسعر ثابت.</p>
              : bundles.map((b, i) => {
                const k = bid(b, i);
                const l = bundleLine(b, st.bundles[k] || 1, pricing);
                const on = Number(st.bundles[k]) > 0;
                const pct = l.value ? Math.round((l.saving / l.value) * 100) : 0;
                return (
                  <div key={k} className={`calc-row bundle${on ? " on" : ""}`}>
                    <div className="calc-name">
                      <b>{b.title}</b>
                      <small>{bundleDesc(b, pricing) || b.note}</small>
                      {l.saving > 0 && <small className="save">بدل {money(l.value)} بأسعار القائمة، توفير {pct}%</small>}
                    </div>
                    <Stepper label={b.title} value={st.bundles[k]} onChange={(v) => set({ bundles: { ...st.bundles, [k]: v } })} />
                    <div className="calc-amt"><b>{money(on ? Number(st.bundles[k]) * l.unit : l.unit)}</b><small>{on ? `${st.bundles[k]} باقة` : "للباقة"}</small></div>
                  </div>
                );
              })}
          </section>

          <section className="card calc-sec">
            <h2>بنود أخرى</h2>
            <p className="sub">خدمات بسعر يدوي: موقع، هوية، تغطية حدث...</p>
            {st.extra.map((x, i) => (
              <div key={i} className="row">
                <input className="in" style={{ flex: "2 1 180px" }} aria-label="اسم البند" placeholder="اسم البند" value={x.title || ""} onChange={(e) => updExtra(i, { title: e.target.value })} />
                <input className="in" style={{ flex: "1 1 110px" }} type="number" min="0" dir="ltr" aria-label="السعر" placeholder="السعر" value={x.price ?? ""} onChange={(e) => updExtra(i, { price: e.target.value })} />
                <button className="lq sm danger" onClick={() => set({ extra: st.extra.filter((_, j) => j !== i) })}>حذف</button>
              </div>
            ))}
            <button className="lq sm" style={{ justifySelf: "start" }} onClick={() => set({ extra: [...st.extra, {}] })}>+ بند</button>
          </section>

          <PriceGuide guide={guide} ids={(guide?.sections || []).map((s) => s.service)} open={false} />
        </div>

        <aside className="card calc-sum" aria-live="polite">
          <h2>الملخص</h2>
          <div className="row"><span>المجموع</span><span className="spacer" /><b>{money(t.base)}</b></div>
          <label className="f">خصم (%)
            <input className="in" type="number" min="0" max="100" dir="ltr" value={st.discount} placeholder="0" onChange={(e) => set({ discount: e.target.value })} />
          </label>
          {t.discount > 0 && <div className="row"><span>الخصم</span><span className="spacer" /><b>− {money(t.discount)}</b></div>}
          <div className="row"><span>بعد الخصم</span><span className="spacer" /><b>{money(t.net)}</b></div>
          <div className="row"><span>ضريبة القيمة المضافة 15%</span><span className="spacer" /><b>{money(t.vat)}</b></div>
          <div className="row calc-total"><span>الإجمالي</span><span className="spacer" /><b>{money(t.total)}</b></div>

          <label className="f">التكلفة الداخلية (اختياري)
            <input className="in" type="number" min="0" dir="ltr" value={st.cost} placeholder="مصور، مونتاج، معدات..." onChange={(e) => set({ cost: e.target.value })} />
          </label>
          {t.cost > 0 && (
            <div className={`row calc-profit${t.profit < 0 ? " loss" : ""}`}>
              <span>{t.profit < 0 ? "خسارة" : "الربح"}</span><span className="spacer" />
              <b>{money(Math.abs(t.profit))} · {t.margin}%</b>
            </div>
          )}

          <button className="lq primary" disabled={empty || busy} onClick={toQuote}>{busy ? "جار التجهيز..." : "ابدأ عرض سعر بهذه الأرقام"}</button>
          <small className="sub">تنتقل الكميات والأسعار والخصم إلى معالج عرض السعر لتكمل بيانات العميل.</small>
        </aside>
      </div>
    </div>
  );
}
