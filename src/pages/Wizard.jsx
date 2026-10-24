import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../auth.jsx";
import { get, put, list, useCollection, useSetting } from "../lib/store.js";
import { CLIENT_TYPES, SECTORS, SERVICES, PRODUCT_RANGES, DURATIONS, VIDEO_TYPES, DEFAULT_TERMS } from "../data/catalog.js";
import { composeQuote, quoteTotal, addDays, fmtDate, serviceItems } from "../lib/compose.js";
import { money } from "../ui.jsx";
import { resolveItem } from "../pdf/engine.js";

// --- one question per page ------------------------------------------------
function buildSteps(a) {
  const s = ["preparer", "addressedTo", "date", "clientType", "sector", "services"];
  for (const id of a.services || []) s.push("svc:" + id);
  s.push("review");
  return s;
}

const Tile = ({ on, onClick, children }) => (
  <button type="button" className={`tile${on ? " on" : ""}`} onClick={onClick}>{children}</button>
);

function PriceField({ value, onChange, hint }) {
  return (
    <label className="f">السعر قبل الضريبة (ريال){hint && <span className="sub">{hint}</span>}
      <input className="in big" type="number" min="0" dir="ltr" value={value ?? ""} onChange={(e) => onChange(e.target.value)} placeholder="0" />
    </label>
  );
}

export default function Wizard() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const pricing = useSetting("pricing", null);
  const termsLib = useSetting("terms", null);
  const [clients] = useCollection("clients");
  const [q, setQ] = useState(null);
  const [saved, setSaved] = useState("");
  const timer = useRef(null);

  useEffect(() => { get("quotes", id).then(setQ); }, [id]);

  const a = q?.answers || {};
  const steps = useMemo(() => buildSteps(a), [a]);
  const step = Math.min(q?.step || 0, steps.length - 1);
  const key = steps[step];

  // every answer is saved right away
  function save(next) {
    setQ(next);
    setSaved("جار الحفظ...");
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => { await put("quotes", next, user); setSaved("تم الحفظ"); }, 350);
  }
  const set = (patch) => save({ ...q, answers: { ...a, ...patch } });
  const setSvc = (sid, patch) => set({ [sid]: { ...(a[sid] || {}), ...patch } });
  const go = (d) => save({ ...q, step: Math.max(0, Math.min(steps.length - 1, step + d)) });

  if (!q) return <div className="empty">...</div>;

  const valid = (() => {
    switch (key) {
      case "preparer": return !!a.preparer?.trim();
      case "addressedTo": return !!a.addressedTo?.trim();
      case "date": return !!a.issueDate;
      case "clientType": return !!a.clientType && !!a.partyName?.trim();
      case "sector": return !!a.sector;
      case "services": return (a.services || []).length > 0;
      default: return true;
    }
  })();

  async function finish() {
    const code = (clients || []).find((c) => c.name === a.addressedTo)?.code;
    const terms = termsLib?.filter((t) => t.default !== false) || DEFAULT_TERMS;
    const data = composeQuote(a, pricing, { code, terms });
    // keep the client registry up to date
    const all = await list("clients");
    const visible = a.clientType === "third" ? null : a.clientType === "direct" ? a.addressedTo : a.partyName;
    for (const name of [a.addressedTo, visible].filter(Boolean)) {
      if (!all.some((c) => c.name === name)) await put("clients", { name, type: a.clientType === "company" && name === a.partyName ? "company" : a.clientType, sector: a.sector }, user);
    }
    const next = { ...q, data, step: steps.length - 1, total: quoteTotal(data, pricing), client: data.client, history: [{ status: "draft", at: new Date().toISOString(), by: user.name }] };
    await put("quotes", next, user);
    nav(`/quote/${q.id}`);
  }

  const ct = CLIENT_TYPES.find((c) => c.id === a.clientType);
  const preview = key === "review" ? serviceItems(a, pricing) : [];

  return (
    <div className="wiz">
      <div className="progress"><i style={{ width: `${((step + 1) / steps.length) * 100}%` }} /></div>
      <div className="step-n">الخطوة {step + 1} من {steps.length}</div>

      {key === "preparer" && (<>
        <h2>اكتب اسمك</h2>
        <input className="in big" autoFocus value={a.preparer || ""} onChange={(e) => set({ preparer: e.target.value })} placeholder="من يقدم عرض السعر؟" />
      </>)}

      {key === "addressedTo" && (<>
        <h2>عرض السعر موجه إلى...؟</h2>
        <input className="in big" autoFocus list="clients-list" value={a.addressedTo || ""} onChange={(e) => set({ addressedTo: e.target.value })} placeholder="الاسم الذي يظهر في خانة «مقدم إلى»" />
        <datalist id="clients-list">{(clients || []).map((c) => <option key={c.id} value={c.name} />)}</datalist>
      </>)}

      {key === "date" && (<>
        <h2>اختر تاريخ العرض</h2>
        <div className="grid g2">
          <label className="f">تاريخ الإصدار<input className="in big" type="date" value={a.issueDate || ""} onChange={(e) => set({ issueDate: e.target.value })} /></label>
          <label className="f">مدة الصلاحية (أيام)<input className="in big" type="number" min="1" value={a.validDays ?? 7} onChange={(e) => set({ validDays: e.target.value })} /></label>
        </div>
        <p className="sub">صالح حتى {fmtDate(addDays(a.issueDate, a.validDays ?? 7))}</p>
      </>)}

      {key === "clientType" && (<>
        <h2>ما هو تصنيف العميل؟</h2>
        <div className="grid g4">
          {CLIENT_TYPES.map((c) => <Tile key={c.id} on={a.clientType === c.id} onClick={() => set({ clientType: c.id, partyName: a.partyName || (c.id === "direct" ? a.addressedTo : "") })}>{c.label}{c.internal && <small>داخلي فقط</small>}</Tile>)}
        </div>
        {ct && (
          <label className="f" style={{ marginTop: 22 }}>{ct.ask}{ct.internal && <span className="sub">يحفظ داخليا ولا يظهر في عرض السعر</span>}
            <input className="in big" autoFocus value={a.partyName || ""} onChange={(e) => set({ partyName: e.target.value })} />
          </label>
        )}
      </>)}

      {key === "sector" && (<>
        <h2>ما هو قطاع العميل؟</h2>
        <div className="grid g3">
          {SECTORS.map((s) => <Tile key={s.id} on={a.sector === s.id} onClick={() => set({ sector: s.id })}><span className="ic">{s.ic}</span>{s.label}</Tile>)}
        </div>
      </>)}

      {key === "services" && (<>
        <h2>اختر الخدمة</h2>
        <p className="sub" style={{ marginTop: -14 }}>يمكنك اختيار أكثر من خدمة</p>
        <div className="grid g3">
          {SERVICES.map((s) => {
            const on = (a.services || []).includes(s.id);
            return <Tile key={s.id} on={on} onClick={() => set({ services: on ? a.services.filter((x) => x !== s.id) : [...(a.services || []), s.id] })}><span className="ic">{s.ic}</span>{s.label}</Tile>;
          })}
        </div>
      </>)}

      {key?.startsWith("svc:") && <ServiceStep sid={key.slice(4)} s={a[key.slice(4)] || {}} setSvc={setSvc} pricing={pricing} />}

      {key === "review" && (<>
        <h2>مراجعة سريعة</h2>
        <div className="card" style={{ display: "grid", gap: 10 }}>
          {preview.map((p, i) => {
            let amt = 0;
            try { amt = resolveItem(p.item, pricing).amount; } catch { /* missing price */ }
            return <div className="row" key={i}><span>{p.item.title || pricing?.services?.[p.item.service]?.title}</span><span className="spacer" /><b>{money(amt)}</b></div>;
          })}
          {!preview.length && <div className="warn">لم تُحدد خدمات بسعر بعد</div>}
        </div>
        <div className="grid g2" style={{ marginTop: 16 }}>
          <label className="f">خصم (%)<input className="in" type="number" min="0" max="100" value={a.discount ?? ""} onChange={(e) => set({ discount: e.target.value })} placeholder="بدون خصم" /></label>
          {(a.services || []).length > 1 && (
            <label className="f">طريقة العرض
              <select className="in" value={a.split ? "1" : ""} onChange={(e) => set({ split: !!e.target.value })}>
                <option value="">كل الخدمات في خيار واحد</option>
                <option value="1">كل خدمة خيار منفصل</option>
              </select>
            </label>
          )}
        </div>
      </>)}

      <div className="nav">
        <button className="lq" onClick={() => (step === 0 ? nav("/") : go(-1))}>رجوع</button>
        <span className="spacer" />
        {key === "review"
          ? <button className="lq primary" onClick={finish}>إنشاء عرض السعر</button>
          : <button className="lq primary" disabled={!valid} onClick={() => go(1)}>التالي</button>}
      </div>
      <div className="saved">{saved}</div>
    </div>
  );
}

function ServiceStep({ sid, s, setSvc, pricing }) {
  const set = (p) => setSvc(sid, p);
  const label = SERVICES.find((x) => x.id === sid)?.label;

  if (sid === "photo") {
    const svc = s.kind === "menu" ? "menu_photo" : "social_photo";
    const hasPrice = !!pricing?.services?.[svc];
    return (<>
      <h2>تصوير فوتوغرافي</h2>
      <div className="tabs" style={{ marginBottom: 20 }}>
        <button className={`tab${s.kind !== "menu" ? " on" : ""}`} onClick={() => set({ kind: "social" })}>سوشيال ميديا</button>
        <button className={`tab${s.kind === "menu" ? " on" : ""}`} onClick={() => set({ kind: "menu" })}>قائمة طعام</button>
      </div>
      <p className="sub">عدد المنتجات</p>
      <div className="grid g4">
        {PRODUCT_RANGES.map((r) => <Tile key={r.label} on={s.range === r.label} onClick={() => set({ range: r.label, qty: r.qty })}>{r.label}</Tile>)}
      </div>
      <label className="f" style={{ marginTop: 16 }}>أو اكتب العدد
        <input className="in big" type="number" min="1" value={s.qty ?? ""} onChange={(e) => set({ qty: e.target.value, range: "" })} />
      </label>
      {!hasPrice && <div style={{ marginTop: 16 }}><PriceField value={s.price} onChange={(v) => set({ price: v })} hint="إجمالي التصوير" /></div>}
    </>);
  }

  if (sid === "video") {
    const vt = VIDEO_TYPES.find((v) => v.id === s.type);
    const auto = vt?.pricing && pricing?.services?.[vt.pricing] && ["7-15", "15-30"].includes(s.duration);
    return (<>
      <h2>تصوير فيديو</h2>
      <div className="grid g3">
        {VIDEO_TYPES.map((v) => <Tile key={v.id} on={s.type === v.id} onClick={() => set({ type: v.id })}>{v.label}</Tile>)}
      </div>
      <p className="sub" style={{ marginTop: 20 }}>مدة الفيديو</p>
      <div className="chips">
        {DURATIONS.map((d) => <button key={d.id} className={`tab${s.duration === d.id ? " on" : ""}`} onClick={() => set({ duration: d.id })}>{d.label}</button>)}
      </div>
      {s.duration === "custom" && <label className="f" style={{ marginTop: 14 }}>المدة بالدقائق<input className="in" type="number" min="0" step="0.5" value={s.minutes ?? ""} onChange={(e) => set({ minutes: e.target.value })} /></label>}
      <div className="grid g2" style={{ marginTop: 16 }}>
        <label className="f">عدد الفيديوهات<input className="in big" type="number" min="1" value={s.count ?? 1} onChange={(e) => set({ count: e.target.value })} /></label>
        {auto
          ? <div className="sub" style={{ alignSelf: "end" }}>السعر يحسب تلقائيا من قائمة الأسعار</div>
          : <PriceField value={s.price} onChange={(v) => set({ price: v })} hint="إجمالي الفيديوهات" />}
      </div>
    </>);
  }

  if (sid === "website") return (<>
    <h2>تصميم موقع</h2>
    <div className="grid g2">
      <label className="f">عدد الصفحات<input className="in big" type="number" min="1" value={s.pages ?? ""} onChange={(e) => set({ pages: e.target.value })} /></label>
      <PriceField value={s.price} onChange={(v) => set({ price: v })} />
    </div>
    <label className="f" style={{ marginTop: 16 }}>تفاصيل الموقع<textarea className="in" value={s.details || ""} onChange={(e) => set({ details: e.target.value })} /></label>
  </>);

  if (sid === "landing") return (<>
    <h2>تصميم صفحة هبوط</h2>
    <label className="f">اكتب ملخصا بسيطا عن الهدف من الصفحة<textarea className="in" autoFocus value={s.summary || ""} onChange={(e) => set({ summary: e.target.value })} /></label>
    <div style={{ marginTop: 16 }}><PriceField value={s.price} onChange={(v) => set({ price: v })} /></div>
  </>);

  if (sid === "custom") {
    const items = s.items?.length ? s.items : [{}];
    const upd = (i, p) => set({ items: items.map((it, j) => (j === i ? { ...it, ...p } : it)) });
    return (<>
      <h2>أضف خدمة مخصصة</h2>
      <div style={{ display: "grid", gap: 14 }}>
        {items.map((it, i) => (
          <div className="block" key={i}>
            <div className="block-head"><b>خدمة {i + 1}</b>{items.length > 1 && <button className="lq sm danger" onClick={() => set({ items: items.filter((_, j) => j !== i) })}>حذف</button>}</div>
            <input className="in" placeholder="اسم الخدمة" value={it.title || ""} onChange={(e) => upd(i, { title: e.target.value })} />
            <input className="in" placeholder="وصف مختصر (اختياري)" value={it.desc || ""} onChange={(e) => upd(i, { desc: e.target.value })} />
            <input className="in" type="number" min="0" placeholder="السعر قبل الضريبة" value={it.price ?? ""} onChange={(e) => upd(i, { price: e.target.value })} />
          </div>
        ))}
        <button className="lq" onClick={() => set({ items: [...items, {}] })}>+ خدمة أخرى</button>
      </div>
    </>);
  }

  return (<>
    <h2>{label}</h2>
    <label className="f">ما الذي تشمله الخدمة؟<textarea className="in" autoFocus value={s.desc || ""} onChange={(e) => set({ desc: e.target.value })} /></label>
    <div style={{ marginTop: 16 }}><PriceField value={s.price} onChange={(v) => set({ price: v })} /></div>
  </>);
}
